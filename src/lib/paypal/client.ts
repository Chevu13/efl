import { PLANS, SITE, priceValue, type Plan, type PlanCode } from '../config';

/**
 * PayPal — serverski sloj. Uvozi se iskljucivo iz API ruta i server
 * komponenti; nikad iz koda koji se salje pregledacu.
 *
 * Sve ide preko servera. Klijent nikad ne vidi ni client id ni tajnu, i
 * nikad ne salje iznos: iznos se cita iz kataloga paketa u config.ts, pa
 * nema nacina da se cena podesi iz pregledaca.
 *
 * Model naplate je jednokratna uplata koja otkljucava paket na 30 dana —
 * isto sto vec radi tabela `subscriptions` (kolona `ends_at`) i sto rade
 * pristupni kodovi. Nije uveden drugi sistem naplate.
 */

const LIVE = 'https://api-m.paypal.com';
const SANDBOX = 'https://api-m.sandbox.paypal.com';

export const paypalEnv = () =>
  process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';

export const apiBase = () => (paypalEnv() === 'live' ? LIVE : SANDBOX);

/** Da li su podeseni kljucevi bez kojih naplata ne moze da radi. */
export const paypalConfigured = () =>
  Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);

export const webhookConfigured = () => Boolean(process.env.PAYPAL_WEBHOOK_ID);

/* ------------------------------------------------------------------ */
/* TOKEN                                                               */
/* ------------------------------------------------------------------ */

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new PayPalError('Nedostaju PAYPAL_CLIENT_ID i PAYPAL_SECRET.');

  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new PayPalError(`PayPal nije izdao token (${res.status}).`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: json.access_token,
    expires: Date.now() + json.expires_in * 1000
  };
  return json.access_token;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public status = 500,
    public debugId?: string
  ) {
    super(message);
    this.name = 'PayPalError';
  }
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; requestId?: string } = {}
): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      /* Isti kljuc = ista narudzbina. Stiti od duplog klika na dugme. */
      ...(init.requestId ? { 'PayPal-Request-Id': init.requestId } : {})
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store'
  });

  const text = await res.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!res.ok) {
    throw new PayPalError(
      (json.message as string) ?? `PayPal greska (${res.status})`,
      res.status,
      (json.debug_id as string) ?? undefined
    );
  }
  return json as T;
}

/* ------------------------------------------------------------------ */
/* NARUDZBINA                                                          */
/* ------------------------------------------------------------------ */

export type PayPalLink = { href: string; rel: string; method?: string };

export type PayPalOrder = {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  links?: PayPalLink[];
  purchase_units?: {
    custom_id?: string;
    invoice_id?: string;
    amount?: { value: string; currency_code: string };
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount?: { value: string; currency_code: string };
        custom_id?: string;
      }[];
    };
  }[];
};

/**
 * `custom_id` nosi kome uplata pripada i koji paket je kupljen.
 * Webhook i povratna stranica citaju isti zapis, pa se pravo dodeljuje
 * identicno bez obzira na to sta stigne prvo.
 */
export const encodeRef = (userId: string, plan: PlanCode, nadogradnjaOd?: string) =>
  nadogradnjaOd ? `${userId}|${plan}|${nadogradnjaOd}` : `${userId}|${plan}`;

export function decodeRef(ref: string | undefined | null): {
  userId: string | null;
  plan: PlanCode | null;
  /** Id pretplate koja se nadogradjuje; prazno kod obicne kupovine. */
  nadogradnjaOd: string | null;
} {
  if (!ref) return { userId: null, plan: null, nadogradnjaOd: null };
  const [userId, plan, nadogradnjaOd] = ref.split('|');
  const known = PLANS.find((p) => p.code === plan);
  return {
    userId: userId || null,
    plan: known ? known.code : null,
    nadogradnjaOd: nadogradnjaOd || null
  };
}

export async function createOrder(args: {
  plan: Plan;
  userId: string;
  returnUrl: string;
  cancelUrl: string;
  requestId?: string;
  /** Nadogradnja: naplacuje se razlika i ide oznaka osnove u custom_id. */
  nadogradnja?: { osnovaId: string; osnovaNaziv: string; iznosCents: number; vaziDo: string };
}): Promise<PayPalOrder> {
  const { plan, userId, returnUrl, cancelUrl, requestId, nadogradnja } = args;
  const vaziDo = nadogradnja
    ? new Date(nadogradnja.vaziDo).toLocaleDateString('sr-RS', { timeZone: 'Europe/Belgrade' })
    : null;

  return call<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    requestId,
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          /* Iznos dolazi iskljucivo sa servera, iz kataloga paketa. */
          amount: {
            currency_code: SITE.currency,
            value: priceValue(nadogradnja?.iznosCents ?? plan.priceCents)
          },
          description: nadogradnja
            ? `${SITE.name} nadogradnja ${nadogradnja.osnovaNaziv} → ${plan.name}, vazi do ${vaziDo}`
            : `${SITE.name} ${plan.name} — ${plan.days} dana pristupa`,
          custom_id: encodeRef(userId, plan.code, nadogradnja?.osnovaId),
          invoice_id: `EFL-${plan.code}-${userId.slice(0, 8)}-${Date.now().toString(36)}`
        }
      ],
      application_context: {
        brand_name: SITE.name,
        locale: 'sr-RS',
        landing_page: 'NO_PREFERENCE',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    }
  });
}

export const approveUrl = (order: PayPalOrder) =>
  order.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href ?? null;

export const getOrder = (id: string) => call<PayPalOrder>(`/v2/checkout/orders/${id}`);

/**
 * Naplata odobrene narudzbine. PayPal vraca 422 sa
 * `ORDER_ALREADY_CAPTURED` ako je vec naplacena — to nije greska nego
 * ocekivan ishod kad korisnik osvezi povratnu stranicu.
 */
export async function captureOrder(id: string, requestId?: string): Promise<PayPalOrder> {
  try {
    return await call<PayPalOrder>(`/v2/checkout/orders/${id}/capture`, {
      method: 'POST',
      requestId: requestId ?? `capture-${id}`,
      body: {}
    });
  } catch (e) {
    if (e instanceof PayPalError && (e.status === 422 || e.status === 400)) {
      const existing = await getOrder(id);
      if (existing.status === 'COMPLETED') return existing;
    }
    throw e;
  }
}

/** Prva naplata iz narudzbine — njen id je ono sto se pamti u bazi. */
export function captureOf(order: PayPalOrder) {
  const cap = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!cap) return null;
  return {
    id: cap.id,
    status: cap.status,
    amount: Number(cap.amount?.value ?? 0),
    currency: cap.amount?.currency_code ?? SITE.currency,
    ref: cap.custom_id ?? order.purchase_units?.[0]?.custom_id ?? null
  };
}

/* ------------------------------------------------------------------ */
/* WEBHOOK                                                             */
/* ------------------------------------------------------------------ */

/**
 * Provera potpisa. Bez nje bi bilo ko mogao da posalje lazan dogadjaj na
 * nasu adresu i sam sebi ukljuci paket.
 */
export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const res = await call<{ verification_status: string }>(
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      body: {
        auth_algo: headers.get('paypal-auth-algo'),
        cert_url: headers.get('paypal-cert-url'),
        transmission_id: headers.get('paypal-transmission-id'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        transmission_time: headers.get('paypal-transmission-time'),
        webhook_id: webhookId,
        webhook_event: event
      }
    }
  );

  return res.verification_status === 'SUCCESS';
}
