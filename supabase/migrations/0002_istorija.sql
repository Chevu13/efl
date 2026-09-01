-- ===================================================================
-- Euro Fantasy Lab — istorijski dataset iz zvanicnog EuroLeague API-ja
--
-- Zasto odvojene tabele umesto sirenja postojece `player_stats`:
--
--   `player_stats` je vezana za NAS model kola — `round_id → rounds.id`,
--   `player_id → players.id` (nasi slugovi tipa `dejulius-d-bes`) i
--   `fixture_id → fixtures.id`. Da bismo u nju smestili 2 sezone istorije
--   morali bismo da izmisljamo lazna kola i mecevе u `rounds`/`fixtures`,
--   i da nateramo 450+ istorijskih igraca u tabelu koja drzi 312 aktivnih.
--   To bi zaprljalo tabele od kojih zavisi aplikacija koja radi.
--
--   Zato istorija zivi u `el_*` tabelama sa ZVANICNIM EuroLeague
--   identifikatorima kao kljucevima. Nas proizvod se za njih kaci preko
--   jedne mape (`players.el_person_code`, `teams.el_code`), pa svaka
--   strana moze da se menja bez lomljenja druge.
--
-- Migracija je dodatna i moze se pokrenuti vise puta.
-- ===================================================================

begin;

-- -------------------------------------------------------------------
-- 1. Mapiranje na nase entitete
--
--    EuroLeague koristi svoje kodove timova (MAD, ULK, PAN, RED…), mi
--    svoje (RMB, FBB, PAO, CZV…). Bez ove mape istorija se ne moze
--    spojiti sa aplikacijom.
-- -------------------------------------------------------------------
alter table public.teams   add column if not exists el_code          text;
alter table public.players add column if not exists el_person_code   text;

create unique index if not exists teams_el_code_uniq
  on public.teams (el_code) where el_code is not null;

create index if not exists players_el_person_code_idx
  on public.players (el_person_code) where el_person_code is not null;

-- -------------------------------------------------------------------
-- 2. Sezone
-- -------------------------------------------------------------------
create table if not exists public.el_seasons (
  code            text primary key,             -- 'E2025'
  year            integer not null,             -- 2025  (= sezona 2025-26)
  alias           text,                         -- '2025-26'
  name            text,
  competition     text not null default 'E',
  start_date      date,
  end_date        date,
  winner_code     text,
  winner_name     text,
  is_complete     boolean not null default false,
  imported_at     timestamptz
);

-- -------------------------------------------------------------------
-- 3. Timovi kako ih vodi EuroLeague
-- -------------------------------------------------------------------
create table if not exists public.el_teams (
  code            text not null,                -- 'MAD'
  season_year     integer not null,
  name            text not null,
  abbreviated     text,
  tv_code         text,
  country         text,
  city            text,
  crest_url       text,
  primary key (code, season_year)
);

