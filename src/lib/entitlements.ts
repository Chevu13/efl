import { createAdminClient } from '@/lib/supabase/server';
import { planByCode, type PlanCode } from './config';
import { nadogradnja } from './nadogradnja';
import { TIER_RANK, type Tier } from './types';

/**
 * Dodela prava posle uspesne uplate.
 *
 * Jedno mesto kroz koje prolaze i webhook i povratna stranica sa PayPal-a.
 * Oba puta koriste isti id naplate, pa dodela ne moze da se udvostruci —
 * ko god stigne prvi, drugi vidi da je posao vec obavljen.
 *
 * Ovde se ne dodiruje profil korisnika niti se pravi paralelni sistem
 * naloga: upisuje se red u postojecu tabelu `subscriptions`, iz koje
 * funkcija `moj_tier` vec racuna paket.
 */

export type GrantInput = {
  userId: string;
  plan: PlanCode;
  /** Id naplate iz PayPal-a — kljuc za sprecavanje duplikata. */
  paypalId: string;
  amount?: number;
  currency?: string;
  orderId?: string | null;
  source?: string;
  /** Id pretplate koja se nadogradjuje, iz custom_id narudzbine. */
  nadogradnjaOd?: string | null;
};

export type GrantResult =
  | { ok: true; tier: Tier; endsAt: string; duplicate: boolean }
  | { ok: false; error: string };

/** Kolone koje postoje tek posle migracije 0001 — upis je uslovan. */
const EXTRA_COLUMNS = ['status', 'starts_at', 'plan_code', 'amount_cents', 'currency', 'paypal_order_id'];

