import { useEffect, useState } from "react";
import { commands } from "../bindings";

export type { CoverArt } from "../bindings";

// Cache cover art data URLs by album ID to avoid re-reading files
const coverCache = new Map<number, string | null>();
// Track in-flight requests to avoid duplicate calls for same album
const pending = new Map<number, Promise<string | null>>();

/**
 * Returns a data URL for the embedded cover art of a track.
 * Caches by albumId so all tracks in the same album share one lookup.
 */
export function useCoverArt(
  trackId: number,
  albumId: number | null,
): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (albumId != null && coverCache.has(albumId)) {
      return coverCache.get(albumId)!;
    }
    return null;
  });

  useEffect(() => {
    const key = albumId ?? -trackId; // tracks without album get their own key

    if (coverCache.has(key)) {
      setSrc(coverCache.get(key)!);
      return;
    }

    let cancelled = false;

    // Deduplicate in-flight requests
    let promise = pending.get(key);
    if (!promise) {
      promise = commands.getCoverArt(trackId).then((res) => {
        if (res.status === "ok" && res.data) {
          const url = `data:${res.data.mimeType};base64,${res.data.data}`;
          coverCache.set(key, url);
          return url;
        }
        coverCache.set(key, null);
        return null;
      });
      pending.set(key, promise);
    }

    promise.then((url) => {
      pending.delete(key);
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [trackId, albumId]);

  return src;
}

// Separate cache for album cover lookups
const albumCoverCache = new Map<number, string | null>();
const albumPending = new Map<number, Promise<string | null>>();

/**
 * Returns a data URL for cover art of an album.
 * Reads embedded art from the first track in the album.
 */
export function useAlbumCoverArt(albumId: number): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (albumCoverCache.has(albumId)) {
      return albumCoverCache.get(albumId)!;
    }
    return null;
  });

  useEffect(() => {
    if (albumCoverCache.has(albumId)) {
      setSrc(albumCoverCache.get(albumId)!);
      return;
    }

    let cancelled = false;

    let promise = albumPending.get(albumId);
    if (!promise) {
      promise = commands.getAlbumCoverArt(albumId).then((res) => {
        if (res.status === "ok" && res.data) {
          const url = `data:${res.data.mimeType};base64,${res.data.data}`;
          albumCoverCache.set(albumId, url);
          return url;
        }
        albumCoverCache.set(albumId, null);
        return null;
      });
      albumPending.set(albumId, promise);
    }

    promise.then((url) => {
      albumPending.delete(albumId);
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [albumId]);

  return src;
}

// Separate cache for artist cover lookups
const artistCoverCache = new Map<number, string | null>();
const artistPending = new Map<number, Promise<string | null>>();

/**
 * Returns a data URL for cover art of an artist.
 * Reads embedded art from the first track by that artist.
 */
export function useArtistCoverArt(artistId: number): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (artistCoverCache.has(artistId)) {
      return artistCoverCache.get(artistId)!;
    }
    return null;
  });

  useEffect(() => {
    if (artistCoverCache.has(artistId)) {
      setSrc(artistCoverCache.get(artistId)!);
      return;
    }

    let cancelled = false;

    let promise = artistPending.get(artistId);
    if (!promise) {
      promise = commands.getArtistCoverArt(artistId).then((res) => {
        if (res.status === "ok" && res.data) {
          const url = `data:${res.data.mimeType};base64,${res.data.data}`;
          artistCoverCache.set(artistId, url);
          return url;
        }
        artistCoverCache.set(artistId, null);
        return null;
      });
      artistPending.set(artistId, promise);
    }

    promise.then((url) => {
      artistPending.delete(artistId);
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [artistId]);

  return src;
}
