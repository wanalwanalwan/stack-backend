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
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!isUuid(chat_id) || name.length === 0) {
      return new Response(JSON.stringify({ error: "chat_id (UUID) and name are required" }), {
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
    let canEdit = creatorId === user.id;
    if (!canEdit) {
      const memberLookups = [
        admin
          .from("group_chat_members")
          .select("role")
          .eq("chat_id", chat_id)
          .eq("user_id", user.id)
          .maybeSingle(),
        admin
          .from("group_chat_members")
          .select("role")
          .eq("group_chat_id", chat_id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ];

      let me: { role?: string } | null = null;
      for (const p of memberLookups) {
        const { data, error } = await p;
        if (error) {
          const msg = (error as { message?: string } | null)?.message;
          if (typeof msg === "string" && (isMissingColumnErrorMessage(msg, "chat_id") || isMissingColumnErrorMessage(msg, "group_chat_id"))) {
            continue;
          }
          throw error;
        }
        me = data as unknown as { role?: string } | null;
        break;
      }
      canEdit = me?.role === "admin";
    }

    if (!canEdit) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updateError } = await admin
      .from("group_chats")
      .update({ name })
      .eq("id", chat_id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, chat: updated }), {
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

