import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import PricingTable from '@/components/premium/PricingTable';
import { SectionHead, Chip, EmptyState, Alert } from '@/components/ui/primitives';
import { StatStrip } from '@/components/ui/Stat';
import { LinkButton } from '@/components/ui/Button';
import { activeSubscription, getMyEntries, getMySubscriptions, getMyTier } from '@/lib/data';
import { paypalConfigured, paypalEnv } from '@/lib/paypal/client';
import { PLANS, planByCode } from '@/lib/config';
import { dateShort, pct, untilLabel } from '@/lib/format';
import { isPremium } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profil',
  description: 'Tvoj nalog, paket, uplate i statistika listica.'
};

const SOURCE_LABEL: Record<string, string> = {
  paypal: 'PayPal',
  code: 'Pristupni kod',
  manual: 'Rucno dodeljeno',
  reward: 'Nagrada za listic'
};

export default async function Profil() {
  const me = await getMyTier();
  if (!me.userId) redirect('/prijava?next=%2Fprofil');

  const [subs, entries] = await Promise.all([getMySubscriptions(), getMyEntries()]);

  const active = activeSubscription(subs);
  const premium = isPremium(me.tier);
  const plan = planByCode(me.tier);

  const totals = entries.reduce(
    (a, e) => ({ correct: a.correct + (e.correct ?? 0), total: a.total + (e.total ?? 0) }),
    { correct: 0, total: 0 }
  );
  const accuracy = totals.total ? Math.round((totals.correct / totals.total) * 100) : null;

  return (
    <div className="page py-10">
      {/* ---------------- identitet ---------------- */}
      <section className="relative overflow-hidden rounded-md border border-line bg-gradient-to-b from-surface to-sunken">
        <div className="hatch pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5 p-6 sm:p-8">
          <span
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-line-2
                       bg-elev font-display text-[26px] font-extrabold uppercase text-ink-2"
            aria-hidden
          >
            {(me.username ?? me.email ?? '?')[0]}
          </span>

          <div className="min-w-0 flex-1">
            <p className="eyebrow">Nalog</p>
            <h1 className="mt-2.5 truncate text-[clamp(24px,4vw,34px)] uppercase leading-none">
              {me.username ?? me.email}
            </h1>
            <p className="mt-2 truncate text-small text-ink-3">{me.email}</p>
          </div>

          <div className="text-right">
            <div className="label">Paket</div>
            <div className={`stat mt-1.5 text-[34px] leading-none ${premium ? 'text-brand' : ''}`}>
              {me.tier}
            </div>
            {active?.ends_at && (
              <div className="mt-1.5 text-[11.5px] text-ink-3">
                do {dateShort(active.ends_at)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- status pretplate ---------------- */}
      <div className="mt-4">
        {premium && active ? (
          <Alert tone="ok" title={`${plan?.name ?? me.tier} je aktivan`}>
            {active.ends_at ? (
              <>
                Pristup traje jos <b className="text-ink">{untilLabel(active.ends_at)}</b>, do{' '}
                {dateShort(active.ends_at)}. Uplata je jednokratna — nista se ne obnavlja samo od
                sebe i nema sta da se otkazuje.
              </>
            ) : (
              'Pristup nema rok trajanja.'
            )}
          </Alert>
        ) : (
          <Alert tone="info" title="Besplatan paket">
            Vidis jedan izbor kola, raspored, izazov i pocetak tabele igraca. Placeni paket
            otkljucava celu analizu i optimizator.
          </Alert>
        )}
      </div>

      {/* ---------------- statistika ---------------- */}
      <StatStrip
        className="mt-6"
        items={[
          {
            label: 'Tacnost',
            value: accuracy != null ? pct(accuracy) : '—',
            tone: accuracy != null ? 'brand' : 'muted',
            hint: 'Procenat tacnih odgovora u svim odigranim listicima.'
          },
          { label: 'Odigrano kola', value: String(entries.length) },
          { label: 'Tacnih odgovora', value: `${totals.correct}/${totals.total}` },
          {
            label: 'Uplata',
            value: String(subs.filter((s) => s.source === 'paypal').length)
          }
        ]}
      />

      {/* ---------------- paketi ---------------- */}
      <section id="paketi" className="mt-14 scroll-mt-[calc(var(--nav-h)+24px)]">
        <SectionHead
          eyebrow="Paketi"
          title="Sta otkljucava koji paket"
          desc="Jedna uplata otkljucava paket na 30 dana. Nema automatske obnove i nema sta da se otkazuje — kad istekne, nalog se vraca na besplatan paket."
        />
        <div className="mt-7">
          <PricingTable
            tier={me.tier}
            loggedIn={!!me.userId}
            paypalReady={paypalConfigured()}
          />
        </div>

        {!paypalConfigured() && (
          <div className="mt-4">
            <Alert tone="warn" title="Placanje jos nije ukljuceno">
              U okruzenju nedostaju <code className="font-mono">PAYPAL_CLIENT_ID</code> i{' '}
              <code className="font-mono">PAYPAL_SECRET</code>. Do tada se paketi otkljucavaju
              pristupnim kodom iz menija.
            </Alert>
          </div>
        )}

        {paypalConfigured() && paypalEnv() === 'sandbox' && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
            PayPal radi u sandbox rezimu — uplate nisu stvarne.
          </p>
        )}
      </section>

      {/* ---------------- istorija ---------------- */}
      <section className="mt-14">
        <SectionHead
          eyebrow="Istorija"
          title="Uplate i pristup"
          desc="Ovde stoji samo ono sto nam treba: paket, izvor i rok. Podaci o kartici i PayPal nalogu nikad ne dolaze do nas."
        />

        {subs.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Jos nema uplata"
              desc="Kad uzmes paket, ovde ce stajati datum, iznos i do kada vazi."
              action={
                <LinkButton href="#paketi" variant="ghost">
                  Pogledaj pakete
                </LinkButton>
              }
            />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-md border border-line">
            <div className="overflow-x-auto">
              <table className="tbl min-w-[560px]">
                <thead>
                  <tr>
                    <th scope="col">Paket</th>
                    <th scope="col">Izvor</th>
                    <th scope="col">Pocetak</th>
                    <th scope="col">Vazi do</th>
                    <th scope="col" className="text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const live = !s.ends_at || new Date(s.ends_at).getTime() > Date.now();
                    return (
                      <tr key={String(s.id)}>
                        <td>
                          <span className="font-display text-[14px] font-extrabold uppercase">
                            {s.tier}
                          </span>
                        </td>
                        <td className="text-ink-3">
                          {SOURCE_LABEL[s.source] ?? s.source}
                          {s.note && (
                            <span className="ml-2 font-mono text-[11px] text-ink-4">{s.note}</span>
                          )}
                        </td>
                        <td className="text-ink-3">
                          {dateShort(s.starts_at ?? s.created_at)}
                        </td>
                        <td className="text-ink-3">{dateShort(s.ends_at)}</td>
                        <td className="text-right">
                          <Chip tone={live ? 'brand' : 'default'}>{live ? 'Aktivno' : 'Isteklo'}</Chip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- listici ---------------- */}
      {entries.length > 0 && (
        <section className="mt-14">
          <SectionHead eyebrow="Izazov" title="Odigrana kola" />
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {entries.slice(0, 8).map((e) => {
              const ratio = e.total ? (e.correct ?? 0) / e.total : null;
              return (
                <div key={e.id} className="panel px-4 py-3.5">
                  <div className="flex items-baseline justify-between">
                    <span className="label">{e.round_id}. kolo</span>
                    <span className="statmono text-[15px]">
                      {e.correct ?? '—'}
                      <span className="text-ink-4">/{e.total ?? '—'}</span>
                    </span>
                  </div>
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-elev">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(ratio ?? 0) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-10 text-[11.5px] leading-relaxed text-ink-4">
        Cene: {PLANS.map((p) => `${p.name} ${(p.priceCents / 100).toFixed(2)} EUR`).join(' · ')}.
        Placanje ide preko PayPal-a; pristup se dodeljuje tek posle potvrde uplate na serveru.
      </p>
    </div>
  );
}
