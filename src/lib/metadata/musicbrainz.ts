import { fetch } from '@tauri-apps/plugin-http';
import type { MetadataService, MetadataQuery, MetadataResult, SearchType } from './types';

const TYPE_MAP: Record<SearchType, string> = {
  track: 'recording',
  album: 'release',
  artist: 'artist',
};

interface MbRecording {
  id: string;
  title: string;
  score?: number;
  'artist-credit'?: Array<{ name?: string; artist?: { name: string } }>;
  releases?: Array<{ title: string; date?: string }>;
  [key: string]: unknown;
}

interface MbRelease {
  id: string;
  title: string;
  score?: number;
  'artist-credit'?: Array<{ name?: string; artist?: { name: string } }>;
  date?: string;
  [key: string]: unknown;
}

interface MbArtist {
  id: string;
  name: string;
  score?: number;
  [key: string]: unknown;
}

type MbItem = MbRecording | MbRelease | MbArtist;

interface MbResponse {
  recordings?: MbRecording[];
  releases?: MbRelease[];
  artists?: MbArtist[];
  count?: number;
}

function artistName(credit: Array<{ name?: string; artist?: { name: string } }> | undefined): string | undefined {
  if (!credit || credit.length === 0) return undefined;
  return credit.map((c) => c.name ?? c.artist?.name ?? '').join(', ') || undefined;
}

function mapResult(item: MbItem, type: SearchType): MetadataResult {
  if (type === 'track') {
    const rec = item as MbRecording;
    const release = rec.releases?.[0];
    const year = release?.date ? parseInt(release.date.slice(0, 4), 10) : undefined;
    return {
      id: rec.id,
      title: rec.title,
      artist: artistName(rec['artist-credit']),
      album: release?.title,
      year: isNaN(year as number) ? undefined : year,
      raw: item,
    };
  }

  if (type === 'album') {
    const rel = item as MbRelease;
    const year = rel.date ? parseInt(rel.date.slice(0, 4), 10) : undefined;
    return {
      id: rel.id,
      title: rel.title,
      artist: artistName(rel['artist-credit']),
      year: isNaN(year as number) ? undefined : year,
      raw: item,
    };
  }

  // artist
  const art = item as MbArtist;
  return {
    id: art.id,
    title: art.name,
    raw: item,
  };
}

export const musicbrainzService: MetadataService = {
  id: 'musicbrainz',
  name: 'MusicBrainz',
  description: 'MusicBrainz open music encyclopedia — free, no key required',
  supportsTypes: ['track', 'album', 'artist'],

  async search(query: MetadataQuery): Promise<MetadataResult[]> {
    const mbType = TYPE_MAP[query.type];
    const url = `https://musicbrainz.org/ws/2/${mbType}/?query=${encodeURIComponent(query.text)}&fmt=json&limit=10`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Chant/0.1.0 (https://github.com/qustrolabe/chant)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    const data = await response.json() as MbResponse;
    const items: MbItem[] = data.recordings ?? data.releases ?? data.artists ?? [];
    return items.map((item) => mapResult(item, query.type));
  },
};
