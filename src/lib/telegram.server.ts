// Server-only Telegram helpers. The recipient chat id lives in app_settings
// so it can be changed from the Verwaltung without redeploying.

const RECIPIENT_KEY = "telegram_chat_id";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function botUrl(method: string) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return `https://api.telegram.org/bot${token}/${method}`;
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function getRecipient(): Promise<{ chatId: string | null; label: string | null }> {
  const client = await db();
  const { data } = await client
    .from("app_settings")
    .select("key, value")
    .in("key", [RECIPIENT_KEY, "telegram_chat_label"]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return { chatId: map.get(RECIPIENT_KEY) ?? null, label: map.get("telegram_chat_label") ?? null };
}

export async function setRecipient(chatId: string, label: string) {
  const client = await db();
  const now = new Date().toISOString();
  const { error } = await client.from("app_settings").upsert([
    { key: RECIPIENT_KEY, value: chatId, updated_at: now },
    { key: "telegram_chat_label", value: label, updated_at: now },
  ]);
  if (error) throw error;
}

/** Latest person/group that wrote to the bot (e.g. pressed Start). */
export async function findLatestChat(): Promise<{ chatId: string; label: string } | null> {
  const res = await fetch(botUrl("getUpdates"), { method: "POST" });
  if (!res.ok) throw new Error(`Telegram getUpdates failed [${res.status}]: ${await res.text()}`);
  const body = (await res.json()) as {
    result?: Array<{ message?: { chat?: { id: number; first_name?: string; last_name?: string; title?: string; username?: string } } ; my_chat_member?: { chat?: { id: number; title?: string; first_name?: string } } }>;
  };
  const updates = body.result ?? [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i]; const chat = u?.message?.chat ?? u?.my_chat_member?.chat;
    if (chat?.id) {
      const c = chat as { id: number; first_name?: string; last_name?: string; title?: string; username?: string };
      const label =
        c.title ?? ([c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || String(c.id));
      return { chatId: String(c.id), label };
    }
  }
  return null;
}

export async function sendToChat(chatId: string, html: string) {
  const res = await fetch(botUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML" }),
  });
  if (!res.ok) throw new Error(`Telegram sendMessage failed [${res.status}]: ${await res.text()}`);
}

/** Best effort: never throws, so registrations/requests are never blocked. */
export async function notifyTelegram(html: string) {
  try {
    const { chatId } = await getRecipient();
    if (!chatId) {
      console.warn("Telegram: no recipient configured");
      return;
    }
    await sendToChat(chatId, html);
  } catch (error) {
    console.error("Telegram notify failed", error);
  }
}
