import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().trim().min(1).max(20),
  comment: z.string().trim().max(2000).optional().default(""),
});

export const requestAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { notifyTelegram, escapeHtml } = await import("./telegram.server");
    const userId = context.userId;

    const [{ data: profile }, { data: code }] = await Promise.all([
      db.from("profiles").select("first_name, last_name, email").eq("id", userId).maybeSingle(),
      db.from("book_codes").select("code").eq("user_id", userId).maybeSingle(),
    ]);
    if (!code) return { ok: false as const, reason: "no_access" as const };

    const { error } = await db.from("appointment_requests").insert({
      user_id: userId,
      requested_date: data.date,
      requested_time: data.time,
      comment: data.comment || null,
    });
    if (error) throw error;

    const [y, m, d] = data.date.split("-");
    const e = (v: string | null | undefined) => escapeHtml(v ?? "–");
    await notifyTelegram(
      [
        "<b>Neue Anfrage: 1:1 Seelenreise</b>",
        "",
        `<b>Name:</b> ${e(profile?.first_name)} ${e(profile?.last_name)}`,
        `<b>E-Mail:</b> ${e(profile?.email)}`,
        `<b>Buch-Code:</b> ${e(code.code)}`,
        `<b>Wunschdatum:</b> ${d}.${m}.${y}`,
        `<b>Uhrzeit:</b> ${e(data.time)}`,
        `<b>Kommentar:</b> ${e(data.comment || "–")}`,
        "",
        `Eingegangen: ${new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}`,
      ].join("\n"),
    );
    return { ok: true as const };
  });
