import { fetch } from '@tauri-apps/plugin-http';
import type { MetadataService, MetadataQuery, MetadataResult } from './types';

interface LrclibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
  [key: string]: unknown;
}

export const lrclibService: MetadataService = {
  id: 'lrclib',
  name: 'lrclib',
  description: 'lrclib.net — free synced & plain lyrics, no key required',
  supportsTypes: ['track'],

  async search(query: MetadataQuery): Promise<MetadataResult[]> {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query.text)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`lrclib API error: ${response.status}`);
    }

    const data = await response.json() as LrclibTrack[];
    return data.slice(0, 10).map((item): MetadataResult => ({
      id: String(item.id),
      title: item.trackName,
      artist: item.artistName || undefined,
      album: item.albumName || undefined,
      lyrics: item.instrumental ? '[Instrumental]' : (item.plainLyrics || undefined),
      syncedLyrics: item.instrumental ? undefined : (item.syncedLyrics || undefined),
      raw: item,
    }));
  },
};
