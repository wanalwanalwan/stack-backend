import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-client.ts";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createUserClient(req);
    const admin = createAdminClient();

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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const chat_id = body?.chat_id;
    const user_id = body?.user_id;

    if (!isUuid(chat_id) || !isUuid(user_id)) {
      return new Response(JSON.stringify({ error: "chat_id and user_id are required UUIDs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === user.id) {
      return new Response(JSON.stringify({ error: "Cannot add yourself (already a member)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize: creator or admin member of the chat.
    const { data: chat, error: chatError } = await admin
      .from("group_chats")
      .select("id, created_by")
      .eq("id", chat_id)
      .maybeSingle();
    if (chatError) throw chatError;
    if (!chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let isAdminOrCreator = chat.created_by === user.id;
    if (!isAdminOrCreator) {
      const { data: me, error: meError } = await admin
        .from("group_chat_members")
        .select("role")
        .eq("chat_id", chat_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (meError) throw meError;
      isAdminOrCreator = me?.role === "admin";
    }

    if (!isAdminOrCreator) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing, error: existingError } = await admin
      .from("group_chat_members")
      .select("chat_id, user_id")
      .eq("chat_id", chat_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return new Response(JSON.stringify({ error: "User is already a member" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await admin.from("group_chat_members").insert({
      chat_id,
      user_id,
      role: "member",
    });
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

