import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { mockInvoke } from "../../test/mocks";
import type { TrackRow } from "../../bindings";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// TanStack Router — createFileRoute(path) returns a function that takes options
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// react-icons stub
vi.mock("react-icons/lu", () => ({
  LuTable: () => null,
  LuX: () => null,
}));

// opener plugin stub
vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(),
}));

// TrackEditorPanel stub — renders a simple div with the trackIds so we can assert it
vi.mock("../TrackEditorPanel", () => ({
  TrackEditorPanel: ({ trackIds }: { trackIds: number[] }) => (
    <div data-testid="editor-panel">Editor for {trackIds.join(",")}</div>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeTrack(overrides: Partial<TrackRow> = {}): TrackRow {
  return {
    id: 1,
    collectionId: 1,
    albumId: null,
    artistId: null,
    title: "Track One",
    trackNumber: 1,
    discNumber: null,
    durationSecs: 180,
    filePath: "/music/track1.mp3",
    fileSizeBytes: 5000000,
    fileFormat: "mp3",
    bitrateKbps: 320,
    sampleRateHz: 44100,
    lyrics: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    artistName: "Artist",
    albumTitle: "Album",
    albumCoverPath: null,
    genre: null,
    albumArtist: null,
    composer: null,
    bpm: null,
    comment: null,
    commentLang: null,
    year: null,
    lyricsLang: null,
    trackTotal: null,
    discTotal: null,
    ...overrides,
  };
}

const tracks: TrackRow[] = [
  makeTrack({ id: 1, title: "Track One" }),
  makeTrack({ id: 2, title: "Track Two" }),
  makeTrack({ id: 3, title: "Track Three" }),
];

async function renderTable() {
  mockInvoke({ list_tracks: tracks });
  // Dynamic import so vi.mock() calls above are hoisted before the module loads
  const { Table } = await import("../../routes/table");
  render(<Table />);
  await waitFor(() => screen.getByText("Track One"));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Table route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders all tracks", async () => {
    await renderTable();
    expect(screen.getByText("Track One")).toBeInTheDocument();
    expect(screen.getByText("Track Two")).toBeInTheDocument();
    expect(screen.getByText("Track Three")).toBeInTheDocument();
  });

  it("shows track count in header", async () => {
    await renderTable();
    expect(screen.getByText("3 songs")).toBeInTheDocument();
  });

  it("shows placeholder when no track is selected", async () => {
    await renderTable();
    expect(screen.getByText("Select a track to edit its tags")).toBeInTheDocument();
  });

  it("shows editor panel when a track is selected", async () => {
    await renderTable();
    const row = screen.getByText("Track One").closest("tr")!;
    fireEvent.click(row);
    expect(await screen.findByTestId("editor-panel")).toBeInTheDocument();
    expect(screen.getByText("Editor for 1")).toBeInTheDocument();
  });

  it("single-click selects one track and deselects others", async () => {
    await renderTable();
    const row1 = screen.getByText("Track One").closest("tr")!;
    const row2 = screen.getByText("Track Two").closest("tr")!;
    fireEvent.click(row1);
    fireEvent.click(row2);
    // After clicking row2, editor should show track 2
    expect(await screen.findByText("Editor for 2")).toBeInTheDocument();
  });

  it("ctrl+click toggles selection without deselecting others", async () => {
    await renderTable();
    const row1 = screen.getByText("Track One").closest("tr")!;
    const row2 = screen.getByText("Track Two").closest("tr")!;
    fireEvent.click(row1);
    fireEvent.click(row2, { ctrlKey: true });
    // Two tracks selected → editor receives both ids
    expect(await screen.findByText("Editor for 1,2")).toBeInTheDocument();
  });

  it("ctrl+click on already-selected track deselects it", async () => {
    await renderTable();
    const row1 = screen.getByText("Track One").closest("tr")!;
    fireEvent.click(row1);
    fireEvent.click(row1, { ctrlKey: true }); // toggle off
    expect(screen.getByText("Select a track to edit its tags")).toBeInTheDocument();
  });

  it("shift+click selects a range of tracks", async () => {
    await renderTable();
    const row1 = screen.getByText("Track One").closest("tr")!;
    const row3 = screen.getByText("Track Three").closest("tr")!;
    fireEvent.click(row1);
    fireEvent.click(row3, { shiftKey: true });
    // Tracks 1, 2, 3 selected → editor receives all three ids
    expect(await screen.findByText("Editor for 1,2,3")).toBeInTheDocument();
  });

  it("clear-selection button appears when tracks are selected", async () => {
    await renderTable();
    const row = screen.getByText("Track One").closest("tr")!;
    fireEvent.click(row);
    expect(await screen.findByText(/1 of 3 selected/)).toBeInTheDocument();
  });

  it("clear-selection button resets to empty state", async () => {
    await renderTable();
    const row = screen.getByText("Track One").closest("tr")!;
    fireEvent.click(row);
    const clearBtn = await screen.findByTitle("Clear selection");
    fireEvent.click(clearBtn);
    expect(screen.getByText("Select a track to edit its tags")).toBeInTheDocument();
  });
});