export async function grantEntitlement(input: GrantInput): Promise<GrantResult> {
  const plan = planByCode(input.plan);
  if (!plan) return { ok: false, error: `Nepoznat paket: ${input.plan}` };
  if (!input.userId) return { ok: false, error: 'Uplata nije vezana za nalog.' };

  let sb;
  try {
    sb = createAdminClient();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  /* 1) Ista uplata moze stici i preko webhook-a i preko povratne stranice. */
  const { data: existing } = await sb
    .from('subscriptions')
    .select('id, tier, ends_at')
    .eq('paypal_id', input.paypalId)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      tier: existing.tier as Tier,
      endsAt: existing.ends_at as string,
      duplicate: true
    };
  }

  /* 2) Kada novi paket pocinje i dokle traje. */
  const sada = new Date();
  const { data: redovi } = await sb
    .from('subscriptions')
    .select('id, tier, source, status, starts_at, ends_at')
    .eq('user_id', input.userId);

  let startsAt: Date;
  let endsAt: Date;
  let nadogradjeno: PlanCode | null = null;

  /* Nadogradnja: pocinje odmah i traje do kraja paketa koji se nadogradjuje.
     Uslovi se racunaju iznova iz baze, istom funkcijom po kojoj je
     narudzbina naplacena, i vaze samo ako je placena bar ta razlika — oznaka
     iz custom_id sama po sebi ne daje nista. */
  const nad = input.nadogradnjaOd ? nadogradnja(redovi ?? [], plan.code, sada) : null;
  const placenoCents = input.amount != null ? Math.round(input.amount * 100) : null;

  if (
    nad &&
    nad.osnovaId === input.nadogradnjaOd &&
    (placenoCents == null || placenoCents >= nad.iznosCents)
  ) {
    startsAt = sada;
    endsAt = new Date(nad.vaziDo);
    nadogradjeno = nad.osnova;
  } else if (input.nadogradnjaOd && placenoCents != null && placenoCents < plan.priceCents) {
    /* Placena je razlika, ali osnova vise ne vazi — najcesce je istekla dok
       je kupac bio na PayPal-u. Ne ostavljamo ga bez onoga sto je platio:
       paket vazi do kraja stare osnove, a najmanje jedan dan. */
    const osnova = (redovi ?? []).find((r) => String(r.id) === input.nadogradnjaOd);
    if (!osnova?.ends_at) {
      return { ok: false, error: `Nadogradnja bez vazece osnove (${input.nadogradnjaOd}).` };
    }
    startsAt = sada;
    endsAt = new Date(Math.max(new Date(osnova.ends_at as string).getTime(), sada.getTime() + 864e5));
  } else {
    /* Obicna kupovina. Nadovezuje se samo na aktivan paket ISTOG ili JACEG
       nivoa — to je produzenje i ne sme da pojede placene dane. Kupovina
       jaceg paketa bez nadogradnje (npr. osnova je nagrada, ne uplata)
       pocinje odmah i traje pun period. */
    const kraj = (redovi ?? [])
      .filter((r) => r.ends_at && new Date(r.ends_at as string) > sada)
      .filter((r) => TIER_RANK[r.tier as Tier] >= TIER_RANK[plan.tier])
      .map((r) => new Date(r.ends_at as string).getTime())
      .sort((a, b) => b - a)[0];
    startsAt = kraj ? new Date(kraj) : sada;
    endsAt = new Date(startsAt.getTime() + plan.days * 864e5);
  }

  const core = {
    user_id: input.userId,
    tier: plan.tier,
    ends_at: endsAt.toISOString(),
    source: input.source ?? 'paypal',
    paypal_id: input.paypalId,
    note: [
      input.amount ? `${input.amount.toFixed(2)} ${input.currency ?? 'EUR'}` : null,
      nadogradjeno ? `nadogradnja ${nadogradjeno} → ${plan.code}` : plan.name
    ]
      .filter(Boolean)
      .join(' · ')
  };

  const extended = {
    ...core,
    status: 'active',
    starts_at: startsAt.toISOString(),
    plan_code: plan.code,
    amount_cents: input.amount != null ? Math.round(input.amount * 100) : plan.priceCents,
    currency: input.currency ?? 'EUR',
    paypal_order_id: input.orderId ?? null
  };

  /* 3) Prvo pun upis; ako migracija jos nije primenjena, upisi ono sto sigurno postoji. */
  let error = (await sb.from('subscriptions').insert(extended)).error;

  if (error && EXTRA_COLUMNS.some((c) => error!.message.includes(c))) {
    error = (await sb.from('subscriptions').insert(core)).error;
  }

  if (error) {
    /* Jedinstveni indeks nad paypal_id — druga isporuka istog dogadjaja. */
    if (error.code === '23505') {
      return { ok: true, tier: plan.tier, endsAt: endsAt.toISOString(), duplicate: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, tier: plan.tier, endsAt: endsAt.toISOString(), duplicate: false };
}

/* ------------------------------------------------------------------ */
/* DOGADJAJI                                                           */
/* ------------------------------------------------------------------ */

/**
 * Zapisuje id PayPal dogadjaja i vraca `true` ako je vec bio obradjen.
 *
 * PayPal ponavlja isporuku dok ne dobije 200, pa isti dogadjaj lako stigne
 * vise puta. Ako tabela `paypal_events` jos ne postoji, funkcija ne
 * obara zahtev — dodela prava je i sama zasticena preko `paypal_id`.
 */
export async function alreadyProcessed(eventId: string, eventType: string): Promise<boolean> {
  if (!eventId) return false;

  try {
    const sb = createAdminClient();
    const { error } = await sb
      .from('paypal_events')
      .insert({ id: eventId, event_type: eventType });

    if (!error) return false;
    if (error.code === '23505') return true; // vec upisan
    return false; // tabela ne postoji ili druga greska — ne blokiraj obradu
  } catch {
    return false;
  }
}

/**
 * Skida oznaku dogadjaja kad obrada nije uspela.
 *
 * `alreadyProcessed` upisuje oznaku pre posla, pa bi bez ovoga ponovljena
 * isporuka nasla oznaku i preskocila dodelu koja nikad nije prosla.
 */
export async function releaseEvent(eventId?: string): Promise<void> {
  if (!eventId) return;
  try {
    await createAdminClient().from('paypal_events').delete().eq('id', eventId);
  } catch {
    /* Tabele nema ili baza ne odgovara — dodela je i sama zasticena preko paypal_id. */
  }
}

/** Otkazivanje ili povracaj — pravo se gasi od tog trenutka. */
export async function revokeEntitlement(paypalId: string, reason: string): Promise<boolean> {
  try {
    const sb = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await sb
      .from('subscriptions')
      .update({ ends_at: now, note: `povuceno: ${reason}` })
      .eq('paypal_id', paypalId)
      .gt('ends_at', now);

    return !error;
  } catch {
    return false;
  }
}
