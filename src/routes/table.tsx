import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { commands, TrackRow } from "../bindings";
import { queryKeys } from "../lib/queryClient";
import {
  createColumnHelper,
  FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { useContextMenu, ContextMenu } from "../components/ContextMenu";
import { TrackEditorPanel } from "../components/TrackEditorPanel";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { convertFileSrc } from "@tauri-apps/api/core";
import { audioManager } from "@/lib/audio";

export const Route = createFileRoute("/table")({
  validateSearch: (search: Record<string, unknown>): {
    albumId?: number;
    albumName?: string;
    artistId?: number;
    artistName?: string;
  } => ({
    albumId: typeof search.albumId === "number" ? search.albumId : undefined,
    albumName: typeof search.albumName === "string" ? search.albumName : undefined,
    artistId: typeof search.artistId === "number" ? search.artistId : undefined,
    artistName: typeof search.artistName === "string" ? search.artistName : undefined,
  }),
  component: Table,
});

const columnHelper = createColumnHelper<TrackRow>();

const defaultColumnVisibility: VisibilityState = {
  trackNumber: false,
  discNumber: false,
  bitrateKbps: false,
  sampleRateHz: false,
  filePath: false,
};

const trackTextFilter: FilterFn<TrackRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue).toLowerCase();
  return (
    (row.original.title ?? "").toLowerCase().includes(q) ||
    (row.original.artistName ?? "").toLowerCase().includes(q) ||
    (row.original.albumTitle ?? "").toLowerCase().includes(q)
  );
};

function formatDuration(secs: number | null) {
  if (!secs) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}


