import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { LuCopy, LuChevronDown, LuChevronRight, LuLoader } from 'react-icons/lu';
import { SERVICES, type MetadataResult, type SearchType, type MetadataService } from '@/lib/metadata';

const SEARCH_TYPES: { value: SearchType; label: string }[] = [
  { value: 'track', label: 'Track' },
  { value: 'album', label: 'Album' },
  { value: 'artist', label: 'Artist' },
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-14 shrink-0 text-[11px] text-fg-muted">{label}</span>
      <span className="flex-1 truncate text-[12px] text-fg-secondary">{value}</span>
      <button
        onClick={() => copyToClipboard(value)}
        className="shrink-0 rounded p-1 text-fg-muted opacity-0 transition-opacity hover:text-fg-primary group-hover/field:opacity-100"
        title={`Copy ${label}`}
      >
        <LuCopy size={11} />
      </button>
    </div>
  );
}

function CollapsibleBlock({
  label,
  content,
  copyValue,
  mono = false,
}: {
  label: string;
  content: string;
  copyValue?: string;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg-secondary"
        >
          {open ? <LuChevronDown size={12} /> : <LuChevronRight size={12} />}
          {label}
        </button>
        <button
          onClick={() => copyToClipboard(copyValue ?? content)}
          className="flex items-center gap-1 text-[10px] text-fg-muted hover:text-fg-secondary"
          title={`Copy ${label}`}
        >
          <LuCopy size={10} /> Copy
        </button>
      </div>
      {open && (
        <pre className={`mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-bg-base p-2 scrollbar-hide ${mono ? 'text-[10px] leading-relaxed text-fg-muted' : 'text-[11px] leading-relaxed text-fg-secondary'}`}>
          {content}
        </pre>
      )}
    </div>
  );
}

function ResultCard({ result }: { result: MetadataResult }) {
  return (
    <div className="group rounded-lg border border-border bg-bg-surface p-3 transition-colors hover:border-border-strong">
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="shrink-0">
          {result.coverUrl ? (
            <img
              src={result.coverUrl}
              alt={result.title}
              className="h-16 w-16 rounded object-cover shadow"
              loading="lazy"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded bg-bg-overlay text-[10px] text-fg-muted">
              No art
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="group/field min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-fg-primary">
              {result.title}
            </span>
            <button
              onClick={() => copyToClipboard(result.title)}
              className="shrink-0 rounded p-0.5 text-fg-muted hover:text-fg-primary"
              title="Copy title"
            >
              <LuCopy size={11} />
            </button>
          </div>

          {result.artist && <FieldRow label="Artist" value={result.artist} />}
          {result.album && <FieldRow label="Album" value={result.album} />}
          {result.year && <FieldRow label="Year" value={String(result.year)} />}
        </div>
      </div>

      {result.lyrics && (
        <CollapsibleBlock label="Lyrics" content={result.lyrics} />
      )}
      {result.syncedLyrics && (
        <CollapsibleBlock label="Synced Lyrics" content={result.syncedLyrics} mono />
      )}
      <CollapsibleBlock
        label="Raw JSON"
        content={JSON.stringify(result.raw, null, 2)}
        mono
      />
    </div>
  );
}

function MetadataSearchPage() {
  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('track');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(SERVICES[0].id);
  const [results, setResults] = useState<MetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const activeService: MetadataService | undefined = SERVICES.find((s) => s.id === selectedServiceId);

  const handleSearch = useCallback(async () => {
    if (!searchText.trim() || !activeService) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    try {
      const res = await activeService.search({ text: searchText.trim(), type: searchType });
      setResults(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [searchText, searchType, activeService]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleServiceChange = (id: string) => {
    const svc = SERVICES.find((s) => s.id === id);
    if (svc && !svc.supportsTypes.includes(searchType)) {
      setSearchType(svc.supportsTypes[0]);
    }
    setSelectedServiceId(id);
    setResults([]);
    setError(null);
    setHasSearched(false);
  };

  const handleTypeChange = (type: SearchType) => {
    setSearchType(type);
    setResults([]);
    setError(null);
    setHasSearched(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-bg-surface px-6 py-4">
        <h1 className="text-base font-semibold text-fg-primary">Metadata Search</h1>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          Search external music databases for track, album, and artist information.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-bg-surface px-6 py-3">
        {/* Search type toggle — filtered to types the active service supports */}
        <div className="flex rounded-lg border border-border bg-bg-base p-0.5">
          {SEARCH_TYPES.filter(({ value }) => activeService?.supportsTypes.includes(value)).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleTypeChange(value)}
              className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
                searchType === value
                  ? 'bg-accent text-bg-base shadow'
                  : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Service selector */}
        <div className="flex gap-1.5">
          {SERVICES.map((service) => (
            <button
              key={service.id}
              onClick={() => handleServiceChange(service.id)}
              title={service.description}
              className={`rounded-lg border px-3 py-1 text-[12px] font-medium transition-colors ${
                selectedServiceId === service.id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-fg-muted hover:border-border-strong hover:text-fg-secondary'
              }`}
            >
              {service.name}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${searchType}s...`}
            className="flex-1 rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-fg-secondary outline-none placeholder:text-fg-muted focus:border-accent/50"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !searchText.trim()}
            className="rounded-lg bg-accent px-4 py-1.5 text-[12px] font-semibold text-bg-base transition-all hover:bg-accent-hover active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-fg-muted">
            <LuLoader size={14} className="animate-spin" />
            Searching {activeService?.name}…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <p className="text-[13px] text-fg-muted">No results found.</p>
        )}

        {!loading && !error && !hasSearched && (
          <p className="text-[13px] text-fg-muted">
            Enter a search query above and press Search.
          </p>
        )}

        {results.length > 0 && (
          <div className="flex flex-col gap-3">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/metadata')({
  component: MetadataSearchPage,
});
