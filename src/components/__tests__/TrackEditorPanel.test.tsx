import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackEditorPanel, ArtistTagInput, AlbumAutocomplete } from "../TrackEditorPanel";
import { mockInvoke } from "../../test/mocks";
import type { TrackRow, Artist, Album } from "../../bindings";

// ── Fixtures ────────────────────────────────────────────────────────────────

const baseTrack: TrackRow = {
  id: 1,
  collectionId: 1,
  albumId: 2,
  artistId: 3,
  title: "My Song",
  trackNumber: 5,
  discNumber: 1,
  durationSecs: 213,
  filePath: "/music/song.mp3",
  fileSizeBytes: 8000000,
  fileFormat: "mp3",
  bitrateKbps: 320,
  sampleRateHz: 44100,
  lyrics: "Some lyrics here",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  artistName: "Test Artist",
  albumTitle: "Test Album",
  albumCoverPath: null,
};

const artists: Artist[] = [
  { id: 1, name: "Alpha", sortName: null, musicbrainzId: null, createdAt: "2024-01-01T00:00:00Z" },
  { id: 2, name: "Beta",  sortName: null, musicbrainzId: null, createdAt: "2024-01-01T00:00:00Z" },
];

const albums: Album[] = [
  { id: 1, title: "First Album",  artistId: 1, year: 2020, genre: "Rock",  coverPath: null, musicbrainzId: null, createdAt: "2024-01-01T00:00:00Z" },
  { id: 2, title: "Second Album", artistId: 2, year: 2022, genre: "Pop",   coverPath: null, musicbrainzId: null, createdAt: "2024-01-01T00:00:00Z" },
];

function setupMocks(track: TrackRow = baseTrack) {
  mockInvoke({
    get_track: track,
    list_artists: artists,
    list_albums: albums,
    update_track: track,
  });
}

/** Wait for the editor to finish loading (Save button becomes present). */
async function waitForLoaded() {
  // The Save/Discard buttons only render after loading is done (early return when loading)
  await screen.findByRole("button", { name: /^save$/i });
}

// ── TrackEditorPanel ─────────────────────────────────────────────────────────

describe("TrackEditorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", async () => {
    setupMocks();
    render(<TrackEditorPanel trackId={1} />);
    // The loading div should be present before the promise resolves
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders track title after loading", async () => {
    setupMocks();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();
    // Title appears in header and in the "Original" column
    expect(screen.getAllByText("My Song").length).toBeGreaterThan(0);
  });

  it("shows artist and album in header subtitle", async () => {
    setupMocks();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();
    expect(screen.getByText("Test Artist · Test Album")).toBeInTheDocument();
  });

  it("Save button is disabled when nothing is changed", async () => {
    setupMocks();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("Discard button is disabled when nothing is changed", async () => {
    setupMocks();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();
    expect(screen.getByRole("button", { name: /discard/i })).toBeDisabled();
  });

  it("Save button enables when title is edited", async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();

    // The title input in the "New" column has value "My Song"
    const titleInputs = screen.getAllByDisplayValue("My Song");
    await user.clear(titleInputs[0]);
    await user.type(titleInputs[0], "New Title");

    expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled();
  });

  it("Discard button enables when title is edited", async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();

    const titleInputs = screen.getAllByDisplayValue("My Song");
    await user.clear(titleInputs[0]);
    await user.type(titleInputs[0], "New Title");

    expect(screen.getByRole("button", { name: /discard/i })).toBeEnabled();
  });

  it("calls update_track when Save is clicked", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockedInvoke = vi.mocked(invoke);
    setupMocks();
    const user = userEvent.setup();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();

    const titleInputs = screen.getAllByDisplayValue("My Song");
    await user.clear(titleInputs[0]);
    await user.type(titleInputs[0], "Changed Title");

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mockedInvoke).toHaveBeenCalledWith(
        "update_track",
        expect.objectContaining({
          trackId: 1,
          input: expect.objectContaining({ title: "Changed Title" }),
        }),
      ),
    );
  });

  it("shows read-only fields: Duration, Format, Bitrate, Path", async () => {
    setupMocks();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("3:33")).toBeInTheDocument();
    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.getByText("mp3")).toBeInTheDocument();
    expect(screen.getByText("Bitrate")).toBeInTheDocument();
    expect(screen.getByText("320 kbps")).toBeInTheDocument();
    expect(screen.getByText("/music/song.mp3")).toBeInTheDocument();
  });

  it("shows not-found message for missing track", async () => {
    mockInvoke({
      get_track: () => { throw new Error("not found"); },
      list_artists: artists,
      list_albums: albums,
    });
    render(<TrackEditorPanel trackId={999} />);
    await waitFor(() => expect(screen.getByText("Track not found.")).toBeInTheDocument());
  });

  it("calls onBack when back button is clicked", async () => {
    setupMocks();
    const onBack = vi.fn();
    render(<TrackEditorPanel trackId={1} onBack={onBack} />);
    await waitForLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("artist names are shown as chips", async () => {
    setupMocks();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();
    // "Test Artist" appears in the Original column and as a chip in the New column
    expect(screen.getAllByText("Test Artist").length).toBeGreaterThan(0);
  });

  it("multi-artist names are split and shown as separate chips", async () => {
    setupMocks({ ...baseTrack, artistName: "Alice / Bob" });
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("album field shows current album value", async () => {
    setupMocks();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();
    expect(screen.getByDisplayValue("Test Album")).toBeInTheDocument();
  });

  it("dirty state clears after discarding changes", async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TrackEditorPanel trackId={1} />);
    await waitForLoaded();

    const titleInputs = screen.getAllByDisplayValue("My Song");
    await user.clear(titleInputs[0]);
    await user.type(titleInputs[0], "Dirty Title");

    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /discard/i }));
    expect(saveBtn).toBeDisabled();
  });
});

