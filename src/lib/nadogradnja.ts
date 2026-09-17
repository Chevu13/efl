import { PLANS, planByCode, type PlanCode } from './config';
import { TIER_RANK, type Tier } from './types';

/**
 * Nadogradnja placenog paketa.
 *
 * Pravilo vlasnika sajta: ko ima Plus i hoce Pro, prelazi na Pro odmah,
 * placa samo razliku u ceni (Pro - Plus), a Pro mu vazi do istog datuma
 * do kog je vazio Plus.
 *
 * Ovo je cista funkcija nad redovima pretplate — bez baze i bez mreze —
 * jer isti racun treba na tri mesta: stranica cena ga prikazuje, ruta za
 * narudzbinu po njemu naplacuje, a dodela prava po njemu proverava uplatu.
 * Kad bi se racunalo na tri nacina, prikazana i naplacena cena bi se
 * pre ili kasnije razisle.
 */

export type PretplataRed = {
  id: string | number;
  tier: string;
  source?: string | null;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type Nadogradnja = {
  /** Red pretplate koji se nadogradjuje. */
  osnovaId: string;
  osnova: PlanCode;
  /** Nadogradjeni paket vazi do ovog trenutka — kraja osnove. */
  vaziDo: string;
  /** Doplata u centima: cena ciljnog paketa minus cena osnove. */
  iznosCents: number;
};

/** Paket koji je placen i vazi upravo sada (ne zakazan za kasnije). */
function placenISad(r: PretplataRed, sada: number): boolean {
  if (r.source !== 'paypal') return false;
  if ((r.status ?? 'active') !== 'active') return false;
  if (!r.ends_at || new Date(r.ends_at).getTime() <= sada) return false;
  if (r.starts_at && new Date(r.starts_at).getTime() > sada) return false;
  return true;
}

/**
 * Da li kupovina `cilj` za ovog korisnika jeste nadogradnja, i pod kojim
 * uslovima. `null` znaci obicna kupovina po punoj ceni.
 *
 * Osnova je samo placen paket. Paket dobijen nagradom iz izazova ili
 * pristupnim kodom nije placen, pa ne daje popust — takav korisnik
 * kupuje po punoj ceni i dobija pun period.
 */
export function nadogradnja(
  redovi: PretplataRed[],
  cilj: PlanCode,
  sada: Date = new Date()
): Nadogradnja | null {
  const plan = planByCode(cilj);
  if (!plan) return null;
  const t = sada.getTime();

  /* Najjaci placen paket koji vazi sad; kod istog nivoa onaj koji traje duze. */
  const osnova = redovi
    .filter((r) => placenISad(r, t) && r.tier in TIER_RANK)
    .sort(
      (a, b) =>
        TIER_RANK[b.tier as Tier] - TIER_RANK[a.tier as Tier] ||
        new Date(b.ends_at!).getTime() - new Date(a.ends_at!).getTime()
    )[0];
  if (!osnova) return null;

  /* Samo prelazak na jaci paket je nadogradnja. */
  if (TIER_RANK[plan.tier] <= TIER_RANK[osnova.tier as Tier]) return null;

  const osnovaPlan = PLANS.find((p) => p.tier === osnova.tier);
  if (!osnovaPlan) return null;

  const iznosCents = plan.priceCents - osnovaPlan.priceCents;
  if (iznosCents <= 0) return null;

  return {
    osnovaId: String(osnova.id),
    osnova: osnovaPlan.code,
    vaziDo: osnova.ends_at!,
    iznosCents
  };
}
