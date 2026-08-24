# Euro Fantasy Lab — dizajn sistem

Jedan izvor istine za izgled proizvoda. Ako nesto nije ovde, ne postoji —
pravi se komponenta ili token, ne novi niz klasa u stranici.

---

## 1. Brend

| | |
|---|---|
| Ime | Euro Fantasy Lab |
| Brendmark | Krug u obliku kosarkaske lopte sa blok slovima **EFL** |
| Puni logotip | EURO / FANTASY / LAB |
| Narandzasta | `#DF6320` |
| Bela | `#FFFFFF` |
| Crna | `#000000` |

Proizvod je taman. Sve povrsine su izvedene iz crne, narandzasta je
**iskljucivo** akcija i naglasak. Drugih brend boja nema — bez plave,
ljubicaste, neonske.

**Gde stoji logo**

- `src/components/brand/Logomark.tsx` — sam mark, slova su crtana kao
  pravougaonici pa izgleda isto bez obzira na ucitan font
- `src/components/brand/Lockup.tsx` — mark + rec, `inline` i `stacked`
- `public/brand/efl-mark.svg`, `src/app/icon.svg` — isti crtez kao fajl

> Ovo je verna rekonstrukcija iz brend prirucnika. Kad stigne originalni
> vektor, zameni putanje u te tri datoteke — ostatak aplikacije se ne dira.

---

## 2. Boje

Definisane u `tailwind.config.ts`.

### Povrsine

| Token | Vrednost | Upotreba |
|---|---|---|
| `bg` | `#08090B` | podloga stranice |
| `sunken` | `#050608` | uvuceni delovi, futer, podnozja panela |
| `surface` | `#101215` | paneli, redovi tabele |
| `elev` | `#171A1E` | hover, sitne plocice |
| `raise` | `#1E2227` | lebdeci elementi, savet uz podatak |

### Linije

| Token | Vrednost |
|---|---|
| `line` | `#23262B` |
| `line-2` | `#31353C` |

### Tipografija

| Token | Vrednost | Kontrast na `bg` | Upotreba |
|---|---|---|---|
| `ink` | `#FFFFFF` | 19.9:1 | naslovi, glavni brojevi |
| `ink-2` | `#C9CDD3` | 12.3:1 | tekst, sekundarni podaci |
| `ink-3` | `#969CA6` | 6.6:1 | opisi, oznake |
| `ink-4` | `#7D838D` | 4.6:1 | **najtisi ton koji jos prolazi AA** |

Ispod `ink-4` se ne ide. Sitne sive oznake moraju da se citaju.

### Brend i semantika

| Token | Vrednost | Upotreba |
|---|---|---|
| `brand` | `#DF6320` | akcija, pozitivna razlika, aktivno stanje |
| `brand-400` | `#EE7C3D` | hover |
| `brand-600` | `#C4531A` | pritisnuto |
| `neg` | `#D24B3C` | negativna razlika, tezak protivnik |
| `warn` | `#E0A62A` | upozorenje |

**Tekst na narandzastoj je uvek crn**, nikad beo — bela na `#DF6320`
daje 3.4:1 i pada.

Boja nikad ne nosi znacenje sama. Uz nju ide znak (`+`/`−`, `▲`/`▼`),
rec (`Lak` / `Neutralan` / `Tezak`) ili slovo (`D` / `G`).

---

## 3. Tipografija

| Uloga | Font | Gde |
|---|---|---|
| Naslovi, imena, veliki brojevi | Barlow Condensed 700/800, `uppercase` | `font-display` |
| Tekst i interfejs | Barlow 400–700 | `font-sans` |
| Podaci, oznake, tabele | JetBrains Mono, `tabular-nums` | `font-mono` |

Zvanicno pismo je **Proxima Nova**. Stoji prvo u stack-u u
`tailwind.config.ts`; cim se u `globals.css` otkomentarisu `@font-face`
pravila i fajlovi stave u `public/fonts/`, preuzima ceo proizvod bez
ijedne druge izmene.

### Klase

| Klasa | Sta radi |
|---|---|
| `.stat` | veliki broj — display font, extrabold, tabularne cifre |
| `.statmono` | broj u tabeli — mono, bold, tabularne cifre |
| `.label` | sitna oznaka iznad podatka — mono, `0.14em`, `ink-3` |
| `.eyebrow` | nadnaslov sekcije sa narandzastom crticom |

Brojevi su **uvek** tabularni. Bez toga kolone poskakuju pri osvezavanju.

---

## 4. Razmak i sirina

| | |
|---|---|
| Sirina strane | `max-w-page` = 1240px |
| Bocna margina | `--page-x`: 1rem na telefonu, 1.75rem od 768px |
| Visina navigacije | `--nav-h`: 60px na telefonu, 68px od 768px |

