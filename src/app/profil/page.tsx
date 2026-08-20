import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyTier } from '@/lib/data';

export const dynamic = 'force-dynamic';

const PAKETI = [
  { tier: 'FREE', cena: '€0', opis: '1 izbor po kolu', feats: ['Izbor kola', 'Raspored i predikcije', 'Igra kola'] },
  { tier: 'PLUS', cena: '€X', opis: '3 izbora po kolu', feats: ['Sve iz FREE', '3 izbora po kolu', 'Cela tabela igrača'] },
  { tier: 'PRO', cena: '€X', opis: 'Svi igrači kola', feats: ['Sve iz PLUS', 'Svi igrači sa cenom', 'Forma i minuti', 'Profili igrača'] },
  { tier: 'ULTRA', cena: '€X', opis: 'Optimizator tima', feats: ['Sve iz PRO', 'Najbolja 4 transfera', 'Računa tvoje kredite'] }
];

export default async function Profil() {
  const { email, tier, userId } = await getMyTier();
  if (!userId) redirect('/prijava');

  const sb = createClient();
  const { data: pretplate } = await sb
    .from('subscriptions').select('*').order('created_at', { ascending: false }).limit(5);
  const { data: listici } = await sb
    .from('entries').select('*').order('round_id', { ascending: false }).limit(10);

  const ukupno = (listici ?? []).reduce(
    (a, e: any) => ({ c: a.c + (e.correct ?? 0), t: a.t + (e.total ?? 0) }), { c: 0, t: 0 });
  const tacnost = ukupno.t ? Math.round((ukupno.c / ukupno.t) * 100) : null;

  return (
    <>
      <p className="eyebrow">Profil</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">{email}</h1>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4">
        {[
          ['Paket', tier],
          ['Tačnost', tacnost != null ? `${tacnost}%` : '—'],
          ['Odigrano kola', String((listici ?? []).length)],
          ['Tačnih odgovora', `${ukupno.c}/${ukupno.t}`]
        ].map(([l, v]) => (
          <div key={l} className="bg-surface p-4">
            <div className="text-[11px] text-muted">{l}</div>
            <div className={`stat mt-1.5 text-xl ${l === 'Tačnost' ? 'text-brand' : ''}`}>{v}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 font-display text-2xl font-bold tracking-tight">Paketi</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PAKETI.map((p) => (
          <div key={p.tier}
               className={`card flex flex-col gap-4 p-5 ${
                 p.tier === tier ? 'border-brand' : p.tier === 'ULTRA' ? 'border-data/40' : ''}`}>
            <div>
              <div className="font-display text-[15px] font-bold tracking-wide">{p.tier}</div>
              <div className="stat mt-2 text-2xl">{p.cena}
                <span className="ml-1 text-[11px] font-normal text-muted">/ mesečno</span></div>
            </div>
            <div className="border-b border-line pb-3 font-mono text-[12px] text-muted">{p.opis}</div>
            <ul className="flex-1 space-y-2">
              {p.feats.map((f) => (
                <li key={f} className="flex gap-2 text-[13px] text-muted">
                  <span className="mt-2 h-px w-2 shrink-0 bg-brand" />{f}
                </li>
              ))}
            </ul>
            {p.tier === tier
              ? <span className="chip justify-center bg-brand/15 py-2 text-brand">Aktivan paket</span>
              : <Link href="/profil#kupovina" className="btn-ghost w-full">Izaberi</Link>}
          </div>
        ))}
      </div>

      <p className="mt-4 font-mono text-[11.5px] tracking-wide text-muted">
        CENE U PRIPREMI · PLAĆANJE PREKO PAYPAL-A · OTKAZIVANJE U SVAKOM TRENUTKU
      </p>

      {!!pretplate?.length && (
        <>
          <h2 className="mt-12 font-display text-2xl font-bold tracking-tight">Istorija pretplata</h2>
          <div className="mt-4 overflow-hidden rounded-card border border-line">
            {pretplate.map((s: any) => (
              <div key={s.id}
                   className="flex items-center justify-between gap-3 border-b border-line p-3.5 text-[13px] last:border-0">
                <span className="chip bg-elev text-muted">{s.tier}</span>
                <span className="font-mono text-[11px] text-muted">{s.source}</span>
                <span className="font-mono text-[11px] text-muted">
                  {s.ends_at ? new Date(s.ends_at).toLocaleDateString('sr-RS') : 'bez roka'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
