/** Informaciona arhitektura proizvoda — jedno mesto za sve navigacije. */
export type NavLink = {
  href: string;
  label: string;
  desc: string;
  /** Oznaka da je deo placenog dela proizvoda. */
  premium?: boolean;
};

export const PRIMARY: NavLink[] = [
  { href: '/igraci', label: 'Izbori kola', desc: 'Igraci koji vrede svoju cenu' },
  { href: '/baza', label: 'Baza igraca', desc: 'Cela liga sa cenom i formom' },
  { href: '/raspored', label: 'Izazov kola', desc: 'Mecevi kola, procene i glasanje za izazov' },
  { href: '/igra', label: 'Moj tim', desc: 'Kadar, formacija, kapiten i trener' },
  { href: '/optimizator', label: 'Optimizator', desc: 'Najbolje zamene za tvoju postavu', premium: true }
];

export const ACCOUNT: NavLink[] = [
  { href: '/profil', label: 'Profil', desc: 'Paket, uplate i statistika' }
];

export const isActive = (path: string, href: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
