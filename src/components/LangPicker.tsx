import { useState } from "react";

const COMMON_LANGS = [
  { code: "eng", label: "English" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "spa", label: "Spanish" },
  { code: "jpn", label: "Japanese" },
  { code: "zho", label: "Chinese" },
  { code: "xxx", label: "Unknown" },
];

export function LangPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [custom, setCustom] = useState(
    value != null && !COMMON_LANGS.some((l) => l.code === value),
  );

  const isValid = (v: string) => /^[a-z]{3}$/.test(v);

  if (custom) {
    return (
      <div className="flex items-center gap-1">
        <input
          className={`w-14 bg-transparent text-xs rounded px-1.5 py-0.5 outline-none focus:ring-1 ${
            value && !isValid(value)
              ? "ring-1 ring-red-500/60 text-red-400"
              : "ring-1 ring-accent/40 text-fg-primary"
          }`}
          value={value ?? ""}
          maxLength={3}
          placeholder="xxx"
          onChange={(e) => onChange(e.target.value.toLowerCase() || null)}
        />
        <button
          type="button"
          className="text-[10px] text-fg-muted hover:text-fg-primary"
          onClick={() => { setCustom(false); onChange("eng"); }}
        >
          ↩
        </button>
      </div>
    );
  }

  return (
    <select
      className="bg-bg-overlay text-xs rounded px-1 py-0.5 text-fg-secondary outline-none focus:ring-1 focus:ring-accent/40 cursor-pointer"
      value={value ?? "eng"}
      onChange={(e) => {
        if (e.target.value === "__custom__") {
          setCustom(true);
          onChange(null);
        } else {
          onChange(e.target.value);
        }
      }}
    >
      {COMMON_LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label} ({l.code})
        </option>
      ))}
      <option value="__custom__">Other…</option>
    </select>
  );
}
