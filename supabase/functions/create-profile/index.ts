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
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          detail: authError?.message ?? "No user found",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const { username, first_name, middle_name, last_name, dupr_id, dupr_rating, latitude, longitude } = body;

    // --- Validate required fields ---

    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "username is required" }),
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

    // --- Validate name fields ---

    if (!first_name || typeof first_name !== "string" || first_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "first_name is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (first_name.trim().length > 50) {
      return new Response(
        JSON.stringify({ error: "first_name must be 50 characters or fewer" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!last_name || typeof last_name !== "string" || last_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "last_name is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (last_name.trim().length > 50) {
      return new Response(
        JSON.stringify({ error: "last_name must be 50 characters or fewer" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (middle_name != null && typeof middle_name === "string" && middle_name.trim().length > 50) {
      return new Response(
        JSON.stringify({ error: "middle_name must be 50 characters or fewer" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Validate DUPR rating (required) ---

    if (dupr_rating == null) {
      return new Response(
        JSON.stringify({ error: "dupr_rating is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (dupr_rating < 1.0 || dupr_rating > 8.0) {
      return new Response(
        JSON.stringify({ error: "dupr_rating must be between 1.0 and 8.0" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Check if profile already exists ---

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Profile already exists. Use update-profile instead." }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // --- Build the insert row ---

    const row: Record<string, unknown> = {
      id: user.id,
      username: username.trim(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      dupr_rating,
    };

    if (middle_name != null && typeof middle_name === "string" && middle_name.trim().length > 0) {
      row.middle_name = middle_name.trim();
    }
    if (dupr_id) row.dupr_id = dupr_id;

    if (latitude != null && longitude != null) {
      row.location = `SRID=4326;POINT(${longitude} ${latitude})`;
    }

    // --- Insert profile ---

    const { data: profile, error: insertError } = await supabase
      .from("users")
      .insert(row)
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint on username
      if (insertError.code === "23505" && insertError.message.includes("username")) {
        return new Response(
          JSON.stringify({ error: "Username is already taken" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, profile }),
      {
        status: 201,
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
