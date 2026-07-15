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
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      email,
      first_name,
      last_name,
      preferred_name,
      roles,
      grade_level,
      organization_id,
    } = body;

    // Validate required fields
    if (!email || !first_name || !last_name || !roles?.length || !organization_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, first_name, last_name, roles, organization_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: SITE_URL not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure caller can only create users in their own org
    if (organization_id !== callerProfile.organization_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: cannot create users in another organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Invite the user by email — pass metadata so the on_auth_user_created
    // trigger can automatically create the user_profiles row. The user sets
    // their own password via the invite link (ASVS 6.4.1: no admin-chosen
    // initial password that could become the long-term one).
    const { data: authData, error: createError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${siteUrl}/reset-password`,
        data: {
          organization_id,
          first_name,
          last_name,
          preferred_name: preferred_name || null,
          roles,
        },
      }
    );

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The trigger created the profile — now update grade_level if provided,
    // since the trigger doesn't handle it.
    if (grade_level) {
      await adminClient
        .from("user_profiles")
        .update({ grade_level })
        .eq("id", authData.user.id);
    }

    // Fetch the created profile to return it
    const { data: profile, error: fetchError } = await adminClient
      .from("user_profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: `User created but failed to fetch profile: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ user: profile }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
