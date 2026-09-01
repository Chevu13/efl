import type { Metadata } from 'next';
import NovaLozinkaForm from '@/components/auth/NovaLozinkaForm';
import CourtBackdrop from '@/components/ui/CourtBackdrop';

export const metadata: Metadata = {
  title: 'Nova lozinka',
  description: 'Postavi novu lozinku za svoj Euro Fantasy Lab nalog.',
  robots: { index: false }
};

export default function NovaLozinka() {
  return (
    <div className="relative grid min-h-[calc(100dvh-var(--nav-h))] place-items-center px-[var(--page-x)] py-14">
      <CourtBackdrop variant="center" opacity={0.06} />
      <div className="relative w-full max-w-sm">
        <NovaLozinkaForm />
      </div>
    </div>
  );
}
