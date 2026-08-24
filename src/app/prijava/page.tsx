import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthForm from '@/components/auth/AuthForm';
import Lockup from '@/components/brand/Lockup';
import CourtBackdrop from '@/components/ui/CourtBackdrop';

export const metadata: Metadata = {
  title: 'Prijava',
  description: 'Prijavi se ili napravi besplatan nalog na Euro Fantasy Lab.'
};

/**
 * Prijava i registracija.
 *
 * Levo stoji razlog zbog kojeg nalog uopste treba, desno forma. Bez toga
 * je ovo samo prazan ekran sa dva polja — a nalog je ovde besplatan i
 * nosi konkretnu korist, pa to treba i da pise.
 */
export default function Prijava() {
  return (
    <div className="grid min-h-[calc(100dvh-var(--nav-h))] lg:grid-cols-2">
      {/* razlog */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-sunken lg:block">
        <CourtBackdrop variant="center" opacity={0.08} />
        <div className="datagrid pointer-events-none absolute inset-0 opacity-60" aria-hidden />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Lockup variant="stacked" size={54} />

          <div className="max-w-md">
            <h2 className="text-[clamp(26px,3vw,40px)] uppercase leading-[1.05]">
              Nalog ti cuva postavu i pamti koliko si bio u pravu
            </h2>
            <ul className="mt-8 space-y-4">
              {[
                ['Sacuvana postava', 'Tim koji sastavis ostaje uz tebe kroz kolo.'],
                ['Izazov kola', 'Listic se salje i boduje samo sa nalogom.'],
                ['Sezonska tacnost', 'Prati koliko procenata pogadjas kroz sezonu.'],
                ['Paketi', 'Uplata i pristupni kodovi vezuju se za nalog.']
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3.5">
                  <span className="mt-[9px] h-[3px] w-4 shrink-0 bg-brand" aria-hidden />
                  <span>
                    <span className="block text-[15px] font-semibold">{t}</span>
                    <span className="mt-0.5 block text-small text-ink-3">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
            Nezavisna analiticka platforma · bez veze sa Euroleague Basketball
          </p>
        </div>
      </aside>

      {/* forma */}
      <div className="flex items-center justify-center px-[var(--page-x)] py-14">
        <Suspense fallback={<div className="skel h-96 w-full max-w-sm rounded-md" />}>
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}
