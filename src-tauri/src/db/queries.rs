// ── Collections ──

pub const CREATE_COLLECTIONS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS collections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    path        TEXT NOT NULL UNIQUE,
    label       TEXT,
    created_at  TEXT NOT NULL
)
"#;

// ── Artists ──

pub const CREATE_ARTISTS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS artists (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    sort_name       TEXT,
    musicbrainz_id  TEXT,
    created_at      TEXT NOT NULL
)
"#;

pub const CREATE_ARTISTS_NAME_INDEX: &str = r#"
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name)
"#;

// ── Albums ──

pub const CREATE_ALBUMS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS albums (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    artist_id       INTEGER REFERENCES artists(id) ON DELETE SET NULL,
    year            INTEGER,
    genre           TEXT,
    cover_path      TEXT,
    musicbrainz_id  TEXT,
    created_at      TEXT NOT NULL
)
"#;

pub const CREATE_ALBUMS_TITLE_INDEX: &str = r#"
CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title)
"#;

pub const CREATE_ALBUMS_ARTIST_INDEX: &str = r#"
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id)
"#;

// ── Tracks ──

pub const CREATE_TRACKS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS tracks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id   INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    album_id        INTEGER REFERENCES albums(id) ON DELETE SET NULL,
    artist_id       INTEGER REFERENCES artists(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    track_number    INTEGER,
    disc_number     INTEGER,
    duration_secs   REAL,
    file_path       TEXT NOT NULL UNIQUE,
    file_size_bytes INTEGER NOT NULL,
    file_format     TEXT,
    bitrate_kbps    INTEGER,
    sample_rate_hz  INTEGER,
    lyrics          TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    genre           TEXT,
    album_artist    TEXT,
    composer        TEXT,
    bpm             INTEGER,
    comment         TEXT,
    comment_lang    TEXT,
    year            INTEGER,
    lyrics_lang     TEXT,
    track_total     INTEGER,
    disc_total      INTEGER
)
"#;

pub const CREATE_TRACKS_COLLECTION_INDEX: &str = r#"
CREATE INDEX IF NOT EXISTS idx_tracks_collection_id ON tracks(collection_id)
"#;

pub const CREATE_TRACKS_ALBUM_INDEX: &str = r#"
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id)
"#;

pub const CREATE_TRACKS_ARTIST_INDEX: &str = r#"
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id)
"#;

pub const CREATE_TRACKS_FILE_PATH_INDEX: &str = r#"
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks(file_path)
"#;

// ── Settings ──

pub const CREATE_SETTINGS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
)
"#;

// ── Track column migrations ──
// For existing databases that were created before these columns existed.
// Execute each separately; ignore "already has a column named" errors (idempotent).

pub const MIGRATE_TRACKS_ADD_GENRE: &str =
    "ALTER TABLE tracks ADD COLUMN genre TEXT";
pub const MIGRATE_TRACKS_ADD_ALBUM_ARTIST: &str =
    "ALTER TABLE tracks ADD COLUMN album_artist TEXT";
pub const MIGRATE_TRACKS_ADD_COMPOSER: &str =
    "ALTER TABLE tracks ADD COLUMN composer TEXT";
pub const MIGRATE_TRACKS_ADD_BPM: &str =
    "ALTER TABLE tracks ADD COLUMN bpm INTEGER";
pub const MIGRATE_TRACKS_ADD_COMMENT: &str =
    "ALTER TABLE tracks ADD COLUMN comment TEXT";
pub const MIGRATE_TRACKS_ADD_COMMENT_LANG: &str =
    "ALTER TABLE tracks ADD COLUMN comment_lang TEXT";
pub const MIGRATE_TRACKS_ADD_YEAR: &str =
    "ALTER TABLE tracks ADD COLUMN year INTEGER";
pub const MIGRATE_TRACKS_ADD_LYRICS_LANG: &str =
    "ALTER TABLE tracks ADD COLUMN lyrics_lang TEXT";
pub const MIGRATE_TRACKS_ADD_TRACK_TOTAL: &str =
    "ALTER TABLE tracks ADD COLUMN track_total INTEGER";
pub const MIGRATE_TRACKS_ADD_DISC_TOTAL: &str =
    "ALTER TABLE tracks ADD COLUMN disc_total INTEGER";

// ── Extra tags table ──

pub const CREATE_TRACK_EXTRA_TAGS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS track_extra_tags (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id  INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    frame_id  TEXT NOT NULL,
    value     TEXT NOT NULL,
    UNIQUE(track_id, frame_id)
)"#;

pub const CREATE_TRACK_EXTRA_TAGS_INDEX: &str =
    "CREATE INDEX IF NOT EXISTS idx_track_extra_tags_track_id ON track_extra_tags(track_id)";