`.page` daje kolonu sadrzaja. `.bleed` prosiruje blok preko cele sirine
**unutar** `.page` — nikad na elementu koji je vec pune sirine, jer tada
pravi vodoravno prelivanje.

Radijusi su namerno mali: `xs 2px`, `sm 4px`, `md 6px`, `lg 10px`.
Tehnicki utisak, ne mekani SaaS.

---

## 5. Ritam kompozicije

Kartica nije podrazumevani oblik. Po tipu podatka bira se oblik:

| Podatak | Oblik | Komponenta |
|---|---|---|
| Poredjenje mnogo igraca | tabela | `PlayerTable` |
| Odnos dva tima | red pune sirine | `FixtureRow` |
| Zbirni brojevi | traka podeljena vlas-linijama | `StatStrip` |
| Jedan zakljucak sa razlogom | editorijalni blok sa portretom | naslovna, `/igraci` |
| Sastav tima | teren sa mestima po formaciji | `CourtLineup` |
| Klupa i sesti igrac | traka ispod terena | `BenchRow` |
| Preporuka promene | red „izlazi → ulazi" | `OptimizerView` |
| Ponuda | stepenice, ne cetiri iste kartice | `PricingTable` |

---

## 6. Komponente

### Dugme — `ui/Button.tsx`

| Varijanta | Kad |
|---|---|
| `primary` | glavna akcija ekrana (narandzasto, crn tekst) |
| `solid` | belo, za tamnu narandzastu podlogu |
| `ghost` | sekundarna akcija |
| `quiet` | trecerazredna akcija |

Velicine `sm` 36px, `md` 44px, `lg` 52px. Stanja: hover, active,
disabled (40% i bez pokazivaca), loading (spinner, sirina se ne menja).
`LinkButton` je isti izgled kao `next/link`.

### Ostalo

| Komponenta | Uloga |
|---|---|
| `SectionHead` | nadnaslov + naslov + opis + akcija |
| `RowDivider` | pregrada u listi, bez nove kartice |
| `Panel` | povrsina: `default`, `brand`, `sunken` |
| `Chip` | oznaka: `default`, `brand`, `solid`, `warn`, `neg` |
| `PositionTag` | slovo pozicije sa punim nazivom u `title` |
| `Alert` | `info`, `ok`, `warn`, `error` — sa znakom, ne samo bojom |
| `EmptyState` | prazno stanje sa izlazom |
| `Skeleton`, `SkeletonRows` | ucitavanje, u obliku sadrzaja koji stize |
| `Meter` | traka 0–max, uz nju uvek stoji broj |
| `Hint` | objasnjenje uz skracenicu, radi i na fokus tastaturom |
| `Segmented` | vodoravni izbor, strelice menjaju izbor |
| `Stat`, `StatStrip` | oznaka + broj + jedinica |
| `Delta` | razlika sa znakom i strelicom |
| `FormBars` | forma kao stubici, najnovije kolo desno |
| `CourtBackdrop` | geometrija terena: `half`, `arc`, `center` |
| `Avatar` | portret bez JavaScript-a, za duge liste |
| `PlayerPhoto` | portret sa hvatanjem greske, za kratke liste |
| `PlayerCutout` | veliki portret za editorijalne blokove |

---

## 7. Kretanje

| | |
|---|---|
| Obicna interakcija | 120ms (`duration-fast`) |
| Podrazumevano | 180ms |
| Veci prelaz | 240ms (`duration-slow`) |
| Krivа | `cubic-bezier(.2,.8,.2,1)` |

`prefers-reduced-motion` gasi sve animacije globalno u `globals.css`.

---

## 8. Pristupacnost

- Fokus se **uvek** vidi: narandzasti prsten sa razmakom, definisan
  jednom na `:focus-visible`.
- Ciljevi za prst su najmanje 36px, glavne akcije 44px.
- Znacenje nikad ne pociva samo na boji.
- Svaka stranica ima tacno jedan `h1`.
- „Preskoci na sadrzaj" je prva stavka u tabulatorskom redu.
- Tabele imaju `<caption class="sr-only">` i `scope` na zaglavljima.
- Dekorativna grafika je `aria-hidden`; portret uz ime nema `alt`, jer
  bi citac ekrana dvaput izgovorio isto.

Provera kontrasta je pokretana nad svakom rutom; nijedan tekst nije
ispod AA praga.

---

## 9. Sta ne raditi

- Ne dodavati boje van palete.
- Ne pisati istu kombinaciju klasa u dve stranice — to je komponenta.
- Ne koristiti `.bleed` na elementu koji je vec pune sirine.
- Ne stavljati belo na narandzasto.
- Ne praviti novi oblik kad postojeci nosi isti podatak.
- Ne zamucivati placeni sadrzaj: pise se sta se dobija i po kojoj ceni.
