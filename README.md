# Euro Fantasy Lab

Analitika za EuroLeague Fantasy. Next.js 14 (App Router) + Supabase + Tailwind.

Za izgled i pravila interfejsa vidi [DIZAJN.md](DIZAJN.md).

## Pokretanje

```bash
npm install
cp .env.example .env.local     # popuni svoje ključeve
npm run dev
```

Aplikacija radi i pre nego što je baza popunjena. Ako za tekuće kolo nema
cena u `player_rounds`, sloj podataka sam napravi **demo brojeve nad
pravim igračima i pravim mečevima iz tvoje baze** — imena, timovi i
protivnici su tačni, samo su cene i projekcije demonstracione. Futer u
tom slučaju to i napiše. Tek ako je baza sasvim prazna, koristi se
izmišljen sastav iz `src/lib/mock.ts`.

## Provere

```bash
npx tsc --noEmit     # tipovi
npm run lint         # ESLint (next/core-web-vitals)
npm run build        # produkcijski build
```

## Promenljive okruženja

| Ključ | Gde se nalazi | Javno? | Obavezno? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | da | da |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | da | da |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | **ne** | za naplatu |
| `NEXT_PUBLIC_SITE_URL` | adresa sajta | da | preporučeno |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | PayPal → Apps & Credentials | ne | za naplatu |
| `PAYPAL_WEBHOOK_ID` | PayPal → Webhooks | ne | za naplatu |
| `PAYPAL_ENV` | `sandbox` ili `live` | ne | da |

`service_role` ključ ima puna prava nad bazom. Nikad ga ne stavljaj u
`NEXT_PUBLIC_` i nikad ga ne komituj.

Bez PayPal ključeva aplikacija radi normalno — samo umesto dugmeta za
plaćanje piše da se paket otključava pristupnim kodom.

## Struktura

```
src/
  app/
    page.tsx              početna — analiza kola i pregled proizvoda
    igra/                 moj tim — kadar, formacija, kapiten, trener
    optimizator/          preporučene zamene, Premium
    raspored/             mečevi kola, procene i izazov kola (glasanje)
    igraci/               izbori kola, zaključani po paketu
    baza/                 svi igrači, tabela + sastavi po timovima
    profil/               nalog, paket, uplate, statistika
    prijava/              registracija i prijava
    placanje/             ishod plaćanja: uspeh / otkazano
    api/
      kod/                unos pristupnog koda
      listic/             čuvanje i čitanje listića
      optimizator/        račun optimizacije + odsecanje po paketu
      paypal/order/       pravljenje narudžbine
      paypal/return/      naplata i dodela prava po povratku
      paypal/webhook/     provera potpisa, idempotentna obrada
  components/
    brand/                Logomark, Lockup
    ui/                   Button, primitives, Stat, Segmented, CourtBackdrop
    player/               PlayerIdentity, PlayerTable, TeamRoster, Avatar…
    fixtures/             FixtureRow
    team/                 LineupBuilder, CourtLineup
    game/                 ChallengeBoard, Leaderboard
    optimizer/            OptimizerView
    premium/              PricingTable, CheckoutButton
    nav/                  links, CodeDialog
  lib/
    config.ts             cene, paketi, pravila sastava — jedno mesto
    data.ts               upiti + rezervni demo podaci
    optimizer.ts          račun optimizacije i provera sastava
    entitlements.ts       dodela prava posle uplate
    paypal/               serverski PayPal sloj
    supabase/             klijent za pregledač i za server
supabase/migrations/      SQL migracije
```

## Pravila fantasy takmičenja

Postava prati zvanična pravila EuroLeague Fantasy Challenge takmičenja i
sve je na jednom mestu, u `src/lib/config.ts`:

- **kadar**: 4 beka, 4 krila, 2 centra i 1 trener — tačno, ne najmanje
- **budžet**: 100 kredita (trener se plaća iz istog budžeta)
- **formacije prve petorke**: 2-2-1, 3-1-1, 1-3-1, 1-2-2, 2-1-2 (bek–krilo–centar)
- **bodovanje**: petorka 100%, kapiten 150%, šesti igrač 100%, klupa 50%, trener 100%

