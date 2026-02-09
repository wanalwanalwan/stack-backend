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

    const { game_id } = await req.json();
    if (!game_id) {
      return new Response(
        JSON.stringify({ error: "game_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Find the user's RSVP
    const { data: rsvp, error: rsvpError } = await supabase
      .from("game_participants")
      .select("id, rsvp_status")
      .eq("game_id", game_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (rsvpError) throw rsvpError;

    if (!rsvp) {
      return new Response(
        JSON.stringify({ error: "You don't have an RSVP for this game" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (rsvp.rsvp_status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "RSVP is already cancelled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const wasConfirmed = rsvp.rsvp_status === "confirmed";

    // Cancel the RSVP
    const { error: updateError } = await supabase
      .from("game_participants")
      .update({ rsvp_status: "cancelled" })
      .eq("id", rsvp.id);

    if (updateError) throw updateError;

    // Decrement spots_filled if the user was confirmed
    if (wasConfirmed) {
      const { data: game } = await supabase
        .from("games")
        .select("spots_filled")
        .eq("id", game_id)
        .single();

      if (game && game.spots_filled > 0) {
        const { error: gameUpdateError } = await supabase
          .from("games")
          .update({ spots_filled: game.spots_filled - 1 })
          .eq("id", game_id)
          .eq("spots_filled", game.spots_filled); // optimistic concurrency

        if (gameUpdateError) throw gameUpdateError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "RSVP cancelled" }),
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
