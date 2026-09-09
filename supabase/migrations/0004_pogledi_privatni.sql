-- ===================================================================
-- Euro Fantasy Lab — pogledi nad istorijom nisu za pregledac
--
-- Migracija 0002 je istorijske tabele otvorila za citanje svima, sto je
-- ispravno: to su zvanicni EuroLeague podaci koje svako moze da preuzme.
-- Pogledi su druga prica.
--
-- `el_player_season_avg` daje po igracu i sezoni minutazu, poene i
-- fantasy prosek — bas ono sto `trimForTier` skida sa FREE naloga pre
-- nego sto podaci odu u pregledac. Kako Supabase novim pogledima po
-- podrazumevanom pravilu daje `select` ulogama `anon` i `authenticated`,
-- FREE nalog je mogao da ih procita direktno preko PostgREST-a i sam
-- sastavi formu i prosek.
--
-- Uz to, pogled se izvrsava sa pravima vlasnika, pa zaobilazi RLS nad
-- `public.players` koju `el_defense_vs_position` spaja.
--
-- Nijedan pogled se ne cita iz aplikacije — koriste ih samo skripte,
-- a one idu preko `service_role`, na koji se ovo oduzimanje ne odnosi.
--
-- Migracija je dodatna i moze se pokrenuti vise puta.
-- ===================================================================

begin;

revoke select on public.el_player_season_avg    from anon, authenticated;
revoke select on public.el_defense_vs_position  from anon, authenticated;

commit;

-- ===================================================================
-- Provera posle pokretanja — oba upita moraju da vrate 0 redova
-- ===================================================================
-- select table_name, grantee from information_schema.role_table_grants
--  where table_name in ('el_player_season_avg', 'el_defense_vs_position')
--    and grantee in ('anon', 'authenticated');
