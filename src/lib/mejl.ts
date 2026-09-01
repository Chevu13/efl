import { SITE } from './config';

/**
 * Slanje mejlova preko Resend-a.
 *
 * Bez SDK-a — Resend je obican HTTP poziv, a jedna zavisnost manje je
 * jedna zavisnost manje. Supabase-ov ugradjeni mejler salje dve poruke na
 * sat i pada u spam, pa potvrde i promene lozinke idu odavde.
 *
 * Ako `RESEND_API_KEY` nije podesen, `posaljiMejl` vraca `false` umesto da
 * puca — pozivalac tada bira sta radi (registracija, na primer, nalog
 * potvrdjuje sama, da sajt radi i pre nego sto se mejl podesi).
 */

const LOGO =
  'https://ipkojwfhikunlwnmmdmg.supabase.co/storage/v1/object/public/logos/mark.png';

export const mejlPodesen = () => Boolean(process.env.RESEND_API_KEY);

export async function posaljiMejl({
  za,
  naslov,
  html
}: {
  za: string;
  naslov: string;
  html: string;
}): Promise<boolean> {
  const kljuc = process.env.RESEND_API_KEY;
  if (!kljuc) return false;

  const posiljalac = process.env.RESEND_FROM ?? `${SITE.name} <onboarding@resend.dev>`;

  const odgovor = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kljuc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: posiljalac, to: [za], subject: naslov, html })
  });

  if (!odgovor.ok) {
    console.error('Resend nije primio poruku:', odgovor.status, await odgovor.text());
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* SABLON                                                              */
/* ------------------------------------------------------------------ */

/**
 * Zajednicki omotac za sve mejlove.
 *
 * Sve je inline i preko tabela — Outlook ignorise spoljni CSS. Ista slika
 * i iste boje kao sablon u `supabase/mejlovi/`, koji ostaje kao rezerva za
 * slucaj da se mejlovi ipak salju iz Supabase-a.
 */
export function omotac({
  nadnaslov,
  naslov,
  uvod,
  dugme,
  veza,
  napomena
}: {
  nadnaslov: string;
  naslov: string;
  uvod: string;
  dugme: string;
  veza: string;
  napomena: string;
}) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0B0C0E;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#15171B;border:1px solid #2A2D33;border-radius:12px;">
      <tr><td style="padding:32px 32px 0;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px;"><img src="${LOGO}" width="28" height="28" alt="" style="display:block;border:0;" /></td>
          <td style="font-size:15px;font-weight:bold;color:#F3F4F5;letter-spacing:-0.2px;">EURO<span style="color:#FF5E1A;">FANTASY</span>LAB</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 32px 0;">
        <div style="font-family:Consolas,monospace;font-size:11px;letter-spacing:2px;color:#9BA1AA;text-transform:uppercase;">${nadnaslov}</div>
        <div style="margin-top:10px;font-size:24px;font-weight:bold;color:#F3F4F5;line-height:1.2;">${naslov}</div>
      </td></tr>
      <tr><td style="padding:18px 32px 0;font-size:14px;line-height:1.6;color:#B7BCC3;">${uvod}</td></tr>
      <tr><td style="padding:26px 32px 0;">
        <a href="${veza}" style="display:inline-block;background:#FF5E1A;color:#000000;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 26px;border-radius:6px;">${dugme}</a>
      </td></tr>
      <tr><td style="padding:22px 32px 0;font-size:12px;line-height:1.6;color:#7C838C;">
        Ako dugme ne radi, nalepi ovu adresu u pregledac:<br />
        <span style="color:#2DB4FF;word-break:break-all;">${veza}</span>
      </td></tr>
      <tr><td style="padding:26px 32px 32px;border-top:1px solid #2A2D33;margin-top:24px;font-size:11.5px;line-height:1.6;color:#7C838C;">
        ${napomena}<br /><br />
        ${SITE.name} · nezavisna analiticka platforma, bez veze sa Euroleague Basketball
      </td></tr>
    </table>
  </td></tr>
</table>`;
}
