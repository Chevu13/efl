'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Postava se cuva u pregledacu, po kolu.
 *
 * Namerno bez tabele u bazi: sastavljanje tima je crna sveska, korisnik
 * ga menja desetak puta pre nego sto se odluci, i ne treba mu nalog da bi
 * probao alat. Kad postava krene na server — u optimizator — salje se
 * eksplicitno, jednim pozivom.
 */

const KEY = (roundId: number) => `efl:postava:v1:${roundId}`;

export function useLineup(roundId: number) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  /* Citanje tek na klijentu — na serveru localStorage ne postoji. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY(roundId));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      setIds(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      setIds([]);
    }
    setReady(true);
  }, [roundId]);

  const save = useCallback(
    (next: string[]) => {
      setIds(next);
      try {
        window.localStorage.setItem(KEY(roundId), JSON.stringify(next));
      } catch {
        /* privatni rezim ili pun disk — postava i dalje radi u ovoj sesiji */
      }
    },
    [roundId]
  );

  const add = useCallback((id: string) => save(ids.includes(id) ? ids : [...ids, id]), [ids, save]);
  const remove = useCallback((id: string) => save(ids.filter((x) => x !== id)), [ids, save]);
  const toggle = useCallback(
    (id: string) => (ids.includes(id) ? remove(id) : add(id)),
    [ids, add, remove]
  );
  const clear = useCallback(() => save([]), [save]);

  return { ids, ready, add, remove, toggle, clear, replace: save };
}
