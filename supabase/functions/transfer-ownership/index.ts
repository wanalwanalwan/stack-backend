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

    const { game_id, new_owner_id } = await req.json();
    if (!game_id || !new_owner_id) {
      return new Response(
        JSON.stringify({ error: "game_id and new_owner_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch the game to verify ownership
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("creator_id")
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

    // Only the current host can transfer ownership
    if (game.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the host can transfer ownership" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Cannot transfer to yourself
    if (new_owner_id === user.id) {
      return new Response(
        JSON.stringify({ error: "You are already the host" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify the new owner is a confirmed participant
    const { data: participant, error: participantError } = await supabase
      .from("game_participants")
      .select("id")
      .eq("game_id", game_id)
      .eq("user_id", new_owner_id)
      .eq("rsvp_status", "confirmed")
      .maybeSingle();

    if (participantError) throw participantError;

    if (!participant) {
      return new Response(
        JSON.stringify({ error: "New owner must be a confirmed participant" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Transfer ownership
    const { error: updateError } = await supabase
      .from("games")
      .update({ creator_id: new_owner_id })
      .eq("id", game_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: "Ownership transferred" }),
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
