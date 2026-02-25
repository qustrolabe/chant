import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { commands, TrackRow } from "../bindings";
import { LuArrowLeft, LuMusic } from "react-icons/lu";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ContextMenu, useContextMenu } from "../components/ContextMenu";

export const Route = createFileRoute("/albums_/$albumId")({
  validateSearch: (search: Record<string, unknown>) => ({
    name: typeof search.name === "string" ? search.name : undefined,
  }),
  component: AlbumDetail,
});

function formatDuration(secs: number | null): string {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function AlbumDetail() {
  const { albumId } = Route.useParams();
  const { name } = Route.useSearch();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const contextMenu = useContextMenu<TrackRow>();

  const id = parseInt(albumId);
  const albumTitle = tracks[0]?.albumTitle ?? name ?? `Album #${albumId}`;

  useEffect(() => {
    async function load() {
      const res = await commands.listTracksByAlbum(id);
      if (res.status === "ok") setTracks(res.data);
    }
    load();
  }, [id]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-10">
        <button
          onClick={() => navigate({ to: "/albums" })}
          className="p-1.5 rounded hover:bg-bg-overlay text-fg-muted hover:text-fg-primary transition-colors"
          title="Back to albums"
        >
          <LuArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-light text-fg-primary flex-1 truncate">
          {name ?? albumTitle}
        </h1>
        <div className="text-xs text-fg-muted">
          {tracks.length} track{tracks.length !== 1 ? "s" : ""}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-fg-muted">
          <LuMusic className="text-4xl mb-4" />
          <p>No tracks found.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 bg-bg-surface z-20">
              <tr>
                <th className="px-4 py-3 border-b border-border-strong text-[11px] font-bold uppercase tracking-wider text-fg-muted w-12">#</th>
                <th className="px-4 py-3 border-b border-border-strong text-[11px] font-bold uppercase tracking-wider text-fg-muted">Title</th>
                <th className="px-4 py-3 border-b border-border-strong text-[11px] font-bold uppercase tracking-wider text-fg-muted">Artist</th>
                <th className="px-4 py-3 border-b border-border-strong text-[11px] font-bold uppercase tracking-wider text-fg-muted w-20">Duration</th>
                <th className="px-4 py-3 border-b border-border-strong text-[11px] font-bold uppercase tracking-wider text-fg-muted w-20">Format</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr
                  key={track.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    contextMenu.open(e, track);
                  }}
                  className="border-b border-border hover:bg-bg-overlay transition-colors"
                >
                  <td className="px-4 py-2.5 text-fg-muted text-xs">
                    {track.trackNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-fg-primary font-medium">
                    {track.title}
                  </td>
                  <td className="px-4 py-2.5 text-fg-secondary">
                    {track.artistName ?? (
                      <span className="italic text-fg-muted">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted text-xs">
                    {formatDuration(track.durationSecs)}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted text-xs">
                    {track.fileFormat ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contextMenu.state.visible && contextMenu.state.data && (
        <ContextMenu
          x={contextMenu.state.x}
          y={contextMenu.state.y}
          onClose={contextMenu.close}
          items={[
            {
              label: "Show in explorer",
              action: () => {
                if (contextMenu.state.data?.filePath) {
                  revealItemInDir(contextMenu.state.data.filePath);
                }
              },
            },
            {
              label: "Copy file path",
              action: () => {
                if (contextMenu.state.data?.filePath) {
                  navigator.clipboard.writeText(contextMenu.state.data.filePath);
                }
              },
            },
          ]}
        />
      )}
    </div>
  );
}