Račun i provera su u `src/lib/lineup.ts`, a optimizator u
`src/lib/optimizer.ts` računa **učinak na mestu u postavi** — zamena u
petorci vredi punu razliku, na klupi polovinu, kod kapitena 1.5×.

Treneri dolaze iz tabele `coaches`; dok je nema, izvodi se po jedan
trener po timu iz rasporeda i označava imenom tima.

## Baza

Migracija `supabase/migrations/0001_placanja.sql` je **dodatna** — ne
briše ništa i može se pokrenuti više puta. Nalepi je u Supabase →
SQL Editor. Dodaje:

- kolone za PayPal na `subscriptions` (`paypal_id`, `paypal_order_id`,
  `plan_code`, `status`, `starts_at`, `amount_cents`, `currency`)
- **jedinstveni indeks nad `paypal_id`** — poslednja odbrana od dvostruke
  dodele paketa
- tabelu `paypal_events` za idempotentnu obradu webhook-a
- RLS: korisnik vidi samo svoje pretplate, upisuje isključivo server
- `moj_tier(uuid)` — samo ako funkcija još ne postoji; postojeća se ne dira

## Plaćanje

Model je **jednokratna uplata koja otključava paket na 30 dana** — isto
što već rade `subscriptions.ends_at` i pristupni kodovi. Nema automatske
obnove i nema šta da se otkazuje.

Cene su na jednom mestu, u `src/lib/config.ts`. Iznos **nikad** ne dolazi
iz pregledača — server ga čita iz tog kataloga.

Tok:

```
korisnik → /api/paypal/order → PayPal → /api/paypal/return
                                            ↓ naplata + provera
                                        subscriptions
                                            ↑ isto radi i webhook
```

Ko god stigne prvi upisuje pravo; drugi vidi da je već upisano i ne dira
ništa. Dolazak na `/placanje/uspeh` sam po sebi ne otključava ništa —
stranica čita stvarno stanje naloga iz baze.

### Webhook

Adresa: `https://tvoj-sajt/api/paypal/webhook`

Događaji: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`,
`PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`

Potpis se proverava kod PayPal-a. **Bez `PAYPAL_WEBHOOK_ID` događaji se
odbijaju** — inače bi svako mogao da pošalje lažnu uplatu na tu adresu i
sam sebi uključi paket.

### Kodovi umesto plaćanja

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

## Slike

Slike idu u Supabase Storage, javni bucket `players`, grbovi u `logos`.
Ime fajla mora da odgovara koloni `photo` u tabeli `players`
(npr. `players/hayes-k-par.jpg`).

```bash
# stavi fajlove u public/slike/players/ i public/slike/logos/, pa:
npm run slike
```

Skripta traži `SUPABASE_SERVICE_ROLE_KEY` u `.env.local` — pokreće se
lokalno, nikad na sajtu.

Dok slike nema, `PlayerPhoto` i `Avatar` crtaju pločicu sa inicijalima i
bojom izvedenom iz koda tima — mreža izgleda namerno, ne prazno.

**Pravna napomena:** fotografije igrača su nečije vlasništvo. Za
komercijalnu upotrebu treba ti licenca (agencija) ili dozvola kluba.

## Postavljanje na Vercel

1. `git add . && git commit -m "…"` i `git push`
2. Vercel → New Project → izaberi repo
3. Settings → Environment Variables → dodaj sve iz `.env.example`
4. Deploy
5. Supabase → Authentication → URL Configuration → dodaj Vercel adresu
   u **Site URL** i **Redirect URLs**, inače potvrda mejla neće raditi
6. PayPal → Webhooks → dodaj `https://tvoj-sajt/api/paypal/webhook`
   i upiši dobijeni `PAYPAL_WEBHOOK_ID` u okruženje
