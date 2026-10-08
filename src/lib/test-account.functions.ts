import { createServerFn } from "@tanstack/react-start";

export const TEST_EMAIL = "testkonto@seelenreisen.test";
export const TEST_CODE = "000001";

/** Ensures the test account (shortcut login "1" / "1") exists and owns a code. */
export const ensureTestAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  let { data: profile } = await db.from("profiles").select("id").eq("email", TEST_EMAIL).maybeSingle();
  if (!profile) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_CODE,
      email_confirm: true,
      user_metadata: { first_name: "Test", last_name: "Konto", full_name: "Test Konto" },
    });
    if (error || !created.user) throw new Error("Testkonto konnte nicht erstellt werden");
    profile = { id: created.user.id };
  }

  const { data: code } = await db.from("book_codes").select("id, user_id").eq("code", TEST_CODE).maybeSingle();
  if (!code) {
    await db.from("book_codes").insert({ code: TEST_CODE, user_id: profile.id, linked_at: new Date().toISOString() });
  } else if (code.user_id !== profile.id) {
    await db.from("book_codes").update({ user_id: profile.id, linked_at: new Date().toISOString() }).eq("id", code.id);
  }
  return { ok: true };
});
