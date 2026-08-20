'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Prijava() {
  const router = useRouter();
  const [reg, setReg] = useState(false);
  const [mejl, setMejl] = useState('');
  const [loz, setLoz] = useState('');
  const [ime, setIme] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function posalji() {
    setBusy(true); setMsg('');
    const sb = createClient();
    const { error } = reg
      ? await sb.auth.signUp({
          email: mejl, password: loz,
          options: { data: { username: ime || mejl.split('@')[0] } }
        })
      : await sb.auth.signInWithPassword({ email: mejl, password: loz });
    setBusy(false);

    if (error) { setMsg(error.message); return; }
    const { data } = await sb.auth.getSession();
    if (!data.session) { setMsg('Proveri mejl za potvrdu naloga.'); return; }
    router.refresh();
    router.push('/igra');
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card p-8">
        <h1 className="font-display text-2xl font-bold">{reg ? 'Napravi nalog' : 'Prijavi se'}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {reg
            ? 'Besplatno. Treba ti da igraš kolo i pratiš svoju statistiku.'
            : 'Tvoji listići i statistika vezani su za nalog.'}
        </p>

        <div className="mt-6 space-y-3">
          {reg && (
            <input className="field" placeholder="Korisničko ime"
                   value={ime} onChange={(e) => setIme(e.target.value)} />
          )}
          <input className="field" type="email" placeholder="Email" autoComplete="email"
                 value={mejl} onChange={(e) => setMejl(e.target.value)} />
          <input className="field" type="password" placeholder="Lozinka"
                 autoComplete={reg ? 'new-password' : 'current-password'}
                 value={loz} onChange={(e) => setLoz(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && posalji()} />
        </div>

        <button onClick={posalji} disabled={busy || !mejl || !loz}
                className="btn-primary mt-5 w-full">
          {busy ? '…' : reg ? 'Registruj se' : 'Prijavi se'}
        </button>
        <button onClick={() => { setReg(!reg); setMsg(''); }}
                className="btn-ghost mt-2 w-full">
          {reg ? 'Imam nalog' : 'Nemam nalog'}
        </button>

        {msg && <p className="mt-4 text-center font-mono text-[12px] text-warn">{msg}</p>}
      </div>
    </div>
  );
}