export function Table() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const { data: tracks = [] } = useQuery({
    queryKey: queryKeys.tracks,
    queryFn: async () => {
      const res = await commands.listTracks();
      if (res.status !== "ok") throw new Error("Failed to load tracks");
      return res.data;
    },
  });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(defaultColumnVisibility);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [globalFilter, setGlobalFilter] = useState("");
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const columnMenuBtnRef = useRef<HTMLButtonElement>(null);
  const lastClickedIndexRef = useRef<number | null>(null);
  const contextMenu = useContextMenu<TrackRow>();

  // Reset selection and text filter when navigating to a different context
  useEffect(() => {
    setSelectedIds(new Set());
    setGlobalFilter("");
    lastClickedIndexRef.current = null;
  }, [search.albumId, search.artistId]);

  // Close column menu on outside click
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

  // Pre-filter by albumId or artistId from URL params
  const displayTracks = useMemo(() => {
    if (search.albumId != null) return tracks.filter((t) => t.albumId === search.albumId);
    if (search.artistId != null) return tracks.filter((t) => t.artistId === search.artistId);
    return tracks;
  }, [tracks, search.albumId, search.artistId]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("trackNumber", {
        id: "trackNumber",
        header: "#",
        size: 40,
        cell: (info) => (
          <span className="block truncate">{info.getValue() ?? ""}</span>
        ),
      }),
      columnHelper.accessor("title", {
        header: "Title",
        size: 200,
        cell: (info) => (
          <span className="block truncate font-semibold text-fg-primary">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("artistName", {
        header: "Artist",
        size: 140,
        cell: (info) =>
          info.getValue() ? (
            <span className="block truncate">{info.getValue()}</span>
          ) : (
            <span className="block truncate text-fg-muted italic">Unknown</span>
          ),
      }),
      columnHelper.accessor("albumTitle", {
        header: "Album",
        size: 140,
        cell: (info) =>
          info.getValue() ? (
            <span className="block truncate">{info.getValue()}</span>
          ) : (
            <span className="block truncate text-fg-muted italic">Unknown</span>
          ),
      }),
      columnHelper.accessor("durationSecs", {
        header: "Length",
        size: 60,
        cell: (info) => (
          <span className="block truncate">
            {formatDuration(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("fileFormat", {
        header: "Format",
        size: 70,
        cell: (info) => (
          <span className="block truncate">
            <span className="uppercase text-[10px] bg-bg-overlay px-1 py-px rounded text-fg-muted">
              {info.getValue()}
            </span>
          </span>
        ),
      }),
      columnHelper.accessor("fileSizeBytes", {
        header: "Size",
        size: 70,
        cell: (info) => (
          <span className="block truncate">
            {(info.getValue() / (1024 * 1024)).toFixed(1)} MB
          </span>
        ),
      }),
      columnHelper.accessor("discNumber", {
        id: "discNumber",
        header: "Disc",
        size: 50,
        cell: (info) => (
          <span className="block truncate">{info.getValue() ?? ""}</span>
        ),
      }),
      columnHelper.accessor("bitrateKbps", {
        id: "bitrateKbps",
        header: "Bitrate",
        size: 80,
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className="block truncate">{v != null ? `${v} kbps` : ""}</span>
          );
        },
      }),
      columnHelper.accessor("sampleRateHz", {
        id: "sampleRateHz",
        header: "Sample Rate",
        size: 90,
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className="block truncate">
              {v != null ? `${(v / 1000).toFixed(1)} kHz` : ""}
            </span>
          );
        },
      }),
      columnHelper.accessor("filePath", {
        id: "filePath",
        header: "Path",
        size: 240,
        cell: (info) => (
          <span
            className="block truncate"
            title={info.getValue()}
          >
            {info.getValue()}
          </span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: displayTracks,
    columns,
    columnResizeMode: "onChange",
    globalFilterFn: trackTextFilter,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleRows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const isFiltered = search.albumId != null || search.artistId != null || globalFilter.length > 0;

  function handleRowClick(
    e: React.MouseEvent,
    trackId: number,
    rowIndex: number,
  ) {
    if (e.shiftKey && lastClickedIndexRef.current !== null) {
      // Range select
      const start = Math.min(lastClickedIndexRef.current, rowIndex);
      const end = Math.max(lastClickedIndexRef.current, rowIndex);
      const rangeIds = visibleRows
        .slice(start, end + 1)
        .map((r) => r.original.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of rangeIds) next.add(id);
        return next;
      });
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle add/remove
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) next.delete(trackId);
        else next.add(trackId);
        return next;
      });
      lastClickedIndexRef.current = rowIndex;
    } else {
      // Single select
      setSelectedIds(new Set([trackId]));
      lastClickedIndexRef.current = rowIndex;
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-30 flex-shrink-0">
        <h1 className="text-sm font-semibold text-fg-primary flex-shrink-0">Table</h1>

        {/* Context filter chip */}
        {search.albumId != null && (
          <span className="flex items-center gap-1 text-xs bg-accent-muted text-accent px-2 py-0.5 rounded-full border border-accent/30 flex-shrink-0 max-w-[200px]">
            <span className="truncate">Album: {search.albumName}</span>
            <button
              type="button"
              onClick={() => navigate({ to: "/table" })}
              className="ml-0.5 flex-shrink-0 hover:text-fg-primary transition-colors"
              title="Clear filter"
            >
              ✕
            </button>
          </span>
        )}
        {search.artistId != null && (
          <span className="flex items-center gap-1 text-xs bg-accent-muted text-accent px-2 py-0.5 rounded-full border border-accent/30 flex-shrink-0 max-w-[200px]">
            <span className="truncate">Artist: {search.artistName}</span>
            <button
              type="button"
              onClick={() => navigate({ to: "/table" })}
              className="ml-0.5 flex-shrink-0 hover:text-fg-primary transition-colors"
              title="Clear filter"
            >
              ✕
            </button>
          </span>
        )}

        {/* Text filter input */}
        <input
          type="text"
          placeholder="Filter tracks…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="flex-1 min-w-0 max-w-xs text-xs bg-bg-overlay border border-border rounded px-2 py-0.5 text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-accent transition-colors"
        />

        {/* Song count / selection info */}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {selectedIds.size > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-fg-muted hover:text-fg-primary transition-colors"
              title="Clear selection"
            >
              ✕ {selectedIds.size} of {filteredCount} selected
            </button>
          ) : (
            <div className="text-xs text-fg-muted">
              {isFiltered
                ? `${filteredCount} of ${tracks.length} songs`
                : `${tracks.length} songs`}
            </div>
          )}

          <div className="relative">
            <button
              ref={columnMenuBtnRef}
              onClick={() => setShowColumnMenu((v) => !v)}
              className="text-xs text-fg-muted hover:text-fg-primary bg-bg-overlay hover:bg-bg-surface px-2.5 py-1 rounded border border-border transition-colors"
            >
              Columns
            </button>
            {showColumnMenu && (
              <div
                ref={columnMenuRef}
                className="absolute right-0 top-full mt-1 bg-bg-surface border border-border rounded-lg shadow-xl py-1.5 min-w-[160px] z-50"
              >
                {table.getAllLeafColumns().map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-2 px-3 py-1 hover:bg-bg-overlay cursor-pointer text-xs text-fg-secondary"
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
        </div>
      </div>

      {/* Body: table + detail panel — equal 50/50 split */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Track table — left half */}
        <div className="flex-1 overflow-auto min-w-0 border-r border-border">
          <table
            className="text-left text-xs border-collapse"
            style={{ width: table.getCenterTotalSize() }}
          >
            <thead className="sticky top-0 bg-bg-surface z-20">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="relative px-2 py-1 border-b border-border-strong text-[10px] font-bold uppercase tracking-wider text-fg-muted cursor-pointer hover:bg-bg-overlay transition-colors select-none whitespace-nowrap overflow-hidden"
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() && (
                          <span>
                            {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
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
              {visibleRows.map((row, rowIndex) => {
                const isSelected = selectedIds.has(row.original.id);
                return (
                  <tr
                    key={row.id}
                    onClick={(e) =>
                      handleRowClick(e, row.original.id, rowIndex)
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!selectedIds.has(row.original.id)) {
                        setSelectedIds(new Set([row.original.id]));
                        lastClickedIndexRef.current = rowIndex;
                      }
                      contextMenu.open(e, row.original);
                    }}
                    className={`border-b border-border transition-colors group cursor-pointer select-none ${
                      isSelected
                        ? "bg-accent-muted border-l-2 border-l-accent"
                        : "hover:bg-bg-overlay border-l-2 border-l-transparent"
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-2 py-0.5 text-fg-secondary overflow-hidden whitespace-nowrap"
                        style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right editor panel — right half, always visible */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-surface">
          {selectedIds.size === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-fg-muted text-sm select-none">
              Select a track to edit its tags
            </div>
          )}
          {selectedIds.size >= 1 && (
            <TrackEditorPanel trackIds={[...selectedIds]} />
          )}
        </div>
      </div>

      {contextMenu.state.visible && contextMenu.state.data && (
        <ContextMenu
          x={contextMenu.state.x}
          y={contextMenu.state.y}
          onClose={contextMenu.close}
          items={[
            {
              label: "Play",
              action: () => {
                const track = contextMenu.state.data;
                if (track?.filePath) {
                  audioManager.play(convertFileSrc(track.filePath), {
                    title: track.title ?? undefined,
                    artist: track.artistName ?? undefined,
                  });
                }
              },
            },
            { type: "separator" as const },
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
                  navigator.clipboard.writeText(
                    contextMenu.state.data.filePath,
                  );
                }
              },
            },
            { type: "separator" as const },
            {
              label: "Remove from library",
              disabled: true,
              action: () => {},
            },
          ]}
        />
      )}
    </div>
  );
}
