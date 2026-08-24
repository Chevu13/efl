import Logomark from '@/components/brand/Logomark';
import { LinkButton } from '@/components/ui/Button';
import CourtBackdrop from '@/components/ui/CourtBackdrop';

export default function NotFound() {
  return (
    <div className="relative flex min-h-[calc(100dvh-var(--nav-h))] items-center justify-center overflow-hidden">
      <CourtBackdrop variant="center" opacity={0.07} />
      <div className="page relative text-center">
        <div className="flex justify-center opacity-70">
          <Logomark size={56} />
        </div>
        <p className="stat mt-8 text-[clamp(64px,14vw,140px)] leading-none text-brand">404</p>
        <h1 className="mt-2 text-[clamp(22px,4vw,32px)] uppercase">Ova stranica ne postoji</h1>
        <p className="mx-auto mt-4 max-w-sm text-body text-ink-3">
          Adresa je promenjena ili je nikad nije ni bilo. Krenulo bi se odavde.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/">Pocetna</LinkButton>
          <LinkButton href="/igraci" variant="ghost">Izbori kola</LinkButton>
          <LinkButton href="/baza" variant="quiet">Baza igraca</LinkButton>
        </div>
      </div>
    </div>
  );
}
