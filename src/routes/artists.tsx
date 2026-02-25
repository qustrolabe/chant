import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArtistRow, commands } from "../bindings";
import { LuLayoutGrid, LuList, LuMicVocal } from "react-icons/lu";
import { useArtistCoverArt } from "../hooks/useCoverArt";
import { ContextMenu, useContextMenu } from "../components/ContextMenu";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";

export const Route = createFileRoute("/artists")({
  component: Artists,
});

const columnHelper = createColumnHelper<ArtistRow>();

function Artists() {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const columnMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<"grid" | "table">(
    () =>
      (localStorage.getItem("chant:artists:view") as "grid" | "table") ??
        "grid",
  );
  const navigate = useNavigate();
  const contextMenu = useContextMenu<ArtistRow>();

  useEffect(() => {
    async function load() {
      const res = await commands.listArtistRows();
      if (res.status === "ok") {
        setArtists(res.data);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!showColumnMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(e.target as Node) &&
        columnMenuBtnRef.current &&
        !columnMenuBtnRef.current.contains(e.target as Node)
      ) {
        setShowColumnMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColumnMenu]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        size: 280,
        cell: (info) => (
          <span className="font-semibold text-fg-primary">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("albumCount", {
        header: "Albums",
        size: 100,
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("trackCount", {
        header: "Tracks",
        size: 100,
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("totalDurationSecs", {
        header: "Total Duration",
        size: 130,
        cell: (info) => {
          const secs = info.getValue();
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          const s = Math.floor(secs % 60)
            .toString()
            .padStart(2, "0");
          return h > 0
            ? `${h}:${m.toString().padStart(2, "0")}:${s}`
            : `${m}:${s}`;
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: artists,
    columns,
    columnResizeMode: "onChange",
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function toggleView(next: "grid" | "table") {
    localStorage.setItem("chant:artists:view", next);
    setView(next);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-30">
        <h1 className="text-xl font-light text-fg-primary">Artists</h1>
        <div className="flex items-center gap-4">
          {/* View toggle */}
          <div className="flex items-center gap-1 border border-border rounded p-0.5">
            <button
              onClick={() => toggleView("grid")}
              className={`p-1.5 rounded transition-colors ${
                view === "grid"
                  ? "text-fg-primary bg-bg-overlay"
                  : "text-fg-muted hover:text-fg-secondary"
              }`}
              title="Grid view"
            >
              <LuLayoutGrid size={14} />
            </button>
            <button
              onClick={() => toggleView("table")}
              className={`p-1.5 rounded transition-colors ${
                view === "table"
                  ? "text-fg-primary bg-bg-overlay"
                  : "text-fg-muted hover:text-fg-secondary"
              }`}
              title="Table view"
            >
              <LuList size={14} />
            </button>
          </div>
          {/* Columns button — only in table mode */}
          {view === "table" && (
            <div className="relative">
              <button
                ref={columnMenuBtnRef}
                onClick={() => setShowColumnMenu((v) => !v)}
                className="text-xs text-fg-muted hover:text-fg-primary bg-bg-overlay hover:bg-bg-surface px-3 py-1.5 rounded border border-border transition-colors"
              >
                Columns
              </button>
              {showColumnMenu && (
                <div
                  ref={columnMenuRef}
                  className="absolute right-0 top-full mt-1 bg-bg-surface border border-border rounded-lg shadow-xl py-2 min-w-[180px] z-50"
                >
                  {table.getAllLeafColumns().map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-overlay cursor-pointer text-xs text-fg-secondary"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="rounded accent-accent"
                      />
                      {typeof column.columnDef.header === "string"
                        ? column.columnDef.header
                        : column.id}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="text-xs text-fg-muted">
            {artists.length} artist{artists.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {artists.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-20 text-fg-muted">
            <LuMicVocal className="text-4xl mb-4" />
            <p>No artists found in your library.</p>
          </div>
        )
        : view === "grid"
        ? (
          <div className="flex-1 min-h-0 overflow-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-5 content-start">
            {artists.map((artist) => (
              <ArtistGridCard
                key={artist.id}
                artist={artist}
                onClick={() =>
                  navigate({
                    to: "/artists/$artistId",
                    params: { artistId: String(artist.id) },
                    search: { name: artist.name },
                  })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  contextMenu.open(e, artist);
                }}
              />
            ))}
          </div>
        )
        : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table
              className="text-left text-sm border-collapse"
              style={{ width: table.getCenterTotalSize() }}
            >
              <thead className="sticky top-0 bg-bg-surface z-20">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="relative px-6 py-3 border-b border-border-strong text-[11px] font-bold uppercase tracking-wider text-fg-muted cursor-pointer hover:bg-bg-overlay transition-colors select-none"
                        style={{ width: header.getSize() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-2">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getIsSorted() && (
                            <span>
                              {header.column.getIsSorted() === "asc"
                                ? "↑"
                                : "↓"}
                            </span>
                          )}
                        </div>
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none transition-colors ${
                            header.column.getIsResizing()
                              ? "bg-accent"
                              : "bg-transparent hover:bg-fg-muted/30"
                          }`}
                        />
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() =>
                      navigate({
                        to: "/artists/$artistId",
                        params: { artistId: String(row.original.id) },
                        search: { name: row.original.name },
                      })}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      contextMenu.open(e, row.original);
                    }}
                    className="border-b border-border hover:bg-bg-overlay transition-all group cursor-pointer"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-6 py-2.5 text-fg-secondary"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
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
              label: "Go to albums",
              action: () =>
                navigate({
                  to: "/artists/$artistId",
                  params: { artistId: String(contextMenu.state.data!.id) },
                  search: { name: contextMenu.state.data!.name },
                }),
            },
          ]}
        />
      )}
    </div>
  );
}

function ArtistGridCard({
  artist,
  onClick,
  onContextMenu,
}: {
  artist: ArtistRow;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const coverArt = useArtistCoverArt(artist.id);

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group cursor-pointer text-left w-full"
    >
      <div className="aspect-square w-full rounded-lg mb-2 shadow-lg transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-xl overflow-hidden relative bg-bg-overlay flex items-center justify-center">
        {coverArt
          ? (
            <img
              src={coverArt}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
          : <LuMicVocal className="text-fg-muted/40 text-4xl" />}
      </div>
      <div className="truncate font-medium text-fg-secondary text-sm group-hover:text-fg-primary">
        {artist.name}
      </div>
    </button>
  );
}
