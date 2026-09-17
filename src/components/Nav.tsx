'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Logomark from './brand/Logomark';
import Wordmark from './brand/Wordmark';
import CodeDialog from './nav/CodeDialog';
import { ACCOUNT, PRIMARY, isActive } from './nav/links';
import { createClient } from '@/lib/supabase/client';
import { storageUrl, untilLabel } from '@/lib/format';
import { isPremium, type Tier } from '@/lib/types';

/**
 * Navigacija.
 *
 * Traka gore drzi identitet, glavne oblasti proizvoda i status naloga.
 * Aktivna stranica se prepoznaje po narandzastoj crti ispod stavke —
 * ne samo po boji teksta, da se vidi i bez percepcije boje.
 *
 * Na telefonu se glavne stavke sklapaju u panel preko celog ekrana sa
 * velikim ciljevima za prst; panel se zatvara na Escape i na promenu rute.
 */
export default function Nav({
  email,
  username,
  avatar,
  tier,
  round
}: {
  email: string | null;
  username: string | null;
  avatar?: string | null;
  tier: Tier;
  round?: { number: number; deadline: string | null } | null;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const premium = isPremium(tier);

  /* Panel se ne sme prevuci u sledecu stranicu. */
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  async function signOut() {
    await createClient().auth.signOut();
    setOpen(false);
    /* Tvrda navigacija — zaglavlje se crta na serveru, a kes rutera bi vratio
       verziju u kojoj je korisnik jos prijavljen. */
    window.location.assign('/');
  }

  const deadline = untilLabel(round?.deadline);

  return (
    <>
      <a
        href="#sadrzaj"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]
                   focus:rounded-sm focus:bg-brand focus:px-4 focus:py-2 focus:font-semibold focus:text-black"
      >
        Preskoci na sadrzaj
      </a>

      <header className="fixed inset-x-0 top-0 z-50 h-[var(--nav-h)] border-b border-line bg-bg/90 backdrop-blur-md">
        <nav aria-label="Glavna navigacija" className="page flex h-full items-center gap-6">
          {/* identitet */}
          <Link
            href="/"
            aria-label="Euro Fantasy Lab — pocetna"
            className="flex shrink-0 items-center gap-2.5 transition-opacity duration-fast hover:opacity-85"
          >
            <Logomark size={32} />
            <Wordmark height={30} className="hidden sm:block" />
          </Link>

          {/* glavne oblasti */}
          <ul className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
            {PRIMARY.map((l) => {
              const on = isActive(path, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={on ? 'page' : undefined}
                    className={`relative flex h-[var(--nav-h)] items-center px-3 text-[13.5px] font-semibold
                                transition-colors duration-fast
                                ${on ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
                  >
                    {l.label}
                    {l.premium && tier !== 'ULTRA' && (
                      <LockIcon className="ml-1.5 h-3 w-3 text-ink-4" />
                    )}
                    <span
                      className={`absolute inset-x-2 bottom-0 h-[3px] rounded-t-sm bg-brand transition-transform
                                  duration-fast ease-out ${on ? 'scale-x-100' : 'scale-x-0'}`}
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* status */}
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {round && (
              <span className="hidden items-center gap-2 rounded-sm border border-line bg-surface px-2.5 py-1.5 xl:inline-flex">
                <span className="label">Kolo</span>
                <span className="statmono text-[13px] text-ink">{round.number}</span>
                {deadline && (
                  <>
                    <span className="h-3 w-px bg-line-2" aria-hidden />
                    <span className="font-mono text-[11px] text-ink-3">
                      {deadline === 'zakljucano' ? 'zakljucano' : `jos ${deadline}`}
                    </span>
                  </>
                )}
              </span>
            )}

            {tier !== 'ULTRA' && (
              <Link
                href="/paketi"
                aria-current={isActive(path, '/paketi') ? 'page' : undefined}
                className={`hidden text-[13.5px] font-semibold transition-colors duration-fast md:block ${
                  isActive(path, '/paketi') ? 'text-brand' : 'text-ink-3 hover:text-ink'
                }`}
              >
                Paketi
              </Link>
            )}

            {email ? (
              <>
                {premium ? (
                  <Link
                    href="/profil"
                    className="chip-brand hidden sm:inline-flex"
                    title="Tvoj aktivan paket"
                  >
                    {tier}
                  </Link>
                ) : (
                  <button onClick={() => setCodeOpen(true)} className="btn-ghost btn-sm hidden sm:inline-flex">
                    Imam kod
                  </button>
                )}
                <Link
                  href="/profil"
                  aria-label="Profil"
                  className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full
                             border border-line-2 bg-elev font-mono text-[12px] font-bold uppercase
                             text-ink-2 transition-colors duration-fast hover:border-brand hover:text-ink"
                >
                  {storageUrl(avatar) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={storageUrl(avatar)!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (username ?? email)[0]
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link href="/prijava" className="hidden text-[13.5px] font-semibold text-ink-3 hover:text-ink sm:block">
                  Prijava
                </Link>
                <Link href="/prijava?reg=1" className="btn-primary btn-sm">
                  Napravi nalog
                </Link>
              </>
            )}

            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Zatvori meni' : 'Otvori meni'}
              aria-expanded={open}
              aria-controls="meni"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-line
                         text-ink transition-colors duration-fast hover:bg-elev lg:hidden"
            >
              <BurgerIcon open={open} />
            </button>
          </div>
        </nav>
      </header>

      {/* -------------------- panel za telefon -------------------- */}
      {open && (
        <div id="meni" className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Zatvori meni"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-fade bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 top-[var(--nav-h)] max-h-[calc(100dvh-var(--nav-h))] animate-rise
                          overflow-y-auto border-b border-line bg-bg pb-8 shadow-pop">
            <nav aria-label="Meni" className="page pt-3">
              <p className="label py-3">Analiza</p>
              <ul className="divide-y divide-line border-y border-line">
                {PRIMARY.map((l) => {
                  const on = isActive(path, l.href);
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={on ? 'page' : undefined}
                        className={`flex min-h-[62px] items-center gap-4 py-3 transition-colors duration-fast
                                    ${on ? 'rule-brand -mx-4 px-4 bg-elev' : ''}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 font-display text-[16px] font-extrabold uppercase tracking-tight">
                            {l.label}
                            {l.premium && tier !== 'ULTRA' && <LockIcon className="h-3.5 w-3.5 text-ink-4" />}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] text-ink-3">{l.desc}</span>
                        </span>
                        <ChevronIcon />
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <Link
                href="/paketi"
                className="mt-3 flex min-h-[52px] items-center justify-between gap-4 border-b border-line py-3"
              >
                <span>
                  <span className="block font-display text-[16px] font-extrabold uppercase tracking-tight">
                    Paketi i cene
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-3">
                    Šta dobijaš u Plus, Pro i Ultra paketu
                  </span>
                </span>
                <ChevronIcon />
              </Link>

              <p className="label py-3 pt-6">Nalog</p>
              {email ? (
                <div className="panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{username ?? email}</p>
                      <p className="truncate text-[12px] text-ink-3">{email}</p>
                    </div>
                    <span className={premium ? 'chip-brand' : 'chip'}>{tier}</span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {ACCOUNT.map((l) => (
                      <Link key={l.href} href={l.href} className="btn-ghost btn-md w-full">
                        {l.label}
                      </Link>
                    ))}
                    {!premium && (
                      <button
                        onClick={() => {
                          setOpen(false);
                          setCodeOpen(true);
                        }}
                        className="btn-quiet btn-md w-full"
                      >
                        Imam pristupni kod
                      </button>
                    )}
                    <button onClick={signOut} className="btn-quiet btn-md w-full">
                      Odjava
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel p-4">
                  <p className="text-small text-ink-3">
                    Napravi besplatan nalog da sacuvas postavu, igras kolo i pratis svoju tacnost.
                  </p>
                  <div className="mt-4 grid gap-2">
                    <Link href="/prijava?reg=1" className="btn-primary btn-md w-full">
                      Napravi nalog
                    </Link>
                    <Link href="/prijava" className="btn-ghost btn-md w-full">
                      Prijavi se
                    </Link>
                  </div>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}

      <CodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-[14px] w-[18px]" aria-hidden>
      <span
        className={`absolute left-0 block h-[2px] w-full bg-current transition-all duration-fast ease-out
                    ${open ? 'top-1.5 rotate-45' : 'top-0'}`}
      />
      <span
        className={`absolute left-0 top-1.5 block h-[2px] w-full bg-current transition-opacity duration-fast
                    ${open ? 'opacity-0' : 'opacity-100'}`}
      />
      <span
        className={`absolute left-0 block h-[2px] w-full bg-current transition-all duration-fast ease-out
                    ${open ? 'top-1.5 -rotate-45' : 'top-3'}`}
      />
    </span>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-ink-4" fill="none" aria-hidden>
      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.75 7V5.25a2.25 2.25 0 0 1 4.5 0V7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
