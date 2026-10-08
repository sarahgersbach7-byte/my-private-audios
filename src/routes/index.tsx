import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { registerWithCode } from "@/lib/register.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seelenreisen Hörbereich – Sarah Gersbach" },
      {
        name: "description",
        content:
          "Registrieren Sie sich mit dem Code aus Ihrem Buch und hören Sie die Seelenreisen von Sarah Gersbach.",
      },
      { property: "og:title", content: "Seelenreisen Hörbereich – Sarah Gersbach" },
      {
        property: "og:description",
        content: "Zugang zu den Audios mit dem Code aus Ihrem Buch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RegisterPage,
});

const REASONS: Record<string, string> = {
  invalid_code: "Dieser Code ist nicht gültig. Bitte prüfen Sie die Eingabe.",
  code_taken: "Dieser Code wurde bereits verwendet.",
  email_exists: "Für diese E-Mail-Adresse besteht bereits ein Zugang. Bitte melden Sie sich an.",
  failed: "Die Registrierung hat leider nicht funktioniert. Bitte versuchen Sie es erneut.",
};

function RegisterPage() {
  const navigate = useNavigate();
  const register = useServerFn(registerWithCode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hoerbereich", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await register({
        data: { email, firstName, lastName, code, newsletter },
      });
      if (!result.ok) {
        toast.error(REASONS[result.reason]);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: code,
      });
      if (error) throw error;
      navigate({ to: "/hoerbereich", replace: true });
    } catch {
      toast.error(REASONS["failed"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Sarah Gersbach Seelenreisen
        </p>
        <h1 className="mt-5 text-3xl text-primary sm:text-4xl">Ihr Hörbereich</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Registrieren Sie sich mit dem Code aus Ihrem Buch – danach können Sie die Audios direkt
          anhören.
        </p>

        <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Vorname</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nachname</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <a
              href="https://www.sarah-gersbach.ch/datenschutzerklaerung/"
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-primary underline underline-offset-2 hover:opacity-80"
            >
              Datenschutz
            </a>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <Checkbox
              checked={newsletter}
              onCheckedChange={(v) => setNewsletter(v === true)}
              className="mt-0.5"
            />
            <span>Ja, ich möchte über Neuigkeiten informiert werden.</span>
          </label>

          <div className="rounded-lg border border-primary/30 bg-secondary p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                  Code aus dem Buch
                </Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-36 bg-card text-center font-mono text-lg tracking-[0.3em]"
                />
              </div>
              <p className="max-w-[12rem] flex-1 text-xs leading-relaxed text-secondary-foreground">
                Dieser Code ist gleichzeitig Ihr Passwort. Sie brauchen kein eigenes Passwort.
              </p>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Einen Moment…" : "Registrieren"}
          </Button>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          Schon registriert?{" "}
          <Link to="/auth" className="text-primary underline underline-offset-2">
            Anmelden
          </Link>
        </p>
      </div>
    </main>
  );
}
