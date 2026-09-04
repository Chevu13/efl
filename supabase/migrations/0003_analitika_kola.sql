-- ===================================================================
-- 0003 — analiticke kolone za kolo
--
-- Aplikacija ove kolone cita od pocetka (tabela igraca, kartica igraca,
-- `trimForTier` ih skida korisnicima bez paketa), ali ih u bazi nije
-- bilo — pa su forma, prosek i vlasnistvo svuda stajali kao „—”.
--
-- Sve su dopunske: red bez njih je i dalje ispravan red.
-- Pokrece se vise puta bez stete.
-- ===================================================================

begin;

alter table public.player_rounds
  add column if not exists ownership   numeric,   -- % menadzera koji ga imaju
  add column if not exists season_avg  numeric,   -- prosek poena u sezoni
  add column if not exists minutes     numeric,   -- ocekivana minutaza
  add column if not exists price_trend numeric,   -- promena cene u odnosu na proslo kolo
  add column if not exists form        numeric[]; -- poslednjih pet kola

comment on column public.player_rounds.ownership is
  'Procenat menadzera koji igraca vec imaju u timu (Popularity iz zvanicne tabele).';
comment on column public.player_rounds.form is
  'Fantasy poeni u poslednjih pet odigranih kola, najstarije prvo.';

commit;

-- Provera:
-- select column_name from information_schema.columns
--  where table_name = 'player_rounds' order by ordinal_position;
