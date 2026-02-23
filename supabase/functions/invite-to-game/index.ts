import { corsHeaders } from "../_shared/cors.ts";
import {
  createUserClient,
  createAdminClient,
} from "../_shared/supabase-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createUserClient(req);

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

    const { game_id, friend_id } = await req.json();
    if (!game_id || !friend_id) {
      return new Response(
        JSON.stringify({ error: "game_id and friend_id are required" }),
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
      return new Response(JSON.stringify({ error: "Game not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (game.is_cancelled) {
      return new Response(
        JSON.stringify({ error: "Game has been cancelled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (game.spots_filled >= game.spots_available) {
      return new Response(JSON.stringify({ error: "Game is full" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify inviter is a participant or creator
    const isCreator = game.creator_id === user.id;
    if (!isCreator) {
      const { data: participation } = await supabase
        .from("game_participants")
        .select("id")
        .eq("game_id", game_id)
        .eq("user_id", user.id)
        .eq("rsvp_status", "confirmed")
        .maybeSingle();

      if (!participation) {
        return new Response(
          JSON.stringify({
            error: "You must be a participant to invite friends",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Verify they are accepted friends
    const { data: friendship } = await supabase
      .from("friendships")
      .select("id")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friend_id}),and(user_id.eq.${friend_id},friend_id.eq.${user.id})`,
      )
      .eq("status", "accepted")
      .maybeSingle();

    if (!friendship) {
      return new Response(
        JSON.stringify({ error: "You can only invite accepted friends" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check friend isn't already a participant
    const { data: existingParticipant } = await supabase
      .from("game_participants")
      .select("id, rsvp_status")
      .eq("game_id", game_id)
      .eq("user_id", friend_id)
      .maybeSingle();

    if (existingParticipant && existingParticipant.rsvp_status === "confirmed") {
      return new Response(
        JSON.stringify({ error: "Friend is already in this game" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use admin client to insert participant (bypasses RLS)
    const admin = createAdminClient();

    if (existingParticipant) {
      const { error: updateError } = await admin
        .from("game_participants")
        .update({ rsvp_status: "confirmed" })
        .eq("id", existingParticipant.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await admin
        .from("game_participants")
        .insert({
          game_id,
          user_id: friend_id,
          rsvp_status: "confirmed",
        });
      if (insertError) throw insertError;
    }

    // Increment spots_filled
    const { error: rpcError } = await admin.rpc("increment_spots_filled", {
      p_game_id: game_id,
    });
    if (rpcError) throw rpcError;

    return new Response(
      JSON.stringify({ success: true, message: "Friend invited to game" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
