-- ===================================================================
-- Euro Fantasy Lab — placanja i prava pristupa
--
-- Migracija je dodatna i moze se pokrenuti vise puta bez stete.
-- Ne dira postojece kolone, ne brise podatke i ne pravi paralelni
-- sistem naloga — samo dopunjava tabelu `subscriptions` koju
-- aplikacija vec koristi i dodaje dnevnik PayPal dogadjaja.
--
-- Pokretanje: Supabase Dashboard -> SQL Editor -> nalepi i pokreni.
-- ===================================================================

begin;

-- -------------------------------------------------------------------
-- 1. Tabela pretplata — ako je nema, napravi je u obliku koji
--    aplikacija ocekuje. Ako postoji, samo se dopunjava.
-- -------------------------------------------------------------------
create table if not exists public.subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  tier        text not null check (tier in ('FREE', 'PLUS', 'PRO', 'ULTRA')),
  source      text not null default 'manual',
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.subscriptions add column if not exists paypal_id        text;
alter table public.subscriptions add column if not exists paypal_order_id  text;
alter table public.subscriptions add column if not exists plan_code        text;
alter table public.subscriptions add column if not exists status           text not null default 'active';
alter table public.subscriptions add column if not exists starts_at        timestamptz;
alter table public.subscriptions add column if not exists amount_cents     integer;
alter table public.subscriptions add column if not exists currency         text default 'EUR';
alter table public.subscriptions add column if not exists note             text;

-- Ista uplata sme da postoji tacno jednom. Ovo je poslednja odbrana od
-- duple dodele paketa kad PayPal ponovi isporuku dogadjaja.
create unique index if not exists subscriptions_paypal_id_uniq
  on public.subscriptions (paypal_id)
  where paypal_id is not null;

create index if not exists subscriptions_user_ends_idx
  on public.subscriptions (user_id, ends_at desc);

-- -------------------------------------------------------------------
-- 2. Dnevnik PayPal dogadjaja — idempotentnost webhook-a.
--    PayPal ponavlja isporuku dok ne dobije 200; upis id-ja dogadjaja
--    garantuje da se posao odradi tacno jednom.
-- -------------------------------------------------------------------
create table if not exists public.paypal_events (
  id           text primary key,
  event_type   text,
  received_at  timestamptz not null default now()
);

alter table public.paypal_events enable row level security;

-- Nikome iz aplikacije nije potreban pristup ovoj tabeli: pise je
-- iskljucivo service_role kljuc, koji zaobilazi RLS.
drop policy if exists "paypal_events bez javnog pristupa" on public.paypal_events;
create policy "paypal_events bez javnog pristupa"
  on public.paypal_events for select
  using (false);

-- -------------------------------------------------------------------
-- 3. RLS nad pretplatama.
--    Korisnik sme da vidi samo svoje pretplate. Upis ide iskljucivo
--    preko servera (service_role), nikad iz pregledaca — inace bi
--    svako mogao sam sebi da upise PRO.
-- -------------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists "vidim svoje pretplate" on public.subscriptions;
create policy "vidim svoje pretplate"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Namerno nema INSERT/UPDATE/DELETE politike za prijavljene korisnike.

-- -------------------------------------------------------------------
-- 4. Paket korisnika.
--    Funkcija koju aplikacija poziva kao rpc('moj_tier'). Racuna se
--    iskljucivo iz baze — klijent ne moze da je nadglasa.
--
--    Ako funkcija vec postoji, ne dira se. Tvoja verzija je u pogonu i
--    zna stvari koje ova migracija ne zna. Kreira se samo na praznoj
--    instalaciji, da aplikacija proradi bez dodatnog posla.
-- -------------------------------------------------------------------
do $do$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'moj_tier'
  ) then
    execute $fn$
      create function public.moj_tier(uid uuid)
      returns text
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select coalesce(
          (
            select s.tier
            from public.subscriptions s
            where s.user_id = uid
              and (s.ends_at is null or s.ends_at > now())
              and coalesce(s.status, 'active') = 'active'
            order by
              case s.tier
                when 'ULTRA' then 3
                when 'PRO'   then 2
                when 'PLUS'  then 1
                else 0
              end desc,
              s.ends_at desc nulls first
            limit 1
          ),
          'FREE'
        );
      $body$;
    $fn$;

    execute 'revoke all on function public.moj_tier(uuid) from public';
    execute 'grant execute on function public.moj_tier(uuid) to anon, authenticated';
  end if;
end
$do$;

commit;

-- ===================================================================
-- Provera posle pokretanja
-- ===================================================================
-- select column_name, data_type
--   from information_schema.columns
--  where table_name = 'subscriptions'
--  order by ordinal_position;
--
-- select public.moj_tier(auth.uid());
