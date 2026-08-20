'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Tier } from '@/lib/types';

const LINKS = [
  { href: '/igra', label: 'Igra kola' },
  { href: '/raspored', label: 'Raspored' },
  { href: '/igraci', label: 'Igrači' },
  { href: '/baza', label: 'Baza' }
];

export default function Nav({ email, tier }: { email: string | null; tier: Tier }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function unesiKod() {
    const kod = prompt('Unesi kod:');
    if (!kod) return;
    setBusy(true);
    const res = await fetch('/api/kod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kod })
    });
    const out = await res.json();
    setBusy(false);
    alert(res.ok ? `Otključano: ${out.tier}` : out.error ?? 'Kod nije važeći.');
    if (res.ok) router.refresh();
  }

  async function odjava() {
    await createClient().auth.signOut();
    router.refresh();
    router.push('/');
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-line bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex h-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path d="M16 2.6 27.4 9.1v13L16 28.6 4.6 22.1v-13L16 2.6Z" stroke="#F3F4F5" strokeWidth="1.5" />
            <path d="M9.5 19.4 13.4 15l3.6 2.6L22.6 11" stroke="#2DB4FF" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="22.6" cy="11" r="2.6" fill="#FF5E1A" />
          </svg>
          <span className="font-display text-[15px] font-bold tracking-tight">
            EURO<span className="text-brand">FANTASY</span>LAB
          </span>
        </Link>

        <div className="hidden gap-5 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors ${
                path === l.href ? 'text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {email ? (
            <>
              {tier === 'FREE' ? (
                <button onClick={unesiKod} disabled={busy} className="btn-ghost h-9 px-3 text-[13px]">
                  Imam kod
                </button>
              ) : (
                <Link href="/profil" className="chip bg-brand/15 text-brand">{tier}</Link>
              )}
              <button onClick={odjava} className="hidden text-sm text-muted hover:text-ink sm:block">
                Odjava
              </button>
            </>
          ) : (
            <Link href="/prijava" className="btn-primary h-9 px-4 text-[13px]">Prijavi se</Link>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Meni"
            className="grid h-9 w-9 place-items-center rounded-card border border-line md:hidden"
          >
            <span className="relative block h-px w-4 bg-ink before:absolute before:-top-1.5 before:block
                             before:h-px before:w-4 before:bg-ink after:absolute after:top-1.5
                             after:block after:h-px after:w-4 after:bg-ink" />
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-b border-line bg-bg px-4 py-2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-line py-3 text-[15px] last:border-0"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
