import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
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

  const pathname = routerState.location.pathname;
  const viewName = VIEW_NAMES[pathname] ?? "Chant";

  useEffect(() => {
    commands.getLibraryStats().then((res) => {
      if (res.status === "ok") setStats(res.data);
    });
  }, [pathname]);

  return (
    <div className="h-6 bg-bg-surface border-t border-border flex items-center px-3 text-[10px] text-fg-muted select-none gap-4">
      <span className="font-medium text-fg-secondary">{viewName}</span>
      {stats && (
        <>
          <span>{stats.totalTracks} tracks</span>
          <span>{stats.totalAlbums} albums</span>
          <span>{stats.totalArtists} artists</span>
        </>
      )}
      <div className="flex-1" />
      <span>v0.1.0</span>
    </div>
  );
}
