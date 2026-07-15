import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin
    const { data: callerProfile, error: profileError } = await callerClient
      .from("user_profiles")
      .select("roles, organization_id")
      .eq("id", caller.id)
      .single();

    if (profileError || !callerProfile?.roles?.includes("admin")) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { exclude_user_ids = [] } = body;

    const siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: SITE_URL not set" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch all users in the caller's org (excluding specified IDs)
    const { data: users, error: usersError } = await adminClient
      .from("user_profiles")
      .select("id, email, first_name, last_name, roles")
      .eq("organization_id", callerProfile.organization_id)
      .eq("is_active", true);

    if (usersError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch users: ${usersError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Always exclude the caller; also exclude any explicitly listed IDs
    const excludeSet = new Set([caller.id, ...exclude_user_ids]);
    const targetUsers = users.filter((u) => !excludeSet.has(u.id));

    // Send each targeted user a password-reset email rather than setting any
    // password ourselves — nothing here ever knows or chooses a user's
    // password (ASVS 6.4.1).
    const results = { sent: [] as string[], failed: [] as { id: string; email: string; error: string }[] };

    for (const user of targetUsers) {
      const { error: sendError } = await adminClient.auth.resetPasswordForEmail(
        user.email,
        { redirectTo: `${siteUrl}/reset-password` }
      );

      if (sendError) {
        results.failed.push({
          id: user.id,
          email: user.email,
          error: sendError.message,
        });
      } else {
        results.sent.push(user.email);
      }
    }

    return new Response(
      JSON.stringify({
        total_in_org: users.length,
        excluded: excludeSet.size,
        sent_count: results.sent.length,
        failed_count: results.failed.length,
        sent: results.sent,
        failed: results.failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
