import type { Team } from './types';

/* ------------------------------------------------------------------ */
/* BROJEVI                                                             */
/* ------------------------------------------------------------------ */

export const num = (v: number | null | undefined, d = 1) =>
  v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d);

/** Uvek sa znakom — razlika mora da se cita i bez boje. */
export const signed = (v: number | null | undefined, d = 1) =>
  v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;

export const pct = (v: number | null | undefined, d = 0) =>
  v == null ? '—' : `${Number(v).toFixed(d)}%`;

export const credits = (v: number | null | undefined, d = 1) =>
  v == null ? '—' : Number(v).toFixed(d);

/* ------------------------------------------------------------------ */
/* VREDNOST                                                            */
/* ------------------------------------------------------------------ */

export type ValueBand = 'elite' | 'good' | 'avg' | 'poor';

export const valueBand = (v: number | null | undefined): ValueBand =>
  v == null ? 'poor' : v >= 8.5 ? 'elite' : v >= 7 ? 'good' : v >= 5 ? 'avg' : 'poor';

/** Rec uz boju — boja nikad ne nosi znacenje sama. */
export const valueWord: Record<ValueBand, string> = {
  elite: 'Vrhunska',
  good: 'Dobra',
  avg: 'Prosecna',
  poor: 'Slaba'
};

export const valueClass = (v: number | null | undefined) =>
  ({
    elite: 'text-brand',
    good: 'text-brand-400',
    avg: 'text-ink',
    poor: 'text-ink-3'
  })[valueBand(v)];

/* ------------------------------------------------------------------ */
/* PROTIVNIK                                                           */
/* ------------------------------------------------------------------ */

export type MatchupBand = 'easy' | 'neutral' | 'hard';

export const matchupBand = (m: number | null | undefined): MatchupBand =>
  m == null ? 'neutral' : m >= 6.5 ? 'easy' : m >= 4 ? 'neutral' : 'hard';

export const matchupClass = (m: number | null | undefined) =>
  ({ easy: 'text-brand', neutral: 'text-ink-2', hard: 'text-neg' })[matchupBand(m)];

export const matchupWord = (m: number | null | undefined, sr = true) =>
  ({
    easy: sr ? 'Lak' : 'Easy',
    neutral: sr ? 'Neutralan' : 'Neutral',
    hard: sr ? 'Tezak' : 'Hard'
  })[matchupBand(m)];

/* ------------------------------------------------------------------ */
/* TIMOVI                                                              */
/* ------------------------------------------------------------------ */

export const teamName = (
  teams: Record<string, Team>,
  code?: string | null,
  sr = true
) => (!code ? '' : sr ? (teams[code]?.name_sr ?? code.toUpperCase()) : (teams[code]?.name_en ?? code.toUpperCase()));

/** Kratka oznaka tima za tabele — tri slova, uvek velika. */
export const teamTag = (code?: string | null) => (code ? code.toUpperCase().slice(0, 3) : '—');

/* ------------------------------------------------------------------ */
/* DATUMI                                                              */
/* ------------------------------------------------------------------ */

const MESECI = [
  'januar', 'februar', 'mart', 'april', 'maj', 'jun',
  'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'
];
const MESECI_KRATKO = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AVG', 'SEP', 'OKT', 'NOV', 'DEC'];
const DANI = ['NEDELJA', 'PONEDELJAK', 'UTORAK', 'SREDA', 'CETVRTAK', 'PETAK', 'SUBOTA'];
const DANI_KRATKO = ['NED', 'PON', 'UTO', 'SRE', 'CET', 'PET', 'SUB'];

export type DayLabel = {
  date: string;
  dateShort: string;
  weekday: string;
  weekdayShort: string;
  time: string;
  day: string;
  month: string;
};

export const dayLabel = (iso: string | null): DayLabel | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: `${d.getDate()}. ${MESECI[d.getMonth()]}`,
    dateShort: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`,
    weekday: DANI[d.getDay()],
    weekdayShort: DANI_KRATKO[d.getDay()],
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    day: String(d.getDate()),
    month: MESECI_KRATKO[d.getMonth()]
  };
};

export const dateShort = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : `${d.getDate()}. ${MESECI[d.getMonth()]} ${d.getFullYear()}.`;
};

/** Koliko je jos ostalo do trenutka — za odbrojavanje do deadline-a. */
export const untilLabel = (iso: string | null | undefined) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 'zakljucano';
  const h = Math.floor(ms / 36e5);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  const m = Math.floor((ms % 36e5) / 6e4);
  return `${h}h ${m}m`;
};

/* ------------------------------------------------------------------ */
/* SLIKE                                                               */
/* ------------------------------------------------------------------ */

/**
 * Putanja do slike.
 *
 * `players/foo.png`  -> Supabase Storage (produkcija)
 * `/slike/players/…` -> lokalni fajl iz public/ (demo podaci)
 */
export const storageUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('/') || path.startsWith('http')) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${path}`;
};

/**
 * Prezime iz skracenog imena.
 *
 * Baza ume da nosi oba oblika — „Dotson D." i „D. Dotson" — pa se uzima
 * najduzi deo koji nije inicijal. Koristi se svuda gde staje samo jedna
 * rec: oznake na mecu, uski stubci, telefon.
 */
export const lastName = (name: string) => {
  const parts = name.split(/\s+/).filter((w) => w.replace(/\./g, '').length > 1);
  return (parts.sort((a, b) => b.length - a.length)[0] ?? name).replace(/,$/, '');
};

/** Inicijali iz imena — rezervni prikaz kad slike nema. */
export const initials = (name: string) =>
  name
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
