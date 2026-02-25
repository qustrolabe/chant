import { useEffect, useRef, useState } from "react";
import { commands, Artist, Album, TrackRow, TrackUpdateInput } from "../bindings";
import { LuArrowLeft, LuX, LuPlus } from "react-icons/lu";

function formatDuration(secs: number | null): string {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── ArtistTagInput ──────────────────────────────────────────────────────────

export function ArtistTagInput({
  value,
  onChange,
  suggestions,
  isDirty,
}: {
  value: string[];
  onChange: (val: string[]) => void;
  suggestions: Artist[];
  isDirty: boolean;
}) {
  const [inputText, setInputText] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = inputText.trim()
    ? suggestions.filter(
        (a) =>
          a.name.toLowerCase().includes(inputText.toLowerCase()) &&
          !value.includes(a.name),
      )
    : [];

  function addArtist(name: string) {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInputText("");
    setOpen(false);
  }

  function removeArtist(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addArtist(inputText);
    } else if (e.key === "Backspace" && inputText === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap gap-1 rounded px-1.5 py-1 min-h-[28px] cursor-text border transition-all ${
          isDirty
            ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/30"
            : "border-transparent hover:border-border focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/30"
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((name) => (
          <span
            key={name}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
              isDirty ? "bg-amber-500/20 text-amber-200" : "bg-bg-overlay text-fg-secondary"
            }`}
          >
            {name}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); removeArtist(name); }}
              className="hover:text-danger transition-colors"
              aria-label={`Remove ${name}`}
            >
              <LuX size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none text-fg-primary placeholder:text-fg-muted"
          placeholder={value.length === 0 ? "Add artist…" : ""}
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputText.trim()) addArtist(inputText); }}
        />
        {inputText.trim() && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); addArtist(inputText); }}
            className="text-fg-muted hover:text-fg-primary transition-colors"
            aria-label="Add artist"
          >
            <LuPlus size={12} />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute left-0 top-full mt-0.5 z-50 w-full max-h-48 overflow-auto rounded-lg border border-border bg-bg-surface shadow-xl py-1 text-sm">
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-bg-overlay text-fg-secondary hover:text-fg-primary transition-colors"
                onMouseDown={(e) => { e.preventDefault(); addArtist(a.name); }}
              >
                {a.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── AlbumAutocomplete ───────────────────────────────────────────────────────

export function AlbumAutocomplete({
  value,
  onChange,
  suggestions,
  isDirty,
}: {
  value: string;
  onChange: (val: string) => void;
  suggestions: Album[];
  isDirty: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? suggestions.filter((a) =>
        a.title.toLowerCase().includes(value.toLowerCase()),
      )
    : suggestions.slice(0, 8);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <input
        className={`w-full bg-transparent rounded px-2 py-1 text-sm outline-none focus:ring-1 transition-all ${
          isDirty
            ? "text-amber-300 ring-1 ring-amber-500/50 bg-amber-500/5"
            : "text-fg-primary hover:bg-bg-overlay focus:ring-accent/40"
        }`}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Album title…"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 top-full mt-0.5 z-50 w-full max-h-48 overflow-auto rounded-lg border border-border bg-bg-surface shadow-xl py-1 text-sm">
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-bg-overlay text-fg-secondary hover:text-fg-primary transition-colors"
                onMouseDown={(e) => { e.preventDefault(); onChange(a.title); setOpen(false); }}
              >
                {a.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── TrackEditorPanel ────────────────────────────────────────────────────────

interface FormData {
  title: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  lyrics: string | null;
  artistNames: string[];   // multi-value: joined with " / " on save
  albumTitle: string | null;
}

function trackToForm(track: TrackRow): FormData {
  return {
    title: track.title,
    trackNumber: track.trackNumber,
    discNumber: track.discNumber,
    lyrics: track.lyrics,
    // Split existing artist name by " / " for multi-value display
    artistNames: track.artistName
      ? track.artistName.split(" / ").map((s) => s.trim()).filter(Boolean)
      : [],
    albumTitle: track.albumTitle,
  };
}

export function TrackEditorPanel({
  trackId,
  onBack,
}: {
  trackId: number;
  onBack?: () => void;
}) {
  const [track, setTrack] = useState<TrackRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: null,
    trackNumber: null,
    discNumber: null,
    lyrics: null,
    artistNames: [],
    albumTitle: null,
  });
  const [artistSuggestions, setArtistSuggestions] = useState<Artist[]>([]);
  const [albumSuggestions, setAlbumSuggestions] = useState<Album[]>([]);

  useEffect(() => {
    setLoading(true);
    setTrack(null);
    async function load() {
      try {
        const [trackRes, artistsRes, albumsRes] = await Promise.all([
          commands.getTrack(trackId),
          commands.listArtists(),
          commands.listAlbums(null),
        ]);
        if (trackRes.status === "ok") {
          setTrack(trackRes.data);
          setFormData(trackToForm(trackRes.data));
        }
        if (artistsRes.status === "ok") setArtistSuggestions(artistsRes.data);
        if (albumsRes.status === "ok") setAlbumSuggestions(albumsRes.data);
      } catch {
        // track stays null → "Track not found." is rendered below
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [trackId]);

  function discard() {
    if (!track) return;
    setFormData(trackToForm(track));
  }

  async function save() {
    if (!track) return;
    setSaving(true);
    const input: TrackUpdateInput = {
      title: formData.title,
      trackNumber: formData.trackNumber,
      discNumber: formData.discNumber,
      lyrics: formData.lyrics,
      // Join multiple artists with " / ", empty string clears the field
      artistName:
        formData.artistNames.length > 0
          ? formData.artistNames.join(" / ")
          : "",
      albumTitle: formData.albumTitle ?? "",
    };
    const res = await commands.updateTrack(trackId, input);
    if (res.status === "ok") {
      setTrack(res.data);
      setFormData(trackToForm(res.data));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      // Refresh suggestions after save (new artists/albums may have been created)
      const [artistsRes, albumsRes] = await Promise.all([
        commands.listArtists(),
        commands.listAlbums(null),
      ]);
      if (artistsRes.status === "ok") setArtistSuggestions(artistsRes.data);
      if (albumsRes.status === "ok") setAlbumSuggestions(albumsRes.data);
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="p-6 text-fg-muted text-sm">Loading…</div>;
  }
  if (!track) {
    return <div className="p-6 text-danger text-sm">Track not found.</div>;
  }

  const isDirty =
    formData.title !== track.title ||
    formData.trackNumber !== track.trackNumber ||
    formData.discNumber !== track.discNumber ||
    formData.lyrics !== track.lyrics ||
    formData.artistNames.join(" / ") !==
      (track.artistName
        ? track.artistName.split(" / ").map((s) => s.trim()).filter(Boolean).join(" / ")
        : "") ||
    (formData.albumTitle ?? "") !== (track.albumTitle ?? "");

  function rowClass(dirty: boolean) {
    return `border-b border-border transition-colors ${dirty ? "bg-amber-500/5" : ""}`;
  }

  function inputClass(dirty: boolean) {
    return `w-full bg-transparent rounded px-2 py-1 text-sm outline-none focus:ring-1 transition-all ${
      dirty
        ? "text-amber-300 ring-1 ring-amber-500/50"
        : "text-fg-primary hover:bg-bg-overlay focus:ring-accent/40"
    }`;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center gap-3 border-b border-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="p-1 rounded hover:bg-bg-overlay text-fg-muted hover:text-fg-primary transition-colors flex-shrink-0"
          >
            <LuArrowLeft size={15} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-fg-primary truncate">
            {track.title}
          </div>
          <div className="text-xs text-fg-muted truncate">
            {[track.artistName, track.albumTitle].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={discard}
            disabled={!isDirty}
            className="text-xs text-fg-muted hover:text-fg-primary bg-bg-overlay hover:bg-bg-surface px-2.5 py-1 rounded border border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={!isDirty || saving || saved}
            className={`text-xs font-medium px-2.5 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              saved
                ? "bg-success text-bg-base"
                : "bg-accent hover:bg-accent-hover text-bg-base"
            }`}
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* Tag table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-bg-surface z-20">
            <tr>
              <th className="px-3 py-2 border-b border-border-strong text-[10px] font-bold uppercase tracking-wider text-fg-muted text-left w-24">
                Field
              </th>
              <th className="px-3 py-2 border-b border-border-strong text-[10px] font-bold uppercase tracking-wider text-fg-muted text-left w-1/3">
                Original
              </th>
              <th className="px-3 py-2 border-b border-border-strong text-[10px] font-bold uppercase tracking-wider text-fg-muted text-left">
                New
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Title */}
            {(() => {
              const dirty = formData.title !== track.title;
              return (
                <tr className={rowClass(dirty)}>
                  <td className="px-3 py-2 text-fg-muted font-medium">Title</td>
                  <td className="px-3 py-2 text-fg-secondary text-xs">{track.title ?? "—"}</td>
                  <td className="px-3 py-1">
                    <input
                      className={inputClass(dirty)}
                      value={formData.title ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value || null })
                      }
                    />
                  </td>
                </tr>
              );
            })()}

            {/* Artist — editable, multi-value with suggestions */}
            {(() => {
              const originalNames = track.artistName
                ? track.artistName.split(" / ").map((s) => s.trim()).filter(Boolean)
                : [];
              const dirty =
                formData.artistNames.join(" / ") !== originalNames.join(" / ");
              return (
                <tr className={rowClass(dirty)}>
                  <td className="px-3 py-2 text-fg-muted font-medium align-top pt-2.5">Artist</td>
                  <td className="px-3 py-2 text-fg-secondary text-xs align-top pt-2.5">
                    {track.artistName ?? "—"}
                  </td>
                  <td className="px-3 py-1">
                    <ArtistTagInput
                      value={formData.artistNames}
                      onChange={(names) => setFormData({ ...formData, artistNames: names })}
                      suggestions={artistSuggestions}
                      isDirty={dirty}
                    />
                  </td>
                </tr>
              );
            })()}

            {/* Album — editable, autocomplete */}
            {(() => {
              const dirty = (formData.albumTitle ?? "") !== (track.albumTitle ?? "");
              return (
                <tr className={rowClass(dirty)}>
                  <td className="px-3 py-2 text-fg-muted font-medium">Album</td>
                  <td className="px-3 py-2 text-fg-secondary text-xs">{track.albumTitle ?? "—"}</td>
                  <td className="px-3 py-1">
                    <AlbumAutocomplete
                      value={formData.albumTitle ?? ""}
                      onChange={(val) =>
                        setFormData({ ...formData, albumTitle: val || null })
                      }
                      suggestions={albumSuggestions}
                      isDirty={dirty}
                    />
                  </td>
                </tr>
              );
            })()}

            {/* Track # */}
            {(() => {
              const dirty = formData.trackNumber !== track.trackNumber;
              return (
                <tr className={rowClass(dirty)}>
                  <td className="px-3 py-2 text-fg-muted font-medium">Track #</td>
                  <td className="px-3 py-2 text-fg-secondary text-xs">{track.trackNumber ?? "—"}</td>
                  <td className="px-3 py-1">
                    <input
                      type="number"
                      min={0}
                      className={inputClass(dirty)}
                      value={formData.trackNumber ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          trackNumber: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })()}

            {/* Disc # */}
            {(() => {
              const dirty = formData.discNumber !== track.discNumber;
              return (
                <tr className={rowClass(dirty)}>
                  <td className="px-3 py-2 text-fg-muted font-medium">Disc #</td>
                  <td className="px-3 py-2 text-fg-secondary text-xs">{track.discNumber ?? "—"}</td>
                  <td className="px-3 py-1">
                    <input
                      type="number"
                      min={0}
                      className={inputClass(dirty)}
                      value={formData.discNumber ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discNumber: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })()}

            {/* Lyrics */}
            {(() => {
              const dirty = formData.lyrics !== track.lyrics;
              return (
                <tr className={rowClass(dirty)}>
                  <td className="px-3 py-2 text-fg-muted font-medium align-top pt-2.5">Lyrics</td>
                  <td className="px-3 py-2 text-fg-secondary text-xs align-top pt-2.5">
                    {track.lyrics
                      ? track.lyrics.slice(0, 40) + (track.lyrics.length > 40 ? "…" : "")
                      : "—"}
                  </td>
                  <td className="px-3 py-1">
                    <textarea
                      rows={4}
                      className={`${inputClass(dirty)} resize-none text-xs leading-relaxed`}
                      value={formData.lyrics ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, lyrics: e.target.value || null })
                      }
                    />
                  </td>
                </tr>
              );
            })()}

            {/* Section divider */}
            <tr>
              <td colSpan={3} className="px-3 py-1">
                <div className="border-t border-border-strong" />
              </td>
            </tr>

            {/* Read-only: Duration */}
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-fg-muted font-medium">Duration</td>
              <td className="px-3 py-2 text-fg-secondary text-xs">
                {formatDuration(track.durationSecs)}
              </td>
              <td className="px-3 py-2 text-fg-muted italic text-xs">(read-only)</td>
            </tr>

            {/* Read-only: Format */}
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-fg-muted font-medium">Format</td>
              <td className="px-3 py-2 text-fg-secondary text-xs">{track.fileFormat ?? "—"}</td>
              <td className="px-3 py-2 text-fg-muted italic text-xs">(read-only)</td>
            </tr>

            {/* Read-only: Bitrate */}
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-fg-muted font-medium">Bitrate</td>
              <td className="px-3 py-2 text-fg-secondary text-xs">
                {track.bitrateKbps != null ? `${track.bitrateKbps} kbps` : "—"}
              </td>
              <td className="px-3 py-2 text-fg-muted italic text-xs">(read-only)</td>
            </tr>

            {/* Read-only: Path */}
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-fg-muted font-medium">Path</td>
              <td
                className="px-3 py-2 text-fg-secondary text-xs font-mono truncate max-w-[120px]"
                title={track.filePath}
              >
                {track.filePath}
              </td>
              <td className="px-3 py-2 text-fg-muted italic text-xs">(read-only)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
