import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureTestAccount, TEST_CODE, TEST_EMAIL } from "@/lib/test-account.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden – Seelenreisen Hörbereich" },
      {
        name: "description",
        content: "Melden Sie sich mit Ihrer E-Mail-Adresse und dem Code aus Ihrem Buch an.",
      },
      { property: "og:title", content: "Anmelden – Seelenreisen Hörbereich" },
      { property: "og:description", content: "Anmeldung mit E-Mail und Buch-Code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
      let loginEmail = email.trim().toLowerCase();
      let loginCode = code;
      if (loginEmail === "1" && code === "1") {
        await ensureTestAccount();
        loginEmail = TEST_EMAIL;
        loginCode = TEST_CODE;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginCode,
      });
      if (error) {
        toast.error("E-Mail oder Code stimmen nicht.");
        return;
      }
      navigate({ to: "/hoerbereich", replace: true });
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
        <h1 className="mt-5 text-3xl text-primary sm:text-4xl">Willkommen zurück</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Melden Sie sich mit Ihrer E-Mail-Adresse und dem Code aus Ihrem Buch an.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="rounded-lg border border-primary/30 bg-secondary p-5">
            <div className="space-y-2">
              <Label htmlFor="code" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                Code aus dem Buch
              </Label>
              <Input
                id="code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-36 bg-card text-center font-mono text-lg tracking-[0.3em]"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy}
          >
            {busy ? "Einen Moment…" : "Anmelden"}
          </Button>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          Noch nicht registriert?{" "}
          <Link to="/" className="text-primary underline underline-offset-2">
            Zur Registrierung
          </Link>
        </p>
      </div>
    </main>
  );
}
