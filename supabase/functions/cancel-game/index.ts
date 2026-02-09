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

    // Fetch the game
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", game_id)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Only the creator can cancel
    if (game.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the game creator can cancel this game" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (game.is_cancelled) {
      return new Response(
        JSON.stringify({ error: "Game is already cancelled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Cancel the game
    const { error: updateError } = await supabase
      .from("games")
      .update({ is_cancelled: true })
      .eq("id", game_id);

    if (updateError) throw updateError;

    // Cancel all confirmed/waitlisted RSVPs
    const { error: rsvpError } = await supabase
      .from("game_participants")
      .update({ rsvp_status: "cancelled" })
      .eq("game_id", game_id)
      .neq("rsvp_status", "cancelled");

    if (rsvpError) throw rsvpError;

    return new Response(
      JSON.stringify({ success: true, message: "Game cancelled" }),
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
