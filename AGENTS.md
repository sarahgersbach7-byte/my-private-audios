<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Customer access = a row in `book_codes` linked to the user; the 6-digit code is the account password (registration and admin linking run server-side with the admin client). Why: books carry the codes, no separate password.
- `/verwaltung` is gated by an encrypted session cookie + ADMIN_PIN, not by accounts. Why: management must work without login.
- Telegram notifications are sent server-side with TELEGRAM_BOT_TOKEN; the recipient chat id lives in `app_settings` and is set from /verwaltung. Why: recipient must be changeable without code changes.
