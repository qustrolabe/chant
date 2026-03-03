import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { commands, LibraryStats } from "../../bindings";

const VIEW_NAMES: Record<string, string> = {
  "/": "Library",
  "/albums": "Albums",
  "/artists": "Artists",
  "/table": "Table",
  "/settings": "Settings",
  "/debug": "Debug",
};

export function StatusBar() {
  const routerState = useRouterState();
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [scanCount, setScanCount] = useState<number | null>(null);

  const pathname = routerState.location.pathname;
  const viewName = VIEW_NAMES[pathname] ?? "Chant";

  // Fetch stats on route change
  useEffect(() => {
    commands.getLibraryStats().then((res) => {
      if (res.status === "ok") setStats(res.data);
    });
  }, [pathname]);

  // Listen to scan progress events
  useEffect(() => {
    let unlistens: Array<() => void> = [];
    let mounted = true;

    Promise.all([
      listen<number>("scan:progress", (e) => setScanCount(e.payload)),
      listen<number>("scan:complete", (e) => {
        setScanCount(null);
        setStats((prev) =>
          prev ? { ...prev, totalTracks: e.payload } : prev
        );
        // Full refresh to get accurate album/artist counts too
        commands.getLibraryStats().then((res) => {
          if (res.status === "ok") setStats(res.data);
        });
      }),
    ]).then((fns) => {
      if (mounted) {
        unlistens = fns;
      } else {
        fns.forEach((fn) => fn());
      }
    });

    return () => {
      mounted = false;
      unlistens.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className="h-6 bg-bg-surface border-t border-border flex items-center px-3 text-[10px] text-fg-muted select-none gap-4">
      <span className="font-medium text-fg-secondary">{viewName}</span>
      {scanCount !== null ? (
        <span className="text-accent">
          Scanning… {scanCount} {scanCount === 1 ? "track" : "tracks"} found
        </span>
      ) : stats ? (
        <>
          <span>{stats.totalTracks} tracks</span>
          <span>{stats.totalAlbums} albums</span>
          <span>{stats.totalArtists} artists</span>
        </>
      ) : null}
      <div className="flex-1" />
      <span>v0.1.0</span>
    </div>
  );
}
