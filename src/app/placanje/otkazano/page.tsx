import type { Metadata } from 'next';
import Logomark from '@/components/brand/Logomark';
import { LinkButton } from '@/components/ui/Button';
import { planByCode } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Placanje otkazano',
  robots: { index: false }
};

/**
 * Otkazano placanje.
 *
 * Nista nije naplaceno i to je prva stvar koja treba da pise. Bez
 * prekora i bez ponovnog navaljivanja — samo jasan put nazad.
 */
export default function Otkazano({ searchParams }: { searchParams: { plan?: string } }) {
  const plan = planByCode(searchParams.plan ?? '');

  return (
    <div className="page flex min-h-[calc(100dvh-var(--nav-h))] items-center justify-center py-16">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center opacity-60">
          <Logomark size={52} />
        </div>

        <h1 className="mt-7 text-[clamp(26px,5vw,36px)] uppercase leading-none">
          Placanje je otkazano
        </h1>

        <p className="mt-4 text-body leading-relaxed text-ink-2">
          Nista ti nije naplaceno. {plan ? `Paket ${plan.name} ostaje ` : 'Paket ostaje '}
          dostupan kad god budes hteo.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/paketi">Nazad na pakete</LinkButton>
          <LinkButton href="/igraci" variant="ghost">
            Nastavi besplatno
          </LinkButton>
        </div>

        <p className="mt-8 text-[11.5px] leading-relaxed text-ink-4">
          Ako imas pristupni kod, otvori meni i unesi ga — otkljucava paket bez placanja.
        </p>
      </div>
    </div>
  );
}
