import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { commands, Album } from "../bindings";
import { LuArrowLeft, LuDisc3 } from "react-icons/lu";
import { useAlbumCoverArt } from "../hooks/useCoverArt";
import { ContextMenu, useContextMenu } from "../components/ContextMenu";

export const Route = createFileRoute("/artists_/$artistId")({
  validateSearch: (search: Record<string, unknown>) => ({
    name: typeof search.name === "string" ? search.name : undefined,
  }),
  component: ArtistDetail,
});

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

function ArtistDetail() {
  const { artistId } = Route.useParams();
  const { name } = Route.useSearch();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>([]);
  const contextMenu = useContextMenu<Album>();

  const id = parseInt(artistId);

  useEffect(() => {
    async function load() {
      const res = await commands.listAlbums(id);
      if (res.status === "ok") setAlbums(res.data);
    }
    load();
  }, [id]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center gap-4 border-b border-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-10">
        <button
          onClick={() => navigate({ to: "/artists" })}
          className="p-1.5 rounded hover:bg-bg-overlay text-fg-muted hover:text-fg-primary transition-colors"
          title="Back to artists"
        >
          <LuArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-light text-fg-primary flex-1 truncate">
          {name ?? `Artist #${artistId}`}
        </h1>
        <div className="text-xs text-fg-muted">
          {albums.length} album{albums.length !== 1 ? "s" : ""}
        </div>
      </div>

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-fg-muted">
          <LuDisc3 className="text-4xl mb-4" />
          <p>No albums found.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 content-start">
          {albums.map((album, i) => (
            <AlbumCard
              key={album.id}
              album={album}
              gradient={GRADIENTS[i % GRADIENTS.length]}
              onClick={() =>
                navigate({
                  to: "/albums/$albumId",
                  params: { albumId: String(album.id) },
                  search: { name: album.title },
                })
              }
              onContextMenu={(e) => {
                e.preventDefault();
                contextMenu.open(e, album);
              }}
            />
          ))}
        </div>
      )}

      {contextMenu.state.visible && contextMenu.state.data && (
        <ContextMenu
          x={contextMenu.state.x}
          y={contextMenu.state.y}
          onClose={contextMenu.close}
          items={[
            {
              label: "Go to tracks",
              action: () =>
                navigate({
                  to: "/albums/$albumId",
                  params: { albumId: String(contextMenu.state.data!.id) },
                  search: { name: contextMenu.state.data!.title },
                }),
            },
          ]}
        />
      )}
    </div>
  );
}

function AlbumCard({
  album,
  gradient,
  onClick,
  onContextMenu,
}: {
  album: Album;
  gradient: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const coverArt = useAlbumCoverArt(album.id);

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group cursor-pointer text-left w-full overflow-hidden"
    >
      <div
        className={`aspect-square w-full rounded-lg bg-linear-to-br ${gradient} mb-2 flex items-end p-3 shadow-lg transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-xl overflow-hidden relative`}
      >
        {coverArt && (
          <img
            src={coverArt}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {album.year && (
          <span className="relative rounded bg-black/30 px-1.5 py-0.5 text-white/70 text-[10px] backdrop-blur-sm">
            {album.year}
          </span>
        )}
      </div>
      <div className="truncate font-medium text-fg-secondary text-sm group-hover:text-fg-primary">
        {album.title}
      </div>
    </button>
  );
}
