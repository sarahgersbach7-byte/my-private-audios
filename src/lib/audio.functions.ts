import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const playbackInput = z.object({
  audioId: z.string().uuid(),
  deviceFingerprint: z.string().max(120).optional(),
});

/**
 * Returns a short-lived signed URL for one audio file.
 * The row lookup runs as the signed-in user, so RLS decides whether the
 * person is allowed to hear it. Only then is a signed URL minted.
 */
export const getPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => playbackInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: audio, error } = await supabase
      .from("audios")
      .select("id, storage_path, published")
      .eq("id", data.audioId)
      .maybeSingle();

    if (error) throw error;
    if (!audio || !audio.published) {
      throw new Error("Dieses Audio ist für Ihren Zugang nicht freigeschaltet.");
    }

    // Signed as the user, so the storage policy re-checks the entitlement.
    const { data: signed, error: signError } = await supabase.storage
      .from("audios")
      .createSignedUrl(audio.storage_path, 60 * 60);

    if (signError || !signed) {
      throw new Error("Die Audiodatei konnte nicht geladen werden.");
    }

    await supabase.from("play_events").insert({
      user_id: userId,
      audio_id: audio.id,
      device_fingerprint: data.deviceFingerprint ?? null,
    });

    return { url: signed.signedUrl };
  });
