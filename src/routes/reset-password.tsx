import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Neues Passwort – Seelenreisen Hörbereich" },
      { name: "description", content: "Setzen Sie ein neues Passwort für Ihren Hörzugang." },
      { property: "og:title", content: "Neues Passwort – Seelenreisen Hörbereich" },
      { property: "og:description", content: "Passwort für den Hörbereich neu setzen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ihr neues Passwort ist gespeichert.");
    navigate({ to: "/hoerbereich", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
        <h1 className="text-3xl text-primary">Neues Passwort</h1>
        <p className="text-sm text-muted-foreground">
          Wählen Sie ein neues Passwort mit mindestens 8 Zeichen.
        </p>
        <div className="space-y-2">
          <Label htmlFor="password">Neues Passwort</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          Passwort speichern
        </Button>
      </form>
    </main>
  );
}
