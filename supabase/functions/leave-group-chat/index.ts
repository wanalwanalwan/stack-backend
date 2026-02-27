import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase-client.ts";
import { isMissingColumnErrorMessage, pickChatCreatorId, serializeError } from "../_shared/group-chat.ts";

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

    if (!isUuid(chat_id)) {
      return new Response(JSON.stringify({ error: "chat_id is required (UUID)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: chat, error: chatError } = await admin
      .from("group_chats")
      .select("*")
      .eq("id", chat_id)
      .maybeSingle();
    if (chatError) throw chatError;
    if (!chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creatorId = pickChatCreatorId(chat as unknown as Record<string, unknown>);
    if (creatorId === user.id) {
      return new Response(JSON.stringify({ error: "Creator cannot leave their own chat" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deleteCandidates = [
      admin.from("group_chat_members").delete().eq("chat_id", chat_id).eq("user_id", user.id),
      admin.from("group_chat_members").delete().eq("group_chat_id", chat_id).eq("user_id", user.id),
    ];
    let deleted = false;
    let lastDeleteError: unknown = null;
    for (const p of deleteCandidates) {
      const { error } = await p;
      if (!error) {
        deleted = true;
        lastDeleteError = null;
        break;
      }
      lastDeleteError = error;
      const msg = (error as { message?: string } | null)?.message;
      if (typeof msg === "string" && (isMissingColumnErrorMessage(msg, "chat_id") || isMissingColumnErrorMessage(msg, "group_chat_id"))) {
        continue;
      }
    }
    if (!deleted) throw lastDeleteError ?? new Error("Failed to leave chat");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", detail: serializeError(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

