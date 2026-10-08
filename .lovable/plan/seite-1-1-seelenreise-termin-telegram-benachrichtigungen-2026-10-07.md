# Seite „1:1 Seelenreise“ (/termin) + Telegram-Benachrichtigungen

Ja, das geht mit einem Telegram-Bot, ganz ohne Calendly.

## Was du mir geben musst (kurze Anleitung)

1. Öffne in Telegram den Chat **@BotFather** und schreibe `/newbot`.
2. Gib einen Namen ein (z.B. „Seelenreisen Benachrichtigung“) und einen Benutzernamen, der auf `bot` endet.
3. BotFather schickt dir einen **Token**. Ihn musst du mir nicht in den Chat schreiben: Wenn ich mit dem Bauen anfange, erscheint hier ein Fenster „Telegram verbinden“, in das du ihn einfügst.
4. Öffne deinen neuen Bot in Telegram und drücke **Start** (bzw. schreibe ihm „hallo“). Erst dann darf er dir schreiben.
5. **Empfänger festlegen oder wechseln:** Wer die Nachrichten bekommen soll (z.B. Sarah), öffnet t.me/sarahterminbot und drückt **Start**. Danach klickt man in der Verwaltung unter „Telegram-Empfänger“ auf **„Letzte Person übernehmen“**. Ab dann gehen alle Nachrichten nur noch an diese Person. Du als Ersteller bekommst danach nichts mehr. Den Empfänger kann man so jederzeit wechseln, ohne mich zu fragen. Dort steht auch ein Knopf **„Testnachricht senden“**.

Falls die Nachrichten an mehrere Personen gehen sollen, kann man eine Telegram-Gruppe nehmen und den Bot dort hinzufügen.

## Was gebaut wird

**Seite /termin, Titel „1:1 Seelenreise“** (nur für angemeldete Nutzer mit Buch-Code)
- Gleiches Design wie der Rest (Creme, Violett als Akzentfarbe).
- Ein Kalender zur Auswahl des Datums (vergangene Tage sind gesperrt).
- Ein separates Feld für die Uhrzeit.
- Ein Kommentarfeld.
- Name, E-Mail und Code werden automatisch vom Konto übernommen.
- Man kann beliebig oft Anfragen senden. Danach erscheint eine Bestätigung, dass die Anfrage angekommen ist.
- Im Hörbereich kommt ein dezenter Link „1:1 Seelenreise anfragen“ dazu.

**Telegram-Nachricht bei Terminanfrage:** Sie enthält Vorname, Nachname, E-Mail, Buch-Code, Wunschdatum, Uhrzeit, Kommentar und den Zeitpunkt der Anfrage.

**Telegram-Nachricht bei jeder neuen Registrierung:** Sie enthält Vorname, Nachname, E-Mail, Buch-Code und ob Neuigkeiten gewünscht sind.

**Verwaltung:** Ein neuer Tab „Terminanfragen“ listet alle Anfragen. So geht nichts verloren, falls Telegram einmal nicht erreichbar ist.

Sonst wird nichts verändert.

## Technische Details

- Telegram-Connector über `standard_connectors--connect`. Versand serverseitig über das Gateway (`sendMessage`, HTML-Format, Werte escaped). Die Chat-ID wird einmalig über `getUpdates` ermittelt und als Secret `TELEGRAM_CHAT_ID` gespeichert.
- Neue Tabelle `appointment_requests` (id, user_id, date, time, comment, created_at) mit GRANTs und RLS: Nutzer dürfen nur eigene Einträge einfügen und lesen. Die Verwaltung liest über den Admin-Client hinter dem PIN-Cookie.
- `src/lib/telegram.server.ts` enthält `notifyTelegram(text)`. Fehler dort werden nur geloggt und blockieren weder Registrierung noch Anfrage.
- `src/lib/appointment.functions.ts` enthält `requestAppointment` (requireSupabaseAuth, zod-Validierung, Profil und Code laden, Eintrag speichern, Telegram benachrichtigen) und `adminListAppointments`.
- `registerWithCode` ruft nach erfolgreicher Registrierung `notifyTelegram` auf.
- Neue Route `src/routes/_authenticated/termin.tsx` mit Kalender und Popover aus shadcn, `head()` mit eigenem Titel und noindex.
