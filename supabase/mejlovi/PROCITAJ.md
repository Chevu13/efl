# Mejlovi

Supabase → Authentication → Emails

| Šablon | Fajl | Subject |
|---|---|---|
| Confirm signup | `potvrda-naloga.html` | Potvrdi nalog — Euro Fantasy Lab |
| Reset password | `nova-lozinka.html` | Nova lozinka — Euro Fantasy Lab |

## Pre nego što nalepiš

**Authentication → URL Configuration**

- Site URL: `http://localhost:3000` dok radiš lokalno, kasnije Vercel adresa
- Redirect URLs (dodaj oba, jedan po red):
  ```
  http://localhost:3000/auth/callback
  https://tvoj-sajt.vercel.app/auth/callback
  ```

Bez ovoga link iz mejla vodi na pogrešnu adresu i prijava ne prolazi.

## Logo u mejlu

Šablon traži `logos/mark.png` u Storage bucketu `logos`. Dok ga ne ubaciš,
slika će biti prazna — sve ostalo radi normalno. Stavi kvadratni PNG,
oko 120×120, sa providnom pozadinom.

## Ograničenje besplatnog Supabase mejla

Ugrađeni mejl servis šalje **3 poruke na sat** i završava u spamu češće nego
sopstveni. Čim budeš imao prve korisnike, poveži svoj SMTP:
Authentication → SMTP Settings (Resend, Brevo i SendGrid imaju besplatan nivo).
