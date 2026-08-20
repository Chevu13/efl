import Link from 'next/link';
import type { Tier } from '@/lib/types';

/** Premium zaključan blok — ne mutna slika, nego jasna ponuda. */
export default function TierGate({ need, count }: { need: Tier; count: number }) {
  return (
    <div className="card tgrid mt-4 border-dashed p-9 text-center">
      <p className="text-[15px] font-semibold">Još {count} igrača</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
        {need} otključava celu listu kola sa cenom, projekcijom i obrazloženjem za svakog igrača.
      </p>
      <Link href="/profil" className="btn-primary mt-5">Otključaj {need}</Link>
    </div>
  );
}
