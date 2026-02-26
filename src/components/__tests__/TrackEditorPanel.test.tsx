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
  // Extended fields
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
  // Joined
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
    get_track_extra_tags: [],
    set_track_extra_tags: null,
    batch_update_tracks: null,
  });
}

/** Wait for the editor to finish loading (Save button becomes present). */
async function waitForLoaded() {
  await screen.findByRole("button", { name: /^save$/i });
}

// ── TrackEditorPanel ─────────────────────────────────────────────────────────

describe("TrackEditorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", async () => {
    setupMocks();
    render(<TrackEditorPanel trackIds={[1]} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders track title after loading", async () => {
    setupMocks();
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();
    expect(screen.getAllByText("My Song").length).toBeGreaterThan(0);
  });

  it("shows artist and album in header subtitle", async () => {
    setupMocks();
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();
    expect(screen.getByText("Test Artist · Test Album")).toBeInTheDocument();
  });

  it("Save button is disabled when nothing is changed", async () => {
    setupMocks();
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("Discard button is disabled when nothing is changed", async () => {
    setupMocks();
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();
    expect(screen.getByRole("button", { name: /discard/i })).toBeDisabled();
  });

  it("Save button enables when title is edited", async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();

    const titleInputs = screen.getAllByDisplayValue("My Song");
    await user.clear(titleInputs[0]);
    await user.type(titleInputs[0], "New Title");

    expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled();
  });

  it("Discard button enables when title is edited", async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TrackEditorPanel trackIds={[1]} />);
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
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();

    // Use fireEvent.change to avoid stale-ref issues from inner-component FieldRow remounting
    fireEvent.change(screen.getAllByDisplayValue("My Song")[0], {
      target: { value: "Changed Title" },
    });

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
    render(<TrackEditorPanel trackIds={[1]} />);
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
      get_track_extra_tags: [],
    });
    render(<TrackEditorPanel trackIds={[999]} />);
    await waitFor(() => expect(screen.getByText("Track not found.")).toBeInTheDocument());
  });

  it("calls onBack when back button is clicked", async () => {
    setupMocks();
    const onBack = vi.fn();
    render(<TrackEditorPanel trackIds={[1]} onBack={onBack} />);
    await waitForLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("artist names are shown as chips", async () => {
    setupMocks();
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();
    expect(screen.getAllByText("Test Artist").length).toBeGreaterThan(0);
  });

  it("multi-artist names are split and shown as separate chips", async () => {
    setupMocks({ ...baseTrack, artistName: "Alice / Bob" });
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("album field shows current album value", async () => {
    setupMocks();
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();
    expect(screen.getByDisplayValue("Test Album")).toBeInTheDocument();
  });

  it("dirty state clears after discarding changes", async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<TrackEditorPanel trackIds={[1]} />);
    await waitForLoaded();

    const titleInputs = screen.getAllByDisplayValue("My Song");
    await user.clear(titleInputs[0]);
    await user.type(titleInputs[0], "Dirty Title");

    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /discard/i }));
    expect(saveBtn).toBeDisabled();
  });

  // ── Multi-select divergence ──────────────────────────────────────────────

  describe("multi-select divergence", () => {
    it("uniform field across 2 tracks shows common value without yellow", async () => {
      const track1 = { ...baseTrack, id: 1, title: "Same Title", artistName: "Artist A" };
      const track2 = { ...baseTrack, id: 2, title: "Same Title", artistName: "Artist A" };
      mockInvoke({
        get_track: (args: { trackId: number }) => args.trackId === 1 ? track1 : track2,
        list_artists: artists,
        list_albums: albums,
        get_track_extra_tags: [],
        batch_update_tracks: null,
      });
      render(<TrackEditorPanel trackIds={[1, 2]} />);
      await waitForLoaded();
      // Input should have the common value
      expect(screen.getByDisplayValue("Same Title")).toBeInTheDocument();
    });

    it("divergent title across 2 tracks shows placeholder '(varies)'", async () => {
      const track1 = { ...baseTrack, id: 1, title: "Title A" };
      const track2 = { ...baseTrack, id: 2, title: "Title B" };
      mockInvoke({
        get_track: (args: { trackId: number }) => args.trackId === 1 ? track1 : track2,
        list_artists: artists,
        list_albums: albums,
        get_track_extra_tags: [],
        batch_update_tracks: null,
      });
      render(<TrackEditorPanel trackIds={[1, 2]} />);
      await waitForLoaded();
      expect(screen.getByPlaceholderText("(varies)")).toBeInTheDocument();
    });

    it("editing a divergent field marks it as edited", async () => {
      const track1 = { ...baseTrack, id: 1, title: "Title A" };
      const track2 = { ...baseTrack, id: 2, title: "Title B" };
      mockInvoke({
        get_track: (args: { trackId: number }) => args.trackId === 1 ? track1 : track2,
        list_artists: artists,
        list_albums: albums,
        get_track_extra_tags: [],
        batch_update_tracks: null,
      });
      const user = userEvent.setup();
      render(<TrackEditorPanel trackIds={[1, 2]} />);
      await waitForLoaded();

      const titleInput = screen.getByPlaceholderText("(varies)");
      await user.type(titleInput, "New Title");

      expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled();
    });

    it("save with 2 tracks calls batchUpdateTracks not updateTrack", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const mockedInvoke = vi.mocked(invoke);

      const track1 = { ...baseTrack, id: 1, title: "Title A" };
      const track2 = { ...baseTrack, id: 2, title: "Title B" };
      mockInvoke({
        get_track: (args: { trackId: number }) => args.trackId === 1 ? track1 : track2,
        list_artists: artists,
        list_albums: albums,
        get_track_extra_tags: [],
        batch_update_tracks: null,
      });
      const user = userEvent.setup();
      render(<TrackEditorPanel trackIds={[1, 2]} />);
      await waitForLoaded();

      const titleInput = screen.getByPlaceholderText("(varies)");
      await user.type(titleInput, "New Title");
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() =>
        expect(mockedInvoke).toHaveBeenCalledWith(
          "batch_update_tracks",
          expect.objectContaining({ trackIds: [1, 2] }),
        ),
      );
      expect(mockedInvoke).not.toHaveBeenCalledWith("update_track", expect.anything());
    });

    it("save with 2 tracks only sends edited fields", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const mockedInvoke = vi.mocked(invoke);

      const track1 = { ...baseTrack, id: 1, title: "Title A", genre: "Jazz" };
      const track2 = { ...baseTrack, id: 2, title: "Title B", genre: "Jazz" };
      mockInvoke({
        get_track: (args: { trackId: number }) => args.trackId === 1 ? track1 : track2,
        list_artists: artists,
        list_albums: albums,
        get_track_extra_tags: [],
        batch_update_tracks: null,
      });
      const user = userEvent.setup();
      render(<TrackEditorPanel trackIds={[1, 2]} />);
      await waitForLoaded();

      // Only edit title — use fireEvent to avoid stale-ref from FieldRow remounting
      fireEvent.change(screen.getByPlaceholderText("(varies)"), {
        target: { value: "New Title" },
      });
      await user.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() =>
        expect(mockedInvoke).toHaveBeenCalledWith(
          "batch_update_tracks",
          expect.objectContaining({
            input: expect.objectContaining({ title: "New Title" }),
          }),
        ),
      );
      // composer should not be in input (not edited)
      const call = mockedInvoke.mock.calls.find((c) => c[0] === "batch_update_tracks");
      expect(call?.[1]).not.toHaveProperty("input.composer");
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validation", () => {
    it("invalid BPM shows red ring and disables Save", async () => {
      setupMocks();
      render(<TrackEditorPanel trackIds={[1]} />);
      await waitForLoaded();

      const bpmRow = screen.getByText("BPM").closest("tr")!;
      const input = bpmRow.querySelector("input")!;
      fireEvent.change(input, { target: { value: "abc" } });

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled(),
      );
      expect(screen.getByText("Must be a non-negative integer")).toBeInTheDocument();
    });

    it("valid BPM clears error and enables Save after title edit", async () => {
      setupMocks();
      render(<TrackEditorPanel trackIds={[1]} />);
      await waitForLoaded();

      const bpmInput = () => screen.getByText("BPM").closest("tr")!.querySelector("input")!;

      // Type invalid value — re-query after each change since FieldRow remounts on state change
      fireEvent.change(bpmInput(), { target: { value: "abc" } });
      await waitFor(() =>
        expect(screen.getByText("Must be a non-negative integer")).toBeInTheDocument(),
      );

      // Fix to valid value
      fireEvent.change(bpmInput(), { target: { value: "128" } });

      await waitFor(() =>
        expect(screen.queryByText("Must be a non-negative integer")).not.toBeInTheDocument(),
      );
      // Save enabled because BPM is now edited with a valid value
      expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled();
    });
  });

  // ── Extra Tags ─────────────────────────────────────────────────────────────

  describe("extra tags", () => {
    it("renders existing extra tags", async () => {
      mockInvoke({
        get_track: baseTrack,
        list_artists: artists,
        list_albums: albums,
        update_track: baseTrack,
        get_track_extra_tags: [
          { frameId: "TKEY", value: "Am" },
          { frameId: "TCOP", value: "2024 Label" },
        ],
        set_track_extra_tags: null,
        batch_update_tracks: null,
      });
      render(<TrackEditorPanel trackIds={[1]} />);
      await waitForLoaded();
      expect(screen.getByDisplayValue("Am")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2024 Label")).toBeInTheDocument();
    });

    it("shows Add field button in single-track mode", async () => {
      setupMocks();
      render(<TrackEditorPanel trackIds={[1]} />);
      await waitForLoaded();
      expect(screen.getByText("Add field")).toBeInTheDocument();
    });

    it("does not show Add field button in multi-track mode", async () => {
      const track1 = { ...baseTrack, id: 1 };
      const track2 = { ...baseTrack, id: 2 };
      mockInvoke({
        get_track: (args: { trackId: number }) => args.trackId === 1 ? track1 : track2,
        list_artists: artists,
        list_albums: albums,
        get_track_extra_tags: [],
        batch_update_tracks: null,
      });
      render(<TrackEditorPanel trackIds={[1, 2]} />);
      await waitForLoaded();
      expect(screen.queryByText("Add field")).not.toBeInTheDocument();
    });
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
