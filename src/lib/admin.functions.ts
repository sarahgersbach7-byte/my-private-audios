import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type AdminSession = { unlocked?: boolean };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "hoerbereich-admin",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function codeMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Throws when the caller has not entered the access code. */
async function requireUnlocked() {
  const session = await useSession<AdminSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("locked");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  return { unlocked: Boolean(session.data.unlocked) };
});

export const adminUnlock = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PIN"];
    if (!expected) throw new Error("ADMIN_PIN is not configured");
    if (!codeMatches(data.code.trim(), expected)) return { ok: false as const };
    const session = await useSession<AdminSession>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const adminLock = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const adminListAudios = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const db = await admin();
  const { data, error } = await db
    .from("audios")
    .select("id, title, description, group_name, sort_order, storage_path, duration_seconds, published")
    .order("group_name", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

export const adminCreateUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { fileName: string }) => data)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error } = await db.storage.from("audios").createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token };
  });

export const adminInsertAudio = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      title: string;
      description: string | null;
      groupName: string | null;
      storagePath: string;
      durationSeconds: number | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { count } = await db.from("audios").select("id", { count: "exact", head: true });
    const { error } = await db.from("audios").insert({
      title: data.title,
      description: data.description,
      group_name: data.groupName,
      sort_order: (count ?? 0) + 1,
      storage_path: data.storagePath,
      duration_seconds: data.durationSeconds,
    });
    if (error) throw error;
    return { ok: true as const };
  });

export const adminUpdateAudio = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      patch: {
        title?: string;
        description?: string | null;
        group_name?: string | null;
        sort_order?: number;
        published?: boolean;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { error } = await db.from("audios").update(data.patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const adminDeleteAudio = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; storagePath: string }) => data)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    await db.storage.from("audios").remove([data.storagePath]);
    const { error } = await db.from("audios").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const adminListGrants = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const db = await admin();
  const [grants, profiles] = await Promise.all([
    db.from("access_grants").select("id, email, active, note, created_at").order("created_at", { ascending: false }),
    db.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
  ]);
  if (grants.error) throw grants.error;
  if (profiles.error) throw profiles.error;
  return { grants: grants.data ?? [], profiles: profiles.data ?? [] };
});

export const adminAddGrant = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; note: string | null }) => data)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid email");
    const { error } = await db.from("access_grants").insert({ email, note: data.note });
    if (error) throw error;
    return { ok: true as const };
  });

export const adminSetGrantActive = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { error } = await db.from("access_grants").update({ active: data.active }).eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const adminDeleteGrant = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { error } = await db.from("access_grants").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const adminListUsage = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const db = await admin();
  const [events, profiles] = await Promise.all([
    db
      .from("play_events")
      .select("id, user_id, audio_id, device_fingerprint, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("profiles").select("id, email, full_name"),
  ]);
  if (events.error) throw events.error;
  if (profiles.error) throw profiles.error;
  return { events: events.data ?? [], profiles: profiles.data ?? [] };
});

/* ---------- Buch-Codes & Nutzer ---------- */

const CODE_RE = /^[0-9]{6}$/;

export const adminListCodes = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const db = await admin();
  const [codes, profiles] = await Promise.all([
    db.from("book_codes").select("id, code, user_id, linked_at, created_at").order("code"),
    db
      .from("profiles")
      .select("id, email, first_name, last_name, full_name, newsletter, newsletter_at, created_at")
      .order("created_at", { ascending: false }),
  ]);
  if (codes.error) throw codes.error;
  if (profiles.error) throw profiles.error;
  return { codes: codes.data ?? [], profiles: profiles.data ?? [] };
});

export const adminLinkCode = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { codeId: string; email: string; firstName: string | null; lastName: string | null }) =>
      data,
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ungültige E-Mail-Adresse.");

    const { data: codeRow, error } = await db
      .from("book_codes")
      .select("id, code, user_id")
      .eq("id", data.codeId)
      .maybeSingle();
    if (error) throw error;
    if (!codeRow) throw new Error("Code nicht gefunden.");
    if (codeRow.user_id) throw new Error("Dieser Code ist bereits verknüpft. Bitte zuerst trennen.");

    const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    let userId: string;
    if (profile) {
      const { data: other } = await db
        .from("book_codes")
        .select("code")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (other) throw new Error(`Diese E-Mail ist bereits mit Code ${other.code} verknüpft.`);
      const { error: pwError } = await db.auth.admin.updateUserById(profile.id, {
        password: codeRow.code,
      });
      if (pwError) throw new Error("Passwort konnte nicht gesetzt werden.");
      userId = profile.id;
    } else {
      const first = data.firstName?.trim() || null;
      const last = data.lastName?.trim() || null;
      const { data: created, error: createError } = await db.auth.admin.createUser({
        email,
        password: codeRow.code,
        email_confirm: true,
        user_metadata: {
          first_name: first,
          last_name: last,
          full_name: [first, last].filter(Boolean).join(" ") || null,
        },
      });
      if (createError || !created.user) throw new Error("Konto konnte nicht angelegt werden.");
      userId = created.user.id;
    }

    const { error: linkError } = await db
      .from("book_codes")
      .update({ user_id: userId, linked_at: new Date().toISOString() })
      .eq("id", codeRow.id)
      .is("user_id", null);
    if (linkError) throw linkError;
    return { ok: true as const };
  });

