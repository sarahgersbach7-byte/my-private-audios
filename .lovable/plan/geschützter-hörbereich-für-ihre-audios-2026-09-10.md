# Geschützter Hörbereich für Ihre Audios

Eine kleine, geschlossene Plattform, die Sie neben Ihrer bestehenden Webseite betreiben. Käufer melden sich persönlich an und hören dort Ihre Audios. Wer nicht freigeschaltet ist, sieht nichts.

## So funktioniert es

Für Ihre Kunden:
1. Sie erhalten nach dem Kauf eine Einladung mit Link.
2. Sie melden sich mit ihrer E-Mail-Adresse und einem eigenen Passwort an.
3. Sie sehen die Übersicht der Audios und können sie direkt abspielen – Fortschritt wird gemerkt, Vor- und Zurückspulen ist möglich.

Für Sie:
1. Ein eigener, nur für Sie sichtbarer Verwaltungsbereich.
2. Käufer freischalten, sperren oder wieder entfernen.
3. Audios hochladen, benennen, beschreiben, sortieren und in Gruppen (z.B. Module) einteilen.
4. Sehen, wer sich angemeldet hat und was gehört wurde.

## Schutz gegen Weitergabe

- Jeder Zugang ist persönlich; ein Zugang lässt sich einzeln sperren, ohne alle anderen zu beeinträchtigen.
- Kein Download-Knopf, kein Zugriff über eine kopierbare Dateiadresse: Die Audios werden nur für angemeldete Zugänge und nur für kurze Zeit abspielbar bereitgestellt.
- Auffällige Nutzung erkennbar: Wenn ein Zugang aus sehr vielen Geräten oder ungewöhnlich häufig genutzt wird, wird das im Verwaltungsbereich markiert.
- Der Name der Käuferin/des Käufers wird dezent im Hörbereich angezeigt – das hält von Weitergabe von Bildschirmaufnahmen ab.
- Hundertprozentiger Schutz ist technisch nicht möglich (mithören lässt sich immer mitschneiden). Diese Kombination macht Weitergabe aber deutlich unattraktiv und nachvollziehbar.

## Seiten

- Startseite mit kurzer Erklärung und Anmeldeknopf (keine Inhalte sichtbar).
- Anmelden / Passwort vergessen.
- Hörbereich mit Audio-Liste und Player.
- Verwaltungsbereich für Sie: Audios und Zugänge.

## Technische Umsetzung

- Lovable Cloud für Anmeldung, Datenbank und Dateispeicher.
- Tabellen: `audios` (Titel, Beschreibung, Gruppe, Reihenfolge, Dateipfad), `profiles`, `user_roles` (separate Rollentabelle, `admin`/`listener`), `access_grants` (freigeschaltet ja/nein), `play_events` (Wiedergabe-Protokoll für Auffälligkeiten).
- Zeilenschutz (RLS) auf allen Tabellen: Hörer sehen nur eigene Daten; Audio-Metadaten nur bei aktiver Freischaltung; Verwaltung nur über `has_role(auth.uid(), 'admin')`.
- Audio-Dateien in einem privaten Storage-Bucket. Abspielen über eine Server-Funktion, die die Freischaltung prüft und eine kurzlebige signierte URL (z.B. 60 Min.) zurückgibt. Keine öffentlichen Bucket-Pfade.
- Geschützte Seiten unter `src/routes/_authenticated/`, Verwaltung zusätzlich rollengeprüft.
- Upload und Freischaltungen über `createServerFn` mit Auth-Middleware.

## Offene Punkte

- Ihre E-Mail-Adresse für das erste Administrator-Konto.
- Anzahl der Audios und gewünschte Gruppierung.
- Optische Richtung (Farben, Schrift) – gern passend zu Ihrer bestehenden Webseite; dafür brauche ich deren Adresse.
