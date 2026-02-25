import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlbumRow, commands } from "../bindings";
import { LuDisc3, LuLayoutGrid, LuList } from "react-icons/lu";
import { useAlbumCoverArt } from "../hooks/useCoverArt";
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

export const Route = createFileRoute("/albums")({
  component: Albums,
});

const columnHelper = createColumnHelper<AlbumRow>();

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

function Albums() {
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const columnMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<"grid" | "table">(
    () =>
      (localStorage.getItem("chant:albums:view") as "grid" | "table") ?? "grid",
  );
  const navigate = useNavigate();
  const contextMenu = useContextMenu<AlbumRow>();

  useEffect(() => {
    async function load() {
      const res = await commands.listAlbumRows();
      if (res.status === "ok") {
        setAlbums(res.data);
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
      columnHelper.accessor("title", {
        header: "Title",
        size: 250,
        cell: (info) => (
          <span className="font-semibold text-fg-primary">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("artistName", {
        header: "Artist",
        size: 200,
        cell: (info) =>
          info.getValue() || (
            <span className="text-fg-muted italic">Unknown</span>
          ),
      }),
      columnHelper.accessor("year", {
        header: "Year",
        size: 80,
        cell: (info) => info.getValue() ?? "",
      }),
      columnHelper.accessor("genre", {
        header: "Genre",
        size: 130,
        cell: (info) => info.getValue() ?? "",
      }),
      columnHelper.accessor("trackCount", {
        header: "Tracks",
        size: 90,
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
      columnHelper.accessor("totalSizeBytes", {
        header: "Size",
        size: 90,
        cell: (info) => {
          const bytes = info.getValue();
          return (bytes / (1024 * 1024)).toFixed(1) + " MB";
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: albums,
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
    localStorage.setItem("chant:albums:view", next);
    setView(next);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-30">
        <h1 className="text-xl font-light text-fg-primary">Albums</h1>
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
            {albums.length} album{albums.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {albums.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-20 text-fg-muted">
            <LuDisc3 className="text-4xl mb-4" />
            <p>No albums found in your library.</p>
          </div>
        )
        : view === "grid"
        ? (
          <div className="flex-1 min-h-0 overflow-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 content-start">
            {albums.map((album, i) => (
              <AlbumGridCard
                key={album.id}
                album={album}
                gradient={GRADIENTS[i % GRADIENTS.length]}
                onClick={() =>
                  navigate({
                    to: "/albums/$albumId",
                    params: { albumId: String(album.id) },
                    search: { name: album.title },
                  })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  contextMenu.open(e, album);
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
                        to: "/albums/$albumId",
                        params: { albumId: String(row.original.id) },
                        search: { name: row.original.title },
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

function AlbumGridCard({
  album,
  gradient,
  onClick,
  onContextMenu,
}: {
  album: AlbumRow;
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
      className="group cursor-pointer text-left w-full"
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
      <div className="truncate text-fg-muted text-xs">
        {album.artistName ?? "Unknown Artist"}
      </div>
    </button>
  );
}
