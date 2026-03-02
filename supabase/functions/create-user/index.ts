import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
      password,
      first_name,
      last_name,
      preferred_name,
      roles,
      grade_level,
      organization_id,
    } = body;

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !roles?.length || !organization_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, first_name, last_name, roles, organization_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Create auth user — pass metadata so the on_auth_user_created trigger
    // can automatically create the user_profiles row.
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        organization_id,
        first_name,
        last_name,
        preferred_name: preferred_name || null,
        roles,
      },
    });

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
