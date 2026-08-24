'use client';

import { useCallback, useEffect, useState } from 'react';
import { emptyLineup, type LineupState } from './lineup';
import { FORMATIONS } from './config';

/**
 * Postava se cuva u pregledacu, po kolu.
 *
 * Namerno bez tabele u bazi: sastavljanje tima je crna sveska, korisnik
 * ga menja desetak puta pre nego sto se odluci, i ne treba mu nalog da bi
 * probao alat. Kad postava krene na server — u optimizator — salje se
 * eksplicitno, jednim pozivom.
 */

/* v2 nosi uloge (petorka, sesti, klupa, kapiten, trener). Stari v1 zapis
   je bio obican spisak id-jeva i ne moze se prevesti u novi oblik bez
   nagadjanja, pa se jednostavno preskace. */
const KEY = (roundId: number) => `efl:postava:v2:${roundId}`;

function parse(raw: string | null): LineupState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LineupState>;
    const strings = (x: unknown) =>
      Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : [];

    return {
      starters: strings(v.starters),
      sixth: typeof v.sixth === 'string' ? v.sixth : null,
      bench: strings(v.bench),
      captain: typeof v.captain === 'string' ? v.captain : null,
      coach: typeof v.coach === 'string' ? v.coach : null,
      formation:
        FORMATIONS.some((f) => f.code === v.formation) && v.formation
          ? v.formation
          : '2-2-1'
    };
  } catch {
    return null;
  }
}

export function useLineup(roundId: number) {
  const [state, setState] = useState<LineupState>(emptyLineup);
  const [ready, setReady] = useState(false);

  /* Citanje tek na klijentu — na serveru localStorage ne postoji. */
  useEffect(() => {
    setState(parse(window.localStorage.getItem(KEY(roundId))) ?? emptyLineup());
    setReady(true);
  }, [roundId]);

  const save = useCallback(
    (next: LineupState) => {
      setState(next);
      try {
        window.localStorage.setItem(KEY(roundId), JSON.stringify(next));
      } catch {
        /* privatni rezim ili pun disk — postava i dalje radi u ovoj sesiji */
      }
    },
    [roundId]
  );

  /** Primeni izmenu opisanu funkcijom nad trenutnim stanjem. */
  const update = useCallback(
    (fn: (s: LineupState) => LineupState) => save(fn(state)),
    [state, save]
  );

  const clear = useCallback(() => save(emptyLineup()), [save]);

  return { state, ready, save, update, clear };
}
