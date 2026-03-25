import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface FeedbackRequest {
  report_type: "bug" | "schedule_issue" | "feedback";
  description: string;
  expected_behavior?: string;
  activity_id?: string;
  activity_name_text?: string;
  screenshot_base64?: string;
  screenshot_filename?: string;
  screenshot_content_type?: string;
  page_route?: string;
  user_agent?: string;
  screen_size?: string;
  user_role?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Authenticate caller
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

    // Look up user profile for org_id and name
    const { data: callerProfile, error: profileError } = await callerClient
      .from("user_profiles")
      .select("organization_id, first_name, last_name, roles")
      .eq("id", caller.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const body: FeedbackRequest = await req.json();
    const {
      report_type,
      description,
      expected_behavior,
      activity_id,
      activity_name_text,
      screenshot_base64,
      screenshot_filename,
      screenshot_content_type,
      page_route,
      user_agent,
      screen_size,
      user_role,
    } = body;

    // Validate required fields
    if (!report_type || !description) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: report_type, description" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!["bug", "schedule_issue", "feedback"].includes(report_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid report_type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (description.length < 10 || description.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Description must be between 10 and 2000 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Admin client for privileged DB operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 1: Insert feedback_reports row (save locally first)
    const { data: report, error: insertError } = await adminClient
      .from("feedback_reports")
      .insert({
        organization_id: callerProfile.organization_id,
        user_id: caller.id,
        report_type,
        description,
        expected_behavior: expected_behavior || null,
        activity_id: activity_id || null,
        activity_name_text: activity_name_text || null,
        page_route: page_route || null,
        user_agent: user_agent || null,
        screen_size: screen_size || null,
        user_role: user_role || null,
      })
      .select()
      .single();

    if (insertError || !report) {
      return new Response(
        JSON.stringify({ error: "Failed to save report" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Upload screenshot if provided
    let screenshotUrl: string | null = null;
    if (screenshot_base64 && screenshot_filename && screenshot_content_type) {
      try {
        const imageBytes = Uint8Array.from(
          atob(screenshot_base64),
          (c) => c.charCodeAt(0)
        );
        const storagePath = `${report.id}/${screenshot_filename}`;
        const { error: uploadError } = await adminClient.storage
          .from("feedback-screenshots")
          .upload(storagePath, imageBytes, {
            contentType: screenshot_content_type,
            upsert: false,
          });

        if (!uploadError) {
          const { data: publicData } = adminClient.storage
            .from("feedback-screenshots")
            .getPublicUrl(storagePath);
          screenshotUrl = publicData?.publicUrl || null;

          if (screenshotUrl) {
            await adminClient
              .from("feedback_reports")
              .update({ screenshot_url: screenshotUrl })
              .eq("id", report.id);
          }
        } else {
          console.warn("Screenshot upload failed:", uploadError.message);
        }
      } catch (uploadErr) {
        console.warn("Screenshot processing failed:", uploadErr);
      }
    }

    // Step 3: Create Linear issue
    const linearApiKey = Deno.env.get("LINEAR_API_KEY");
    const linearTeamId = Deno.env.get("LINEAR_TEAM_ID");
    const linearLabelBug = Deno.env.get("LINEAR_LABEL_BUG");
    const linearLabelSchedule = Deno.env.get("LINEAR_LABEL_SCHEDULE");
    const linearLabelFeedback = Deno.env.get("LINEAR_LABEL_FEEDBACK");

    let linearSynced = false;

    if (linearApiKey && linearTeamId) {
      try {
        // Build issue title
        const truncated = (str: string, len: number) =>
          str.length > len ? str.slice(0, len) + "…" : str;
        const reporterName = `${callerProfile.first_name} ${callerProfile.last_name}`;

        let title: string;
        if (report_type === "bug") {
          title = `[Bug] ${truncated(description, 60)}`;
        } else if (report_type === "schedule_issue") {
          title = `[Schedule] ${reporterName}: ${truncated(description, 50)}`;
        } else {
          title = `[Feedback] ${truncated(description, 60)}`;
        }

        // Build markdown body
        const roleLabel = user_role
          ? user_role.charAt(0).toUpperCase() + user_role.slice(1)
          : "Unknown";
        const typeLabel =
          report_type === "bug"
            ? "Bug Report"
            : report_type === "schedule_issue"
            ? "Schedule Issue"
            : "Feedback";

        let markdownBody = `**Reporter:** ${reporterName} (${roleLabel})
**Type:** ${typeLabel}
**Page:** ${page_route || "unknown"}
**Submitted:** ${new Date().toISOString()}

---

### Description
${description}`;

        if (expected_behavior) {
          markdownBody += `\n\n### Expected Behavior\n${expected_behavior}`;
        }

        const activityDisplay =
          activity_name_text || (activity_id ? `Activity ID: ${activity_id}` : null);
        if (activityDisplay) {
          markdownBody += `\n\n### Activity\n${activityDisplay}`;
          if (activity_id && activity_name_text) {
            markdownBody += ` (ID: ${activity_id})`;
          }
        }

        if (screenshotUrl) {
          markdownBody += `\n\n### Screenshot\n![screenshot](${screenshotUrl})`;
        }

        markdownBody += `\n\n---\n*Device: ${user_agent || "unknown"}*\n*Screen: ${screen_size || "unknown"}*`;

        // Pick label
        const labelId =
          report_type === "bug"
            ? linearLabelBug
            : report_type === "schedule_issue"
            ? linearLabelSchedule
            : linearLabelFeedback;

        const issueInput: Record<string, unknown> = {
          title,
          description: markdownBody,
          teamId: linearTeamId,
        };
        if (labelId) {
          issueInput.labelIds = [labelId];
        }

        const linearResponse = await fetch("https://api.linear.app/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: linearApiKey,
          },
          body: JSON.stringify({
            query: `
              mutation CreateIssue($input: IssueCreateInput!) {
                issueCreate(input: $input) {
                  success
                  issue {
                    id
                    identifier
                    url
                  }
                }
              }
            `,
            variables: { input: issueInput },
          }),
        });

        const linearData = await linearResponse.json();
        const issue = linearData?.data?.issueCreate?.issue;

        if (issue?.id) {
          await adminClient
            .from("feedback_reports")
            .update({
              linear_issue_id: issue.id,
              linear_issue_url: issue.url,
            })
            .eq("id", report.id);
          linearSynced = true;
        } else {
          console.warn("Linear issue creation failed:", JSON.stringify(linearData));
        }
      } catch (linearErr) {
        console.warn("Linear API error:", linearErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, report_id: report.id, linear_synced: linearSynced }),
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
