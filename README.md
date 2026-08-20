# Euro Fantasy Lab

Analitika za EuroLeague Fantasy. Next.js 14 (App Router) + Supabase + Tailwind.

## Pokretanje

```bash
npm install
cp .env.example .env.local     # popuni svoje ključeve
npm run dev
```

## Promenljive okruženja

| Ključ | Gde se nalazi | Javno? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | da |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | da |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | **ne** |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | PayPal → Apps & Credentials | ne |
| `PAYPAL_WEBHOOK_ID` | PayPal → Webhooks | ne |
| `PAYPAL_ENV` | `sandbox` ili `live` | ne |

`service_role` ključ ima puna prava nad bazom. Nikad ga ne stavljaj u
`NEXT_PUBLIC_` i nikad ga ne komituj.

## Postavljanje na Vercel

1. `git init && git add . && git commit -m "prvi"`
2. Napravi repo na GitHubu i `git push`
3. Vercel → New Project → izaberi repo
4. Settings → Environment Variables → dodaj sve iz `.env.example`
5. Deploy

Supabase → Authentication → URL Configuration → dodaj Vercel adresu
u **Site URL** i **Redirect URLs**, inače potvrda mejla neće raditi.

## Struktura

```
src/
  app/
    page.tsx              početna, izbor kola
    igra/                 igra kola — glasanje
    raspored/             utakmice + predikcije
    igraci/               izbori kola, zaključani po paketu
    baza/                 svih 312 igrača
    profil/               paketi, statistika, istorija
    prijava/              registracija i prijava
    api/
      kod/                unos pristupnog koda
      listic/             čuvanje i čitanje listića
      paypal/webhook/     automatska pretplata posle uplate
  components/             Nav, PlayerCard, PlayerPhoto, FixtureCard, GameBoard, TierGate
  lib/
    supabase/client.ts    klijent za pregledač
    supabase/server.ts    klijent za server + admin klijent
    data.ts               svi upiti nad bazom
    types.ts, format.ts
  middleware.ts           osvežavanje sesije
```

## Slike igrača

Idu u Supabase Storage, javni bucket `players`, a grbovi u `logos`.
Ime fajla mora da odgovara koloni `photo` u tabeli `players`
(npr. `players/hayes-k-par.png`).

Dok slike nema, `PlayerPhoto` crta kartu sa inicijalima, brojem dresa i
bojom izvedenom iz koda tima — mreža izgleda namerno, ne prazno.

**Pravna napomena:** fotografije igrača su nečije vlasništvo. Za komercijalnu
upotrebu treba ti licenca (agencija) ili dozvola kluba.

## PayPal

Webhook adresa: `https://tvoj-sajt.vercel.app/api/paypal/webhook`
Događaj: `PAYMENT.CAPTURE.COMPLETED`

Pri pravljenju narudžbine prosledi `custom_id` = id korisnika iz Supabase,
da bi webhook znao kome da doda pretplatu. Potpis se proverava kod PayPal-a —
bez toga bi svako mogao da pošalje lažnu uplatu na tu adresu.

Dok ne uključiš PayPal, pretplatu izdaješ kodom:

```sql
insert into access_codes (code, tier, days, note)
values ('EFL-PRO-7K2M', 'PRO', 30, 'PayPal, Marko, 20e');
```

## Posle kola

```sql
update fixtures set home_score = 90, away_score = 85 where id = 1;
update challenge_lines set result = 'over' where id = 1;
select obracunaj_kolo(1);
```

Poslednja linija obeleži tačne odgovore, izračuna tačnost i svima sa 9/10
automatski doda PRO na 8 dana.

## Ubacivanje slika

Slike stavi u `public/slike/players/` (ime fajla = id igrača, npr. `james-m-efs.png`)
i `public/slike/logos/` (ime = kod tima, npr. `par.png`), pa pokreni:

```bash
npm run slike
```

Skripta napravi javne buckete ako ne postoje, pošalje fajlove, upiše putanju u
`players.photo` odnosno `teams.logo`, i preskoči sve za šta u bazi nema para.
Na kraju ispiše koliko igrača ima sliku a koliko ne.

Traži `SUPABASE_SERVICE_ROLE_KEY` u `.env.local` — pokreće se lokalno, nikad na sajtu.
