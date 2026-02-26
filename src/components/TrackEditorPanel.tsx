import { useEffect, useRef, useState } from "react";
import {
  commands,
  Artist,
  Album,
  TrackRow,
  TrackUpdateInput,
  ExtraTag,
} from "../bindings";
import { LuArrowLeft, LuX, LuPlus } from "react-icons/lu";
import { LangPicker } from "./LangPicker";
import { FIELD_VALIDATORS } from "../lib/validators";

// ── Formatters ───────────────────────────────────────────────────────────────

function formatDuration(secs: number | null): string {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Field State ──────────────────────────────────────────────────────────────

type FieldState<T> =
  | { kind: "uniform"; value: T }
  | { kind: "divergent"; values: T[] }
  | { kind: "edited"; value: T };

function computeField<T>(
  tracks: TrackRow[],
  extract: (t: TrackRow) => T,
  eq: (a: T, b: T) => boolean = (a, b) => a === b,
): FieldState<T> {
  const values = tracks.map(extract);
  return values.every((v) => eq(v, values[0]))
    ? { kind: "uniform", value: values[0] }
    : { kind: "divergent", values };
}

function displayValue<T>(fs: FieldState<T>): T | null {
  return fs.kind === "divergent" ? null : fs.value;
}

// ── Color coding ─────────────────────────────────────────────────────────────

function rowCls(fs: FieldState<unknown>, err?: string): string {
  if (err) return "bg-red-500/10";
  if (fs.kind === "edited") return "bg-amber-500/5 border-l-2 border-l-amber-500/50";
  if (fs.kind === "divergent") return "bg-yellow-500/5 border-l-2 border-l-yellow-500/40";
  return "";
}

function inputCls(fs: FieldState<unknown>, err?: string): string {
  const base = "w-full bg-transparent rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 transition-all";
  if (err) return `${base} ring-1 ring-red-500/60 text-red-400 placeholder:text-red-400/60`;
  if (fs.kind === "edited") return `${base} ring-1 ring-amber-500/40 text-amber-300`;
  if (fs.kind === "divergent") return `${base} ring-1 ring-yellow-500/40 text-yellow-300/70`;
  return `${base} text-fg-primary hover:bg-bg-overlay focus:ring-accent/40`;
}

// ── ArtistTagInput ───────────────────────────────────────────────────────────

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
        className={`flex flex-wrap gap-1 rounded px-1 py-0.5 min-h-[24px] cursor-text border transition-all ${
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
          className="flex-1 min-w-[80px] bg-transparent text-xs outline-none text-fg-primary placeholder:text-fg-muted"
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

// ── AlbumAutocomplete ────────────────────────────────────────────────────────

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
        className={`w-full bg-transparent rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 transition-all ${
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

// ── Field definitions ─────────────────────────────────────────────────────────

const ADDABLE_FRAMES = [
  { id: "TKEY", label: "Initial Key" },
  { id: "TCOP", label: "Copyright" },
  { id: "TPUB", label: "Publisher" },
  { id: "TIT3", label: "Subtitle" },
  { id: "TIT1", label: "Grouping" },
  { id: "TEXT", label: "Lyricist" },
  { id: "TENC", label: "Encoded By" },
  { id: "TMED", label: "Media Type" },
  { id: "TSRC", label: "ISRC" },
  { id: "TOPE", label: "Original Artist" },
];

// ── TrackEditorPanel ──────────────────────────────────────────────────────────

interface EditState {
  title: FieldState<string>;
  artistNames: FieldState<string[]>;
  albumTitle: FieldState<string | null>;
  albumArtist: FieldState<string | null>;
  composer: FieldState<string | null>;
  year: FieldState<string | null>;    // stored as string for input
  genre: FieldState<string | null>;
  trackNumber: FieldState<string | null>;
  discNumber: FieldState<string | null>;
  bpm: FieldState<string | null>;
  comment: FieldState<string | null>;
  commentLang: FieldState<string | null>;
  lyrics: FieldState<string | null>;
  lyricsLang: FieldState<string | null>;
}

function buildEditState(tracks: TrackRow[]): EditState {
  return {
    title: computeField(tracks, (t) => t.title),
    artistNames: computeField(
      tracks,
      (t) => t.artistName ? t.artistName.split(" / ").map((s) => s.trim()).filter(Boolean) : [],
      (a, b) => a.join(",") === b.join(","),
    ),
    albumTitle: computeField(tracks, (t) => t.albumTitle ?? null),
    albumArtist: computeField(tracks, (t) => t.albumArtist ?? null),
    composer: computeField(tracks, (t) => t.composer ?? null),
    year: computeField(tracks, (t) => t.year != null ? String(t.year) : null),
    genre: computeField(tracks, (t) => t.genre ?? null),
    trackNumber: computeField(tracks, (t) => {
      if (t.trackNumber == null) return null;
      return t.trackTotal != null ? `${t.trackNumber}/${t.trackTotal}` : String(t.trackNumber);
    }),
    discNumber: computeField(tracks, (t) => {
      if (t.discNumber == null) return null;
      return t.discTotal != null ? `${t.discNumber}/${t.discTotal}` : String(t.discNumber);
    }),
    bpm: computeField(tracks, (t) => t.bpm != null ? String(t.bpm) : null),
    comment: computeField(tracks, (t) => t.comment ?? null),
    commentLang: computeField(tracks, (t) => t.commentLang ?? null),
    lyrics: computeField(tracks, (t) => t.lyrics ?? null),
    lyricsLang: computeField(tracks, (t) => t.lyricsLang ?? null),
  };
}

function parseTrackDisc(val: string | null): { num: number | null; total: number | null } {
  if (!val) return { num: null, total: null };
  const parts = val.split("/");
  return {
    num: parseInt(parts[0]) || null,
    total: parts[1] ? parseInt(parts[1]) || null : null,
  };
}

// ── Row helpers (defined outside component so React doesn't remount on every render) ──

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={3}
        className="px-2 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-fg-muted bg-bg-surface border-b border-border-strong"
      >
        {label}
      </td>
    </tr>
  );
}

function OriginalCell({ value }: { value: string | null }) {
  return (
    <td className="w-28 px-2 py-1 text-fg-muted/50 text-[10px] truncate max-w-[112px]">
      {value ?? "—"}
    </td>
  );
}

function FieldRow({
  label,
  fs,
  originalValue,
  err,
  children,
}: {
  label: string;
  fs: FieldState<unknown>;
  originalValue?: string | null;
  err?: string;
  children: React.ReactNode;
}) {
  return (
    <tr className={`border-b border-white/5 text-xs ${rowCls(fs, err)}`}>
      <td className="w-20 shrink-0 px-2 py-1 text-fg-muted whitespace-nowrap">{label}</td>
      <OriginalCell value={originalValue ?? null} />
      <td className="px-1 py-0.5 w-full">
        {children}
        {err && <div className="text-[9px] text-red-400 px-1 pt-0.5">{err}</div>}
      </td>
    </tr>
  );
}

export function TrackEditorPanel({
  trackIds,
  onBack,
}: {
  trackIds: number[];
  onBack?: () => void;
}) {
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [artistSuggestions, setArtistSuggestions] = useState<Artist[]>([]);
  const [albumSuggestions, setAlbumSuggestions] = useState<Album[]>([]);
  const [extraTags, setExtraTags] = useState<ExtraTag[]>([]);
  const [extraTagErrors, setExtraTagErrors] = useState<Record<string, string>>({});
  const [showAddFrame, setShowAddFrame] = useState(false);
  const isSingle = trackIds.length === 1;

  useEffect(() => {
    setLoading(true);
    setEditState(null);
    setExtraTags([]);
    async function load() {
      try {
        const [trackResults, artistsRes, albumsRes] = await Promise.all([
          Promise.all(trackIds.map((id) => commands.getTrack(id))),
          commands.listArtists(),
          commands.listAlbums(null),
        ]);
        const loadedTracks = trackResults
          .filter((r) => r.status === "ok")
          .map((r) => (r as { status: "ok"; data: TrackRow }).data);
        setTracks(loadedTracks);
        setEditState(buildEditState(loadedTracks));
        if (artistsRes.status === "ok") setArtistSuggestions(artistsRes.data);
        if (albumsRes.status === "ok") setAlbumSuggestions(albumsRes.data);
        // Load extra tags for single-track mode
        if (trackIds.length === 1) {
          const extraRes = await commands.getTrackExtraTags(trackIds[0]);
          if (extraRes.status === "ok") setExtraTags(extraRes.data);
        }
      } catch {
        // stays loading=false, editState=null
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [trackIds.join(",")]);

  function getEdited<T>(field: keyof EditState): T | null {
    if (!editState) return null;
    const fs = editState[field] as FieldState<T>;
    return fs.kind === "edited" ? fs.value : null;
  }

  function setField<T>(field: keyof EditState, value: T) {
    setEditState((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: { kind: "edited" as const, value } };
    });
  }

  function validate(): boolean {
    const errs: Partial<Record<string, string>> = {};
    const bpmVal = editState?.bpm;
    if (bpmVal?.kind === "edited" && bpmVal.value) {
      const e = FIELD_VALIDATORS.bpm(bpmVal.value);
      if (e) errs.bpm = e;
    }
    const yearVal = editState?.year;
    if (yearVal?.kind === "edited" && yearVal.value) {
      const e = FIELD_VALIDATORS.year(yearVal.value);
      if (e) errs.year = e;
    }
    const tnVal = editState?.trackNumber;
    if (tnVal?.kind === "edited" && tnVal.value) {
      const e = FIELD_VALIDATORS.trackNumber(tnVal.value);
      if (e) errs.trackNumber = e;
    }
    const dnVal = editState?.discNumber;
    if (dnVal?.kind === "edited" && dnVal.value) {
      const e = FIELD_VALIDATORS.discNumber(dnVal.value);
      if (e) errs.discNumber = e;
    }
    // Extra tag validators
    const eteErrs: Record<string, string> = {};
    for (const tag of extraTags) {
      const validator = FIELD_VALIDATORS[tag.frame_id];
      if (validator && tag.value) {
        const e = validator(tag.value);
        if (e) eteErrs[tag.frame_id] = e;
      }
    }
    setErrors(errs);
    setExtraTagErrors(eteErrs);
    return Object.keys(errs).length === 0 && Object.keys(eteErrs).length === 0;
  }

  const hasAnyEdit = editState
    ? (Object.values(editState) as FieldState<unknown>[]).some((fs) => fs.kind === "edited")
    : false;

  const hasValidationErrors = Object.keys(errors).length > 0 || Object.keys(extraTagErrors).length > 0;

  function discard() {
    if (!editState || tracks.length === 0) return;
    setEditState(buildEditState(tracks));
    setErrors({});
    setExtraTagErrors({});
  }

  async function save() {
    if (!editState) return;
    if (!validate()) return;

    setSaving(true);

    // Build the input — only include edited fields
    const input: TrackUpdateInput = {};

    const es = editState;
    if (es.title.kind === "edited") input.title = es.title.value || null;
    if (es.artistNames.kind === "edited") {
      input.artistName = es.artistNames.value.length > 0
        ? es.artistNames.value.join(" / ")
        : "";
    }
    if (es.albumTitle.kind === "edited") input.albumTitle = es.albumTitle.value ?? "";
    if (es.albumArtist.kind === "edited") input.albumArtist = es.albumArtist.value ?? "";
    if (es.composer.kind === "edited") input.composer = es.composer.value ?? "";
    if (es.genre.kind === "edited") input.genre = es.genre.value ?? "";
    if (es.year.kind === "edited") {
      input.year = es.year.value ? parseInt(es.year.value) : null;
    }
    if (es.bpm.kind === "edited") {
      input.bpm = es.bpm.value ? parseInt(es.bpm.value) : null;
    }
    if (es.comment.kind === "edited") input.comment = es.comment.value ?? "";
    if (es.commentLang.kind === "edited") input.commentLang = es.commentLang.value ?? "";
    if (es.lyrics.kind === "edited") input.lyrics = es.lyrics.value ?? "";
    if (es.lyricsLang.kind === "edited") input.lyricsLang = es.lyricsLang.value ?? "";
    if (es.trackNumber.kind === "edited") {
      const { num, total } = parseTrackDisc(es.trackNumber.value);
      input.trackNumber = num;
      input.trackTotal = total;
    }
    if (es.discNumber.kind === "edited") {
      const { num, total } = parseTrackDisc(es.discNumber.value);
      input.discNumber = num;
      input.discTotal = total;
    }

    try {
      if (isSingle) {
        const res = await commands.updateTrack(trackIds[0], input);
        if (res.status === "ok") {
          const updated = res.data;
          setTracks([updated]);
          setEditState(buildEditState([updated]));
          // Save extra tags
          await commands.setTrackExtraTags(trackIds[0], extraTags);
        }
      } else {
        await commands.batchUpdateTracks(trackIds, input);
        // Reload all tracks
        const results = await Promise.all(trackIds.map((id) => commands.getTrack(id)));
        const reloaded = results
          .filter((r) => r.status === "ok")
          .map((r) => (r as { status: "ok"; data: TrackRow }).data);
        setTracks(reloaded);
        setEditState(buildEditState(reloaded));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      // Refresh suggestions
      const [artistsRes, albumsRes] = await Promise.all([
        commands.listArtists(),
        commands.listAlbums(null),
      ]);
      if (artistsRes.status === "ok") setArtistSuggestions(artistsRes.data);
      if (albumsRes.status === "ok") setAlbumSuggestions(albumsRes.data);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-fg-muted text-xs">Loading…</div>;
  }
  if (!editState || tracks.length === 0) {
    return <div className="p-4 text-danger text-xs">Track not found.</div>;
  }

  const firstTrack = tracks[0];

  const divState: FieldState<unknown> =
    editState.title.kind === "divergent" ? editState.title : { kind: "uniform", value: null };

  const headerLabel = isSingle
    ? firstTrack.title
    : `${trackIds.length} tracks selected`;

  const headerSub = isSingle
    ? [firstTrack.artistName, firstTrack.albumTitle].filter(Boolean).join(" · ") || "—"
    : "";

  return (
    <div className="h-full flex flex-col text-xs">
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="p-1 rounded hover:bg-bg-overlay text-fg-muted hover:text-fg-primary transition-colors flex-shrink-0"
          >
            <LuArrowLeft size={13} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-fg-primary truncate">{headerLabel}</div>
          {headerSub && <div className="text-[10px] text-fg-muted truncate">{headerSub}</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={discard}
            disabled={!hasAnyEdit}
            className="text-[10px] text-fg-muted hover:text-fg-primary bg-bg-overlay hover:bg-bg-surface px-2 py-0.5 rounded border border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={!hasAnyEdit || saving || saved || hasValidationErrors}
            className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              saved
                ? "bg-success text-bg-base"
                : "bg-accent hover:bg-accent-hover text-bg-base"
            }`}
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse table-fixed">
          <thead className="sticky top-0 bg-bg-surface z-20">
            <tr>
              <th className="w-20 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-fg-muted text-left border-b border-border-strong">
                Field
              </th>
              <th className="w-28 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-fg-muted text-left border-b border-border-strong">
                {isSingle ? "Original" : "Common"}
              </th>
              <th className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-fg-muted text-left border-b border-border-strong">
                Edit
              </th>
            </tr>
          </thead>
          <tbody>
            {/* ── Identity ── */}
            <SectionHeader label="Identity" />

            {/* Title */}
            <FieldRow
              label="Title"
              fs={editState.title}
              originalValue={isSingle ? firstTrack.title : null}
              err={errors.title}
            >
              <input
                className={inputCls(editState.title, errors.title)}
                value={displayValue<string>(editState.title) ?? ""}
                placeholder={editState.title.kind === "divergent" ? "(varies)" : ""}
                onChange={(e) => setField("title", e.target.value || "")}
              />
            </FieldRow>

            {/* Artist */}
            <FieldRow
              label="Artist"
              fs={editState.artistNames}
              originalValue={isSingle ? firstTrack.artistName : null}
            >
              {editState.artistNames.kind === "divergent" ? (
                <div className="px-1 py-0.5 text-yellow-300/70 italic">(varies)</div>
              ) : (
                <ArtistTagInput
                  value={displayValue<string[]>(editState.artistNames) ?? []}
                  onChange={(names) => setField("artistNames", names)}
                  suggestions={artistSuggestions}
                  isDirty={editState.artistNames.kind === "edited"}
                />
              )}
            </FieldRow>

            {/* Album */}
            <FieldRow
              label="Album"
              fs={editState.albumTitle}
              originalValue={isSingle ? (firstTrack.albumTitle ?? null) : null}
            >
              {editState.albumTitle.kind === "divergent" ? (
                <div className="px-1 py-0.5 text-yellow-300/70 italic">(varies)</div>
              ) : (
                <AlbumAutocomplete
                  value={displayValue<string | null>(editState.albumTitle) ?? ""}
                  onChange={(val) => setField("albumTitle", val || null)}
                  suggestions={albumSuggestions}
                  isDirty={editState.albumTitle.kind === "edited"}
                />
              )}
            </FieldRow>

            {/* Album Artist */}
            <FieldRow
              label="Album Artist"
              fs={editState.albumArtist}
              originalValue={isSingle ? (firstTrack.albumArtist ?? null) : null}
            >
              <input
                className={inputCls(editState.albumArtist)}
                value={displayValue<string | null>(editState.albumArtist) ?? ""}
                placeholder={editState.albumArtist.kind === "divergent" ? "(varies)" : ""}
                onChange={(e) => setField("albumArtist", e.target.value || null)}
              />
            </FieldRow>

            {/* Composer */}
            <FieldRow
              label="Composer"
              fs={editState.composer}
              originalValue={isSingle ? (firstTrack.composer ?? null) : null}
            >
              <input
                className={inputCls(editState.composer)}
                value={displayValue<string | null>(editState.composer) ?? ""}
                placeholder={editState.composer.kind === "divergent" ? "(varies)" : ""}
                onChange={(e) => setField("composer", e.target.value || null)}
              />
            </FieldRow>

            {/* Year */}
            <FieldRow
              label="Year"
              fs={editState.year}
              originalValue={isSingle ? (firstTrack.year != null ? String(firstTrack.year) : null) : null}
              err={errors.year}
            >
              <input
                className={inputCls(editState.year, errors.year)}
                value={displayValue<string | null>(editState.year) ?? ""}
                placeholder={editState.year.kind === "divergent" ? "(varies)" : "YYYY"}
                maxLength={4}
                onChange={(e) => {
                  setField("year", e.target.value || null);
                  const err = e.target.value ? FIELD_VALIDATORS.year(e.target.value) : null;
                  setErrors((prev) => { const n = { ...prev }; if (err) n.year = err; else delete n.year; return n; });
                }}
              />
            </FieldRow>

            {/* Genre */}
            <FieldRow
              label="Genre"
              fs={editState.genre}
              originalValue={isSingle ? (firstTrack.genre ?? null) : null}
            >
              <input
                className={inputCls(editState.genre)}
                value={displayValue<string | null>(editState.genre) ?? ""}
                placeholder={editState.genre.kind === "divergent" ? "(varies)" : ""}
                onChange={(e) => setField("genre", e.target.value || null)}
              />
            </FieldRow>

            {/* ── Position ── */}
            <SectionHeader label="Position" />

            {/* Track # */}
            <FieldRow
              label="Track #"
              fs={editState.trackNumber}
              originalValue={isSingle
                ? (firstTrack.trackNumber != null
                    ? (firstTrack.trackTotal != null
                        ? `${firstTrack.trackNumber}/${firstTrack.trackTotal}`
                        : String(firstTrack.trackNumber))
                    : null)
                : null}
              err={errors.trackNumber}
            >
              <input
                className={inputCls(editState.trackNumber, errors.trackNumber)}
                value={displayValue<string | null>(editState.trackNumber) ?? ""}
                placeholder={editState.trackNumber.kind === "divergent" ? "(varies)" : "N or N/Total"}
                onChange={(e) => {
                  setField("trackNumber", e.target.value || null);
                  const err = e.target.value ? FIELD_VALIDATORS.trackNumber(e.target.value) : null;
                  setErrors((prev) => { const n = { ...prev }; if (err) n.trackNumber = err; else delete n.trackNumber; return n; });
                }}
              />
            </FieldRow>

            {/* Disc # */}
            <FieldRow
              label="Disc #"
              fs={editState.discNumber}
              originalValue={isSingle
                ? (firstTrack.discNumber != null
                    ? (firstTrack.discTotal != null
                        ? `${firstTrack.discNumber}/${firstTrack.discTotal}`
                        : String(firstTrack.discNumber))
                    : null)
                : null}
              err={errors.discNumber}
            >
              <input
                className={inputCls(editState.discNumber, errors.discNumber)}
                value={displayValue<string | null>(editState.discNumber) ?? ""}
                placeholder={editState.discNumber.kind === "divergent" ? "(varies)" : "N or N/Total"}
                onChange={(e) => {
                  setField("discNumber", e.target.value || null);
                  const err = e.target.value ? FIELD_VALIDATORS.discNumber(e.target.value) : null;
                  setErrors((prev) => { const n = { ...prev }; if (err) n.discNumber = err; else delete n.discNumber; return n; });
                }}
              />
            </FieldRow>

            {/* ── Content ── */}
            <SectionHeader label="Content" />

            {/* Lyrics */}
            <FieldRow
              label="Lyrics"
              fs={editState.lyrics}
              originalValue={isSingle
                ? (firstTrack.lyrics
                    ? firstTrack.lyrics.slice(0, 30) + (firstTrack.lyrics.length > 30 ? "…" : "")
                    : null)
                : null}
            >
              <div className="space-y-0.5">
                <textarea
                  rows={3}
                  className={`${inputCls(editState.lyrics)} resize-none leading-relaxed`}
                  value={displayValue<string | null>(editState.lyrics) ?? ""}
                  placeholder={editState.lyrics.kind === "divergent" ? "(varies)" : ""}
                  onChange={(e) => setField("lyrics", e.target.value || null)}
                />
                <div className="flex items-center gap-1 text-[9px] text-fg-muted px-1">
                  <span>Lang:</span>
                  <LangPicker
                    value={displayValue<string | null>(editState.lyricsLang) ?? "eng"}
                    onChange={(v) => setField("lyricsLang", v)}
                  />
                </div>
              </div>
            </FieldRow>

            {/* Comment */}
            <FieldRow
              label="Comment"
              fs={editState.comment}
              originalValue={isSingle ? (firstTrack.comment ?? null) : null}
            >
              <div className="space-y-0.5">
                <input
                  className={inputCls(editState.comment)}
                  value={displayValue<string | null>(editState.comment) ?? ""}
                  placeholder={editState.comment.kind === "divergent" ? "(varies)" : ""}
                  onChange={(e) => setField("comment", e.target.value || null)}
                />
                <div className="flex items-center gap-1 text-[9px] text-fg-muted px-1">
                  <span>Lang:</span>
                  <LangPicker
                    value={displayValue<string | null>(editState.commentLang) ?? "eng"}
                    onChange={(v) => setField("commentLang", v)}
                  />
                </div>
              </div>
            </FieldRow>

            {/* BPM */}
            <FieldRow
              label="BPM"
              fs={editState.bpm}
              originalValue={isSingle ? (firstTrack.bpm != null ? String(firstTrack.bpm) : null) : null}
              err={errors.bpm}
            >
              <input
                className={inputCls(editState.bpm, errors.bpm)}
                value={displayValue<string | null>(editState.bpm) ?? ""}
                placeholder={editState.bpm.kind === "divergent" ? "(varies)" : ""}
                onChange={(e) => {
                  setField("bpm", e.target.value || null);
                  const err = e.target.value ? FIELD_VALIDATORS.bpm(e.target.value) : null;
                  setErrors((prev) => { const n = { ...prev }; if (err) n.bpm = err; else delete n.bpm; return n; });
                }}
              />
            </FieldRow>

            {/* ── Technical (read-only) ── */}
            <SectionHeader label="Technical" />

            {isSingle && (
              <>
                <tr className="border-b border-white/5">
                  <td className="px-2 py-1 text-fg-muted">Duration</td>
                  <td className="px-2 py-1 text-fg-secondary">{formatDuration(firstTrack.durationSecs)}</td>
                  <td className="px-2 py-1 text-fg-muted/40 italic">(read-only)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-2 py-1 text-fg-muted">Format</td>
                  <td className="px-2 py-1 text-fg-secondary">{firstTrack.fileFormat ?? "—"}</td>
                  <td className="px-2 py-1 text-fg-muted/40 italic">(read-only)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-2 py-1 text-fg-muted">Bitrate</td>
                  <td className="px-2 py-1 text-fg-secondary">
                    {firstTrack.bitrateKbps != null ? `${firstTrack.bitrateKbps} kbps` : "—"}
                  </td>
                  <td className="px-2 py-1 text-fg-muted/40 italic">(read-only)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-2 py-1 text-fg-muted">Sample Rate</td>
                  <td className="px-2 py-1 text-fg-secondary">
                    {firstTrack.sampleRateHz != null ? `${(firstTrack.sampleRateHz / 1000).toFixed(1)} kHz` : "—"}
                  </td>
                  <td className="px-2 py-1 text-fg-muted/40 italic">(read-only)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-2 py-1 text-fg-muted">Path</td>
                  <td
                    className="px-2 py-1 text-fg-secondary font-mono truncate max-w-[112px]"
                    title={firstTrack.filePath}
                    colSpan={2}
                  >
                    {firstTrack.filePath}
                  </td>
                </tr>
              </>
            )}
            {!isSingle && (
              <tr className="border-b border-white/5">
                <td colSpan={3} className="px-2 py-1 text-fg-muted/50 italic">
                  Technical details only shown for single-track selection
                </td>
              </tr>
            )}

            {/* ── Extra Tags (single-track only) ── */}
            {isSingle && (
              <>
                <SectionHeader label="Extra Tags" />
                {extraTags.map((tag) => {
                  const label = ADDABLE_FRAMES.find((f) => f.id === tag.frame_id)?.label ?? tag.frame_id;
                  const err = extraTagErrors[tag.frame_id];
                  const fs: FieldState<string> = { kind: "edited", value: tag.value };
                  return (
                    <tr key={tag.frame_id} className={`border-b border-white/5 ${rowCls(fs, err)}`}>
                      <td className="px-2 py-1 text-fg-muted">{label}</td>
                      <td className="px-2 py-1 text-fg-secondary text-[10px]">{tag.frame_id}</td>
                      <td className="px-1 py-0.5">
                        <div className="flex items-center gap-1">
                          <input
                            className={`flex-1 ${inputCls(fs, err)}`}
                            value={tag.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExtraTags((prev) =>
                                prev.map((t) => t.frame_id === tag.frame_id ? { ...t, value: val } : t)
                              );
                              const validator = FIELD_VALIDATORS[tag.frame_id];
                              if (validator && val) {
                                const verr = validator(val);
                                setExtraTagErrors((prev) => ({ ...prev, [tag.frame_id]: verr ?? "" }));
                              } else {
                                setExtraTagErrors((prev) => { const next = { ...prev }; delete next[tag.frame_id]; return next; });
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="text-fg-muted hover:text-danger transition-colors flex-shrink-0"
                            aria-label={`Remove ${label}`}
                            onClick={() => {
                              setExtraTags((prev) => prev.filter((t) => t.frame_id !== tag.frame_id));
                              setExtraTagErrors((prev) => { const next = { ...prev }; delete next[tag.frame_id]; return next; });
                            }}
                          >
                            <LuX size={11} />
                          </button>
                        </div>
                        {err && <div className="text-[9px] text-red-400 px-1 pt-0.5">{err}</div>}
                      </td>
                    </tr>
                  );
                })}

                {/* Add field button */}
                <tr>
                  <td colSpan={3} className="px-2 py-1.5">
                    {showAddFrame ? (
                      <select
                        className="bg-bg-overlay text-xs rounded px-2 py-0.5 text-fg-secondary outline-none focus:ring-1 focus:ring-accent/40 w-full cursor-pointer"
                        defaultValue=""
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) return;
                          setExtraTags((prev) => [...prev, { frame_id: id, value: "" }]);
                          setShowAddFrame(false);
                        }}
                        onBlur={() => setShowAddFrame(false)}
                        autoFocus
                      >
                        <option value="" disabled>Select frame…</option>
                        {ADDABLE_FRAMES.filter(
                          (f) => !extraTags.some((t) => t.frame_id === f.id)
                        ).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label} ({f.id})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[10px] text-fg-muted hover:text-fg-primary transition-colors"
                        onClick={() => setShowAddFrame(true)}
                      >
                        <LuPlus size={11} />
                        Add field
                      </button>
                    )}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
