import type { ReactNode } from 'react';
import { SectionHead } from '@/components/ui/primitives';

/**
 * Okvir za pravne stranice — privatnost i uslove.
 *
 * Uska kolona i obican tekst: ove stranice se citaju, ne skeniraju, pa im
 * ne trebaju paneli ni brojevi. Svaki odeljak ima sidro, da podrska moze
 * da posalje link tacno na recenicu o kojoj je rec.
 */
export function Dokument({
  naslov,
  uvod,
  azurirano,
  children
}: {
  naslov: string;
  uvod: string;
  /** Datum poslednje izmene, ljudski zapisan. */
  azurirano: string;
  children: ReactNode;
}) {
  return (
    <div className="page py-10">
      <div className="max-w-[72ch]">
        <SectionHead as="h1" eyebrow="Pravno" title={naslov} desc={uvod} />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
          Poslednja izmena: {azurirano}
        </p>
        <div className="mt-10 space-y-10">{children}</div>
      </div>
    </div>
  );
}

export function Odeljak({
  id,
  naslov,
  children
}: {
  id: string;
  naslov: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[calc(var(--nav-h)+24px)]">
      <h2 className="text-[20px] uppercase leading-tight">{naslov}</h2>
      <div
        className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2
                   [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2
                   [&_b]:text-ink [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
      >
        {children}
      </div>
    </section>
  );
}
