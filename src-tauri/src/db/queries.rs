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
    updated_at      TEXT NOT NULL
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
