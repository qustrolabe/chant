import { fetch } from '@tauri-apps/plugin-http';
import type { MetadataService, MetadataQuery, MetadataResult, SearchType } from './types';

const ENTITY_MAP: Record<SearchType, string> = {
  track: 'musicTrack',
  album: 'album',
  artist: 'musicArtist',
};

interface ItunesTrack {
  trackId?: number;
  collectionId?: number;
  artistId?: number;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  collectionCensoredName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  [key: string]: unknown;
}

function mapResult(item: ItunesTrack, type: SearchType): MetadataResult {
  const year = item.releaseDate
    ? new Date(item.releaseDate as string).getFullYear()
    : undefined;

  const id = String(item.trackId ?? item.collectionId ?? item.artistId ?? Math.random());
  const title = (item.trackName ?? item.collectionName ?? item.artistName ?? '') as string;

  return {
    id,
    title,
    artist: item.artistName as string | undefined,
    album: type === 'track' ? (item.collectionName as string | undefined) : undefined,
    year: isNaN(year as number) ? undefined : year,
    coverUrl: item.artworkUrl100
      ? (item.artworkUrl100 as string).replace('100x100bb', '300x300bb')
      : undefined,
    previewUrl: item.previewUrl as string | undefined,
    raw: item,
  };
}

export const itunesService: MetadataService = {
  id: 'itunes',
  name: 'iTunes',
  description: 'Apple iTunes Search API — free, no key required',
  supportsTypes: ['track', 'album', 'artist'],

  async search(query: MetadataQuery): Promise<MetadataResult[]> {
    const entity = ENTITY_MAP[query.type];
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query.text)}&entity=${entity}&limit=10`;

    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`iTunes API error: ${response.status}`);
    }

    const data = await response.json() as { results?: ItunesTrack[] };
    return (data.results ?? []).map((item) => mapResult(item, query.type));
  },
};