export const adminUnlinkCode = createServerFn({ method: "POST" })
  .inputValidator((data: { codeId: string }) => data)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { data: codeRow, error } = await db
      .from("book_codes")
      .select("id, user_id")
      .eq("id", data.codeId)
      .maybeSingle();
    if (error) throw error;
    if (!codeRow?.user_id) return { ok: true as const };
    // The code was the password – replace it so the old code no longer logs in.
    await db.auth.admin.updateUserById(codeRow.user_id, {
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    });
    const { error: unlinkError } = await db
      .from("book_codes")
      .update({ user_id: null, linked_at: null })
      .eq("id", codeRow.id);
    if (unlinkError) throw unlinkError;
    return { ok: true as const };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id: string; firstName: string | null; lastName: string | null; newsletter: boolean }) =>
      data,
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { data: current } = await db
      .from("profiles")
      .select("newsletter, newsletter_at")
      .eq("id", data.id)
      .maybeSingle();
    const first = data.firstName?.trim() || null;
    const last = data.lastName?.trim() || null;
    const { error } = await db
      .from("profiles")
      .update({
        first_name: first,
        last_name: last,
        full_name: [first, last].filter(Boolean).join(" ") || null,
        newsletter: data.newsletter,
        newsletter_at: data.newsletter
          ? current?.newsletter
            ? current.newsletter_at
            : new Date().toISOString()
          : null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const adminAddCodes = createServerFn({ method: "POST" })
  .inputValidator((data: { codes: string[] }) => data)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const codes = Array.from(new Set(data.codes.map((c) => c.trim()).filter((c) => CODE_RE.test(c))));
    if (codes.length === 0) throw new Error("Keine gültigen 6-stelligen Codes gefunden.");
    const { data: inserted, error } = await db
      .from("book_codes")
      .upsert(
        codes.map((code) => ({ code })),
        { onConflict: "code", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw error;
    return { added: inserted?.length ?? 0, total: codes.length };
  });

export const adminDeleteCode = createServerFn({ method: "POST" })
  .inputValidator((data: { codeId: string }) => data)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { error } = await db.from("book_codes").delete().eq("id", data.codeId).is("user_id", null);
    if (error) throw error;
    return { ok: true as const };
  });

export const adminListAppointments = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const db = await admin();
  const { data, error } = await db
    .from("appointment_requests")
    .select("id, user_id, requested_date, requested_time, comment, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((r) => r.user_id))];
  const [{ data: profiles }, { data: codes }] = await Promise.all([
    ids.length ? db.from("profiles").select("id, first_name, last_name, email").in("id", ids) : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }),
    ids.length ? db.from("book_codes").select("user_id, code").in("user_id", ids) : Promise.resolve({ data: [] as { user_id: string | null; code: string }[] }),
  ]);
  const p = new Map((profiles ?? []).map((x) => [x.id, x]));
  const c = new Map((codes ?? []).map((x) => [x.user_id, x.code]));
  return (data ?? []).map((r) => ({
    ...r,
    first_name: p.get(r.user_id)?.first_name ?? null,
    last_name: p.get(r.user_id)?.last_name ?? null,
    email: p.get(r.user_id)?.email ?? null,
    code: c.get(r.user_id) ?? null,
  }));
});

export const adminTelegramStatus = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { getRecipient } = await import("./telegram.server");
  const r = await getRecipient();
  return { configured: Boolean(r.chatId), label: r.label };
});

export const adminTelegramAdoptLatest = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  const { findLatestChat, setRecipient, sendToChat } = await import("./telegram.server");
  const latest = await findLatestChat();
  if (!latest) return { ok: false as const };
  await setRecipient(latest.chatId, latest.label);
  await sendToChat(latest.chatId, "✅ Ab jetzt erhalten Sie hier die Benachrichtigungen der Seelenreisen-Plattform.");
  return { ok: true as const, label: latest.label };
});

export const adminTelegramTest = createServerFn({ method: "POST" }).handler(async () => {
  await requireUnlocked();
  const { getRecipient, sendToChat } = await import("./telegram.server");
  const r = await getRecipient();
  if (!r.chatId) return { ok: false as const };
  await sendToChat(r.chatId, "🔔 Testnachricht von der Seelenreisen-Plattform.");
  return { ok: true as const };
});