-- -------------------------------------------------------------------
-- 4. Igraci
-- -------------------------------------------------------------------
create table if not exists public.el_players (
  person_code     text primary key,             -- '007200' (bez 'P')
  name            text not null,                -- 'LARKIN, SHANE'
  jersey_name     text,
  birth_date      date,
  country         text,
  height_cm       integer,
  weight_kg       integer,
  headshot_url    text,
  updated_at      timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- 5. Utakmice
--
--    `game_code` je jedinstven samo unutar sezone, pa je kljuc slozen.
-- -------------------------------------------------------------------
create table if not exists public.el_games (
  season_year     integer not null,
  game_code       integer not null,
  round           integer,
  phase_code      text,                         -- 'RS' | 'PO' | 'FF' | 'PI'
  phase_name      text,
  played          boolean not null default false,
  tip_off         timestamptz,
  local_date      timestamptz,
  home_code       text not null,
  away_code       text not null,
  home_score      integer,
  away_score      integer,
  home_q1 integer, home_q2 integer, home_q3 integer, home_q4 integer, home_ot integer,
  away_q1 integer, away_q2 integer, away_q3 integer, away_q4 integer, away_ot integer,
  venue           text,
  audience        integer,
  home_coach      text,
  away_coach      text,
  primary key (season_year, game_code)
);

create index if not exists el_games_round_idx  on public.el_games (season_year, round);
create index if not exists el_games_home_idx   on public.el_games (season_year, home_code);
create index if not exists el_games_away_idx   on public.el_games (season_year, away_code);
create index if not exists el_games_date_idx   on public.el_games (tip_off);

-- -------------------------------------------------------------------
-- 6. PLAYER × GAME — srce dataseta
--
--    Jedan red = jedan igrac u jednoj utakmici. Sve kolone dolaze iz
--    boxscore-a; nista se ne racuna unapred osim `fantasy_pts`, koje su
--    izvedene po zvanicnim fantasy pravilima i cuvane da se ne racunaju
--    pri svakom upitu.
-- -------------------------------------------------------------------
create table if not exists public.el_player_games (
  season_year     integer not null,
  game_code       integer not null,
  person_code     text not null,

  -- kontekst
  team_code       text not null,
  opponent_code   text not null,
  is_home         boolean not null,
  round           integer,
  phase_code      text,
  game_date       timestamptz,
  team_score      integer,
  opponent_score  integer,
  won             boolean,

  -- ucesce
  dorsal          integer,
  is_starter      boolean not null default false,
  did_play        boolean not null default false,
  seconds_played  integer,                      -- iz 'MM:SS'
  minutes         numeric(5,2),                 -- izvedeno, radi lakseg upita

  -- osnovna statistika
  points          integer,
  fgm2 integer, fga2 integer,
  fgm3 integer, fga3 integer,
  ftm  integer, fta  integer,
  fgm_total integer, fga_total integer,
  offensive_rebounds integer,
  defensive_rebounds integer,
  total_rebounds     integer,
  assists         integer,
  steals          integer,
  turnovers       integer,
  blocks_favour   integer,                      -- blokade koje je napravio
  blocks_against  integer,                      -- blokade primljene
  fouls_committed integer,
  fouls_drawn     integer,
  pir             integer,                      -- valuation
  plus_minus      integer,

  -- izvedeno
  fantasy_pts     numeric(6,2),

  imported_at     timestamptz not null default now(),

  primary key (season_year, game_code, person_code),
  foreign key (season_year, game_code) references public.el_games (season_year, game_code) on delete cascade
);

create index if not exists el_pg_person_idx   on public.el_player_games (person_code, season_year);
create index if not exists el_pg_team_idx     on public.el_player_games (season_year, team_code);
create index if not exists el_pg_opponent_idx on public.el_player_games (season_year, opponent_code);
create index if not exists el_pg_date_idx     on public.el_player_games (game_date);
create index if not exists el_pg_round_idx    on public.el_player_games (season_year, round);

-- -------------------------------------------------------------------
-- 7. Timski total po utakmici — za tempo, posede i matchup analizu
-- -------------------------------------------------------------------
create table if not exists public.el_team_games (
  season_year     integer not null,
  game_code       integer not null,
  team_code       text not null,
  opponent_code   text not null,
  is_home         boolean not null,
  round           integer,
  points          integer,
  opponent_points integer,
  won             boolean,
  fgm2 integer, fga2 integer,
  fgm3 integer, fga3 integer,
  ftm  integer, fta  integer,
  offensive_rebounds integer,
  defensive_rebounds integer,
  total_rebounds     integer,
  assists         integer,
  steals          integer,
  turnovers       integer,
  blocks_favour   integer,
  blocks_against  integer,
  fouls_committed integer,
  fouls_drawn     integer,
  pir             integer,
  primary key (season_year, game_code, team_code),
  foreign key (season_year, game_code) references public.el_games (season_year, game_code) on delete cascade
);

-- -------------------------------------------------------------------
-- 8. RLS — istorija je javna za citanje, pise je samo server
-- -------------------------------------------------------------------
do $rls$
declare t text;
begin
  foreach t in array array[
    'el_seasons', 'el_teams', 'el_players', 'el_games',
    'el_player_games', 'el_team_games'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "istorija je javna" on public.%I', t);
    execute format(
      'create policy "istorija je javna" on public.%I for select using (true)', t
    );
  end loop;
end
$rls$;

-- -------------------------------------------------------------------
-- 9. Pogledi za formu i matchup — ono zbog cega dataset i postoji
-- -------------------------------------------------------------------

-- Sezonski prosek po igracu, samo utakmice u kojima je igrao.
create or replace view public.el_player_season_avg as
select
  person_code,
  season_year,
  count(*)                                as games_played,
  count(*) filter (where is_starter)      as games_started,
  round(avg(minutes)::numeric, 1)         as minutes,
  round(avg(points)::numeric, 1)          as points,
  round(avg(total_rebounds)::numeric, 1)  as rebounds,
  round(avg(assists)::numeric, 1)         as assists,
  round(avg(steals)::numeric, 1)          as steals,
  round(avg(blocks_favour)::numeric, 1)   as blocks,
  round(avg(turnovers)::numeric, 1)       as turnovers,
  round(avg(pir)::numeric, 1)             as pir,
  round(avg(fantasy_pts)::numeric, 1)     as fantasy_pts,
  round(stddev_samp(fantasy_pts)::numeric, 1) as fantasy_stddev
from public.el_player_games
where did_play
group by person_code, season_year;

-- Koliko koji tim dopusta fantasy poena po poziciji protivnika.
-- Osnova za ocenu tezine meca.
create or replace view public.el_defense_vs_position as
select
  g.season_year,
  g.opponent_code                       as defending_team,
  p.position                            as position,
  count(*)                              as sample_games,
  round(avg(g.fantasy_pts)::numeric, 1) as fantasy_allowed,
  round(avg(g.points)::numeric, 1)      as points_allowed
from public.el_player_games g
join public.players p on p.el_person_code = g.person_code
where g.did_play and p.position is not null
group by g.season_year, g.opponent_code, p.position;

commit;

-- ===================================================================
-- Provera posle pokretanja
-- ===================================================================
-- select season_year, count(*) from public.el_games group by 1;
-- select season_year, count(*) from public.el_player_games group by 1;
-- select * from public.el_player_season_avg order by fantasy_pts desc limit 10;
