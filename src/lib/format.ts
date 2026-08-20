import type { Team } from './types';

export const num = (v: number | null | undefined, d = 1) =>
  v == null ? '—' : Number(v).toFixed(d);

export const valueBand = (v: number | null) =>
  v == null ? 'poor' : v >= 8.5 ? 'elite' : v >= 7 ? 'good' : v >= 5 ? 'avg' : 'poor';

export const valueClass = (v: number | null) =>
  ({ elite: 'text-brand', good: 'text-[#FFB08A]', avg: 'text-ink', poor: 'text-muted' })[valueBand(v)];

export const matchupBand = (m: number | null) =>
  m == null ? 'neutral' : m >= 7 ? 'easy' : m >= 4 ? 'neutral' : 'hard';

export const matchupClass = (m: number | null) =>
  ({ easy: 'text-ok', neutral: 'text-muted', hard: 'text-bad' })[matchupBand(m)];

export const matchupWord = (m: number | null, sr = true) =>
  ({ easy: sr ? 'LAK' : 'EASY', neutral: sr ? 'NEUTRALAN' : 'NEUTRAL', hard: sr ? 'TEŽAK' : 'HARD' })[
    matchupBand(m)
  ];

export const teamName = (teams: Record<string, Team>, code?: string | null, sr = true) =>
  !code ? '' : sr ? teams[code]?.name_sr ?? code : teams[code]?.name_en ?? code;

export const dayLabel = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const m = ['januar','februar','mart','april','maj','jun','jul','avgust','septembar','oktobar','novembar','decembar'];
  const w = ['NEDELJA','PONEDELJAK','UTORAK','SREDA','ČETVRTAK','PETAK','SUBOTA'];
  return { date: `${d.getDate()}. ${m[d.getMonth()]}`, weekday: w[d.getDay()],
           time: d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) };
};

export const storageUrl = (path: string | null) =>
  !path ? null : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`;
