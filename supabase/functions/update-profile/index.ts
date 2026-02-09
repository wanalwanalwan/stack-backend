import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createUserClient(req);

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { username, dupr_id, dupr_rating, latitude, longitude, avatar_url } = body;

    // --- Build the update object (only include fields that were provided) ---

    const updates: Record<string, unknown> = {};

    if (username !== undefined) {
      if (typeof username !== "string" || username.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "username cannot be empty" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (username.trim().length < 3 || username.trim().length > 30) {
        return new Response(
          JSON.stringify({ error: "username must be between 3 and 30 characters" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      updates.username = username.trim();
    }

    if (dupr_id !== undefined) updates.dupr_id = dupr_id;

    if (dupr_rating !== undefined) {
      if (dupr_rating != null && (dupr_rating < 1.0 || dupr_rating > 8.0)) {
        return new Response(
          JSON.stringify({ error: "dupr_rating must be between 1.0 and 8.0" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      updates.dupr_rating = dupr_rating;
    }

    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    if (latitude != null && longitude != null) {
      updates.location = `SRID=4326;POINT(${longitude} ${latitude})`;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No fields to update" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Update profile ---

    const { data: profile, error: updateError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "23505" && updateError.message.includes("username")) {
        return new Response(
          JSON.stringify({ error: "Username is already taken" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, profile }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
