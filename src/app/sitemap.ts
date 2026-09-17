import type { MetadataRoute } from 'next';
import { absUrl } from '@/lib/config';
import { getCurrentRound } from '@/lib/data';

/**
 * sitemap.xml
 *
 * Samo javne stranice — profil, naplata i auth rute traze nalog ili nose
 * jednokratni token, pa nemaju sta u indeksu.
 *
 * `lastModified` za stranice kola vezano je za pocetak tekuceg kola: te
 * stranice se stvarno menjaju svakog kola, a staticne (cene, pravila) se
 * ne menjaju sa njima i ne treba da ih prate.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const round = await getCurrentRound().catch(() => null);
  const koloVreme = round?.deadline ? new Date(round.deadline) : new Date();

  const poKolu = ['/igraci', '/raspored', '/baza', '/igra', '/optimizator'];
  const staticne = ['/', '/paketi', '/o-nama', '/prijava', '/privatnost', '/uslovi'];

  return [
    ...staticne.map((p) => ({
      url: absUrl(p),
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: p === '/' ? 1 : 0.5
    })),
    ...poKolu.map((p) => ({
      url: absUrl(p),
      lastModified: koloVreme,
      changeFrequency: 'weekly' as const,
      priority: 0.8
    }))
  ];
}