// ── ArtistTagInput ────────────────────────────────────────────────────────────

describe("ArtistTagInput", () => {
  it("renders existing artists as chips", () => {
    render(
      <ArtistTagInput
        value={["Alice", "Bob"]}
        onChange={vi.fn()}
        suggestions={artists}
        isDirty={false}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows placeholder when empty", () => {
    render(
      <ArtistTagInput value={[]} onChange={vi.fn()} suggestions={artists} isDirty={false} />,
    );
    expect(screen.getByPlaceholderText("Add artist…")).toBeInTheDocument();
  });

  it("adds an artist by pressing Enter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArtistTagInput value={[]} onChange={onChange} suggestions={[]} isDirty={false} />,
    );
    const input = screen.getByPlaceholderText("Add artist…");
    await user.type(input, "New Artist{Enter}");
    expect(onChange).toHaveBeenCalledWith(["New Artist"]);
  });

  it("adds an artist by pressing comma", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArtistTagInput value={[]} onChange={onChange} suggestions={[]} isDirty={false} />,
    );
    const input = screen.getByPlaceholderText("Add artist…");
    await user.type(input, "Comma Artist,");
    expect(onChange).toHaveBeenCalledWith(["Comma Artist"]);
  });

  it("removes last artist with Backspace on empty input", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArtistTagInput
        value={["Alice", "Bob"]}
        onChange={onChange}
        suggestions={artists}
        isDirty={false}
      />,
    );
    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenCalledWith(["Alice"]);
  });

  it("removes an artist by clicking its X button", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArtistTagInput
        value={["Alice"]}
        onChange={onChange}
        suggestions={artists}
        isDirty={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove Alice" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows filtered suggestions when typing", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArtistTagInput value={[]} onChange={onChange} suggestions={artists} isDirty={false} />,
    );
    await user.type(screen.getByPlaceholderText("Add artist…"), "alp");
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("selects a suggestion from dropdown", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArtistTagInput value={[]} onChange={onChange} suggestions={artists} isDirty={false} />,
    );
    await user.type(screen.getByPlaceholderText("Add artist…"), "alp");
    await user.click(await screen.findByText("Alpha"));
    expect(onChange).toHaveBeenCalledWith(["Alpha"]);
  });

  it("does not add duplicate artists", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArtistTagInput
        value={["Alice"]}
        onChange={onChange}
        suggestions={[]}
        isDirty={false}
      />,
    );
    await user.type(screen.getByRole("textbox"), "Alice{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies dirty styling when isDirty is true", () => {
    render(
      <ArtistTagInput
        value={["Alice"]}
        onChange={vi.fn()}
        suggestions={artists}
        isDirty={true}
      />,
    );
    const chip = screen.getByText("Alice").closest("span");
    expect(chip?.className).toContain("amber");
  });
});

// ── AlbumAutocomplete ─────────────────────────────────────────────────────────

describe("AlbumAutocomplete", () => {
  it("renders current album value", () => {
    render(
      <AlbumAutocomplete
        value="My Album"
        onChange={vi.fn()}
        suggestions={albums}
        isDirty={false}
      />,
    );
    expect(screen.getByDisplayValue("My Album")).toBeInTheDocument();
  });

  it("shows suggestions on focus when value is empty", async () => {
    const user = userEvent.setup();
    render(
      <AlbumAutocomplete value="" onChange={vi.fn()} suggestions={albums} isDirty={false} />,
    );
    await user.click(screen.getByRole("textbox"));
    expect(await screen.findByText("First Album")).toBeInTheDocument();
    expect(screen.getByText("Second Album")).toBeInTheDocument();
  });

  it("filters suggestions by typed text", async () => {
    const user = userEvent.setup();
    render(
      <AlbumAutocomplete value="First" onChange={vi.fn()} suggestions={albums} isDirty={false} />,
    );
    await user.click(screen.getByDisplayValue("First"));
    expect(await screen.findByText("First Album")).toBeInTheDocument();
    expect(screen.queryByText("Second Album")).not.toBeInTheDocument();
  });

  it("calls onChange when a suggestion is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AlbumAutocomplete value="" onChange={onChange} suggestions={albums} isDirty={false} />,
    );
    await user.click(screen.getByRole("textbox"));
    await user.click(await screen.findByText("First Album"));
    expect(onChange).toHaveBeenCalledWith("First Album");
  });

  it("calls onChange when text is typed", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AlbumAutocomplete value="" onChange={onChange} suggestions={albums} isDirty={false} />,
    );
    await user.type(screen.getByRole("textbox"), "A");
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("applies dirty styling when isDirty is true", () => {
    render(
      <AlbumAutocomplete
        value="Dirty Album"
        onChange={vi.fn()}
        suggestions={albums}
        isDirty={true}
      />,
    );
    expect(screen.getByDisplayValue("Dirty Album").className).toContain("amber");
  });
});
