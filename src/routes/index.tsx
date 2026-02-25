import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Album, commands, LibraryStats } from "../bindings.ts";
import { convertFileSrc } from "@tauri-apps/api/core";

export const Route = createFileRoute("/")({
  component: Index,
});

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const GRADIENTS = [
  "from-amber-700 to-orange-900",
  "from-rose-700 to-amber-800",
  "from-yellow-700 to-red-900",
  "from-orange-600 to-rose-800",
  "from-amber-600 to-yellow-900",
  "from-red-700 to-orange-900",
  "from-yellow-600 to-amber-800",
  "from-rose-600 to-red-900",
];

function Index() {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const sRes = await commands.getLibraryStats();
      if (sRes.status === "ok") setStats(sRes.data);

      const aRes = await commands.listAlbums(null);
      if (aRes.status === "ok") setAlbums(aRes.data);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="p-6">
      {/* Stats row */}
      <div className="mb-8 flex gap-4">
        <StatCard
          label="Tracks"
          value={stats?.totalTracks.toLocaleString() || "0"}
        />
        <StatCard
          label="Albums"
          value={stats?.totalAlbums.toLocaleString() || "0"}
        />
        <StatCard
          label="Artists"
          value={stats?.totalArtists.toLocaleString() || "0"}
        />
        <StatCard
          label="Size"
          value={formatBytes(stats?.totalSizeBytes || 0)}
        />
      </div>

      {/* Section header */}
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="font-light text-2xl text-fg-primary">Library</h1>
        <span className="text-fg-muted text-xs">
          {albums.length} albums
        </span>
      </div>

      {/* Album grid */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {loading
          ? (
            [...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square w-full rounded-lg bg-bg-overlay mb-2" />
                <div className="h-4 w-2/3 bg-bg-overlay rounded mb-1" />
                <div className="h-3 w-1/3 bg-bg-overlay rounded" />
              </div>
            ))
          )
          : albums.length === 0
          ? (
            <div className="col-span-full py-20 text-center">
              <div className="text-fg-muted text-sm mb-2">
                Your library is empty.
              </div>
              <div className="text-fg-muted text-xs">
                Add a collection in settings to start scanning.
              </div>
            </div>
          )
          : (
            albums.map((album, i) => (
              <AlbumCard
                key={album.id}
                {...album}
                gradient={GRADIENTS[i % GRADIENTS.length]}
              />
            ))
          )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-bg-overlay px-4 py-3">
      <div className="font-semibold text-lg text-fg-primary">{value}</div>
      <div className="text-fg-muted text-[10px] uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

function AlbumCard({
  title,
  artistId,
  year,
  coverPath,
  gradient,
}: Album & { gradient: string }) {
  return (
    <button
      type="button"
      className="group cursor-pointer text-left w-full overflow-hidden"
    >
      <div
        className={`aspect-square w-full rounded-lg bg-linear-to-br ${gradient} mb-2 flex items-end p-3 shadow-lg transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-xl overflow-hidden relative`}
      >
        {coverPath && (
          <img
            src={convertFileSrc(coverPath)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {year && (
          <span className="relative rounded bg-black/30 px-1.5 py-0.5 text-white/70 text-[10px] backdrop-blur-sm">
            {year}
          </span>
        )}
      </div>
      <div className="truncate font-medium text-fg-secondary text-sm group-hover:text-fg-primary">
        {title}
      </div>
      <div className="truncate text-fg-muted text-xs">Artist {artistId}</div>
    </button>
  );
}
