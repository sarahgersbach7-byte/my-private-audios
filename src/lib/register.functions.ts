import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const registerInput = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  code: z.string().trim().regex(/^[0-9]{6}$/),
  newsletter: z.boolean(),
});

type RegisterResult =
  | { ok: true }
  | { ok: false; reason: "invalid_code" | "code_taken" | "email_exists" | "failed" };

/**
 * Public registration: creates an account whose password is the book code
 * and links the code to it. A code can only ever belong to one account.
 */
export const registerWithCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerInput.parse(data))
  .handler(async ({ data }): Promise<RegisterResult> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { data: codeRow, error: codeError } = await db
      .from("book_codes")
      .select("id, user_id")
      .eq("code", data.code)
      .maybeSingle();
    if (codeError) throw codeError;
    if (!codeRow) return { ok: false, reason: "invalid_code" };
    if (codeRow.user_id) return { ok: false, reason: "code_taken" };

    const { data: existing } = await db
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing) return { ok: false, reason: "email_exists" };

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: data.email,
      password: data.code,
      email_confirm: true,
      user_metadata: {
        first_name: data.firstName,
        last_name: data.lastName,
        full_name: `${data.firstName} ${data.lastName}`,
      },
    });
    if (createError || !created.user) {
      const msg = createError?.message?.toLowerCase() ?? "";
      if (msg.includes("already")) return { ok: false, reason: "email_exists" };
      console.error("registerWithCode createUser", createError);
      return { ok: false, reason: "failed" };
    }
    const userId = created.user.id;

    // Atomic claim: only succeeds if the code is still free.
    const { data: claimed, error: claimError } = await db
      .from("book_codes")
      .update({ user_id: userId, linked_at: new Date().toISOString() })
      .eq("id", codeRow.id)
      .is("user_id", null)
      .select("id");
    if (claimError || !claimed || claimed.length === 0) {
      await db.auth.admin.deleteUser(userId);
      return { ok: false, reason: claimError ? "failed" : "code_taken" };
    }

    await db
      .from("profiles")
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        full_name: `${data.firstName} ${data.lastName}`,
        newsletter: data.newsletter,
        newsletter_at: data.newsletter ? new Date().toISOString() : null,
      })
      .eq("id", userId);

    const { notifyTelegram, escapeHtml } = await import("./telegram.server");
    await notifyTelegram(
      [
        "<b>Neue Registrierung</b>",
        "",
        `<b>Name:</b> ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}`,
        `<b>E-Mail:</b> ${escapeHtml(data.email)}`,
        `<b>Buch-Code:</b> ${data.code}`,
        `<b>Neuigkeiten:</b> ${data.newsletter ? "Ja" : "Nein"}`,
      ].join("\n"),
    );

    return { ok: true };
  });
