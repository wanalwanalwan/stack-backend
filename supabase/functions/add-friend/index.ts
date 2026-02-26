import { corsHeaders } from "../_shared/cors.ts";
import { createUserClient } from "../_shared/supabase-client.ts";

// Compatibility alias for clients invoking "add-friend".
// Behaves like "send-friend-request", supporting friend_id or friend_username.

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

    const { friend_id, friend_username } = await req.json();
    if (!friend_id && !friend_username) {
      return new Response(
        JSON.stringify({ error: "friend_id or friend_username is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let resolvedFriendId: string | null = null;
    if (friend_id) {
      resolvedFriendId = friend_id;
    } else if (typeof friend_username === "string") {
      const uname = friend_username.trim();
      if (uname.length === 0) {
        return new Response(
          JSON.stringify({ error: "friend_username cannot be empty" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: recipientByUsername, error: lookupError } = await supabase
        .from("users")
        .select("id")
        .ilike("username", uname)
        .maybeSingle();

      if (lookupError) throw lookupError;
      resolvedFriendId = recipientByUsername?.id ?? null;
    }

    if (!resolvedFriendId) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (resolvedFriendId === user.id) {
      return new Response(
        JSON.stringify({ error: "Cannot send a friend request to yourself" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: recipient, error: recipientError } = await supabase
      .from("users")
      .select("id")
      .eq("id", resolvedFriendId)
      .maybeSingle();

    if (recipientError || !recipient) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${resolvedFriendId}),and(user_id.eq.${resolvedFriendId},friend_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (existing) {
      const msg =
        existing.status === "pending"
          ? "Friend request already pending"
          : existing.status === "accepted"
            ? "Already friends"
            : "A previous request was declined";
      return new Response(JSON.stringify({ error: msg }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase
      .from("friendships")
      .insert({ user_id: user.id, friend_id: resolvedFriendId, status: "pending" });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, message: "Friend request sent" }),
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

