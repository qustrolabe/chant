use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::FromRow;

// ── Music Library Models ──

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: i64,
    pub path: String,
    pub label: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionInput {
    pub path: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub id: i64,
    pub name: String,
    pub sort_name: Option<String>,
    pub musicbrainz_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub id: i64,
    pub title: String,
    pub artist_id: Option<i64>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub cover_path: Option<String>,
    pub musicbrainz_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: i64,
    pub collection_id: i64,
    pub album_id: Option<i64>,
    pub artist_id: Option<i64>,
    pub title: String,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub duration_secs: Option<f64>,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub file_format: Option<String>,
    pub bitrate_kbps: Option<i32>,
    pub sample_rate_hz: Option<i32>,
    pub lyrics: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    // Extended fields (added via migration)
    pub genre: Option<String>,
    pub album_artist: Option<String>,
    pub composer: Option<String>,
    pub bpm: Option<i32>,
    pub comment: Option<String>,
    pub comment_lang: Option<String>,
    pub year: Option<i32>,
    pub lyrics_lang: Option<String>,
    pub track_total: Option<i32>,
    pub disc_total: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub total_collections: i64,
    pub total_artists: i64,
    pub total_albums: i64,
    pub total_tracks: i64,
    pub total_size_bytes: i64,
    pub total_duration_secs: f64,
}

// ── Settings ──

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

// ── Track Update ──

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrackUpdateInput {
    pub title: Option<String>,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub lyrics: Option<String>,
    /// Set to Some("") to clear, Some("Name") to find-or-create, None to keep existing
    pub artist_name: Option<String>,
    /// Set to Some("") to clear, Some("Title") to find-or-create, None to keep existing
    pub album_title: Option<String>,
    // Extended fields — None = keep existing, Some(x) = set (Some("") = NULL for strings)
    pub genre: Option<String>,
    pub album_artist: Option<String>,
    pub composer: Option<String>,
    pub bpm: Option<i32>,
    pub comment: Option<String>,
    pub comment_lang: Option<String>,
    pub year: Option<i32>,
    pub lyrics_lang: Option<String>,
    pub track_total: Option<i32>,
    pub disc_total: Option<i32>,
}

// ── Track Row (joined query result) ──

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TrackRow {
    pub id: i64,
    pub collection_id: i64,
    pub album_id: Option<i64>,
    pub artist_id: Option<i64>,
    pub title: String,
    pub track_number: Option<i32>,
    pub disc_number: Option<i32>,
    pub duration_secs: Option<f64>,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub file_format: Option<String>,
    pub bitrate_kbps: Option<i32>,
    pub sample_rate_hz: Option<i32>,
    pub lyrics: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    // Extended fields
    pub genre: Option<String>,
    pub album_artist: Option<String>,
    pub composer: Option<String>,
    pub bpm: Option<i32>,
    pub comment: Option<String>,
    pub comment_lang: Option<String>,
    pub year: Option<i32>,
    pub lyrics_lang: Option<String>,
    pub track_total: Option<i32>,
    pub disc_total: Option<i32>,
    // Joined columns
    pub artist_name: Option<String>,
    pub album_title: Option<String>,
    pub album_cover_path: Option<String>,
}

// ── Extra Tag ──

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ExtraTag {
    pub frame_id: String,
    pub value: String,
}

// ── Aggregate Row Types (for table views) ──

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ArtistRow {
    pub id: i64,
    pub name: String,
    pub sort_name: Option<String>,
    pub album_count: i64,
    pub track_count: i64,
    pub total_duration_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AlbumRow {
    pub id: i64,
    pub title: String,
    pub artist_name: Option<String>,
    pub year: Option<i32>,
    pub genre: Option<String>,
    pub track_count: i64,
    pub total_duration_secs: f64,
    pub total_size_bytes: i64,
}

// ── Cover Art ──

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CoverArt {
    /// Base64-encoded image data
    pub data: String,
    /// MIME type, e.g. "image/jpeg" or "image/png"
    pub mime_type: String,
}

// ── Error Types ──

#[derive(Debug, Clone, Serialize, Type, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("I/O error: {0}")]
    Io(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
}

impl From<sqlx::Error> for AppError {
    fn from(value: sqlx::Error) -> Self {
        Self::Database(value.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serialization(value.to_string())
    }
}
