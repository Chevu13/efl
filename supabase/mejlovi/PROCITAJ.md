# Mejlovi

**Mejlove šalje sajt preko Resend-a, ne Supabase.** Ugrađeni Supabase mejler
šalje 3 poruke na sat i završava u spamu, pa je registracija na njemu stajala
na pola. Sada ide ovako:

```
/api/registracija  →  admin.generateLink('signup')    →  Resend  →  mejl
/api/lozinka       →  admin.generateLink('recovery')  →  Resend  →  mejl
mejl → /auth/potvrda?token_hash=…&type=…  →  verifyOtp  →  sesija  →  cilj
```

Šablon i slanje su u `src/lib/mejl.ts`. HTML fajlovi u ovom folderu su ostali
kao rezerva ako se ikad vratiš na Supabase mejler — nisu u upotrebi.

## Šta treba podesiti

**1. Resend** → https://resend.com/api-keys

U `.env.local` (i u Vercel → Settings → Environment Variables):

```
RESEND_API_KEY=re_…
RESEND_FROM=Euro Fantasy Lab <nalog@eurofantasylab.com>
NEXT_PUBLIC_SITE_URL=https://tvoj-sajt.vercel.app
```

`RESEND_FROM` mora biti adresa sa domena potvrđenog u Resend-u
(Domains → Add Domain → DNS zapisi). Dok domen nije potvrđen radi jedino
`onboarding@resend.dev`, i to samo ka tvojoj sopstvenoj adresi.

**Bez `RESEND_API_KEY`** sajt i dalje radi: nalog se pravi odmah potvrđen i
korisnik se prijavljuje bez mejla, a „zaboravljena lozinka” javlja da slanje
nije podešeno.

**2. Google prijava** → Supabase → Authentication → Providers → Google

Trenutno je isključena. Treba:
- Google Cloud Console → APIs & Services → Credentials → OAuth client ID
  (tip: Web application)
- Authorized redirect URI: `https://ipkojwfhikunlwnmmdmg.supabase.co/auth/v1/callback`
- Client ID i Client Secret nalepiti u Supabase i uključiti provajder

Dok je isključena, dugme „Nastavi preko Google naloga” vodi na Supabase-ovu
stranicu sa greškom `provider is not enabled`.

**3. URL Configuration** → Authentication → URL Configuration

- Site URL: `http://localhost:3000` lokalno, kasnije Vercel adresa
- Redirect URLs:
  ```
  http://localhost:3000/auth/callback
  https://tvoj-sajt.vercel.app/auth/callback
  ```

Ovo je potrebno zbog Google prijave. Naši mejlovi ne prolaze kroz ovaj spisak
jer link pravimo sami.

## Logo u mejlu

`src/lib/mejl.ts` traži `logos/mark.png` u Storage bucketu `logos`. Dok ga ne
ubaciš, slika je prazna — sve ostalo radi. Stavi kvadratni PNG, oko 120×120,
sa providnom pozadinom.
