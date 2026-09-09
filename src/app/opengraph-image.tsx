import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/config';

/**
 * Slika koja se vidi kad se link podeli — WhatsApp, Viber, X, Discord.
 *
 * Crta se iz `next/og`, koji vec dolazi uz Next — nema nove zavisnosti i
 * nema PNG-a koji treba rucno odrzavati kad se tekst promeni. Font je
 * sistemski jer `next/og` ne moze da ucita `next/font`; oblik slova nije
 * vazan koliko to da se ime i tvrdnja procitaju na malom pregledu.
 */
export const runtime = 'edge';
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const NARANDZASTA = '#DF6320';
const CRNA = '#08090B';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CRNA,
          padding: 72,
          fontFamily: 'sans-serif'
        }}
      >
        {/* traka brenda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 999,
              background: NARANDZASTA,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: CRNA,
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: -1
            }}
          >
            EFL
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ color: '#fff', fontSize: 30, fontWeight: 900 }}>EURO</span>
            <span style={{ color: NARANDZASTA, fontSize: 30, fontWeight: 900 }}>FANTASY</span>
            <span style={{ color: '#fff', fontSize: 30, fontWeight: 900 }}>LAB</span>
          </div>
        </div>

        {/* tvrdnja */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#fff', fontSize: 76, fontWeight: 900, lineHeight: 1.05 }}>
            Prestani da nagadjas.
          </span>
          <span style={{ color: NARANDZASTA, fontSize: 76, fontWeight: 900, lineHeight: 1.05 }}>
            Pocni da racunas.
          </span>
        </div>

        {/* sta sajt radi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 5, background: NARANDZASTA }} />
          <span style={{ color: '#9AA1AB', fontSize: 27 }}>
            Cena, projekcija i vrednost za svakog igraca EuroLeague Fantasy takmicenja
          </span>
        </div>
      </div>
    ),
    size
  );
}
