export type Validator = (v: string) => string | null; // null = valid, string = error message

export const FIELD_VALIDATORS: Record<string, Validator> = {
  bpm:         (v) => /^\d+$/.test(v) ? null : "Must be a non-negative integer",
  year:        (v) => /^\d{4}$/.test(v) && +v >= 1000 && +v <= 2099 ? null : "4-digit year (1000–2099)",
  trackNumber: (v) => /^\d+(\/\d+)?$/.test(v) ? null : "Must be N or N/Total",
  discNumber:  (v) => /^\d+(\/\d+)?$/.test(v) ? null : "Must be N or N/Total",
  commentLang: (v) => /^[a-z]{3}$/.test(v) ? null : "3 lowercase letters (ISO 639-2)",
  lyricsLang:  (v) => /^[a-z]{3}$/.test(v) ? null : "3 lowercase letters (ISO 639-2)",
  TKEY:        (v) => /^[A-G][b#]?m?$/.test(v) ? null : "Invalid musical key (e.g. Am, C#, Db)",
  TSRC:        (v) => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(v) ? null : "Invalid ISRC",
};
