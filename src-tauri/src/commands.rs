use crate::db::DbPool;
use crate::models::{
    Album, AlbumRow, AppError, Artist, ArtistRow, Collection, CollectionInput, CoverArt,
    LibraryStats, Setting, Track, TrackRow, TrackUpdateInput,
};
use chrono::Utc;
use lofty::prelude::*;
use lofty::probe::Probe;
use log::{error, info, warn};
use sqlx::{Column, Row};
use std::path::{Path, PathBuf};
use tauri::{Manager, State};
use walkdir::WalkDir;

// ── Collection Commands ──

pub async fn list_collections_inner(db: &DbPool) -> Result<Vec<Collection>, AppError> {
    Ok(
        sqlx::query_as::<_, Collection>(
            "SELECT id, path, label, created_at FROM collections ORDER BY created_at DESC",
        )
        .fetch_all(db)
        .await?,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn list_collections(db: State<'_, DbPool>) -> Result<Vec<Collection>, AppError> {
    list_collections_inner(db.inner()).await
}

pub async fn add_collection_inner(
    db: &DbPool,
    input: CollectionInput,
    skip_fs_checks: bool,
) -> Result<Collection, AppError> {
    let path = PathBuf::from(&input.path);
    if !path.is_absolute() {
        return Err(AppError::InvalidInput(format!(
            "Path must be absolute: {}",
            input.path
        )));
    }
    if !skip_fs_checks && !path.exists() {
        return Err(AppError::InvalidInput(format!(
            "Path does not exist: {}",
            input.path
        )));
    }

    let normalized = path.to_string_lossy().replace('\\', "/");
    let created = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO collections (path, label, created_at) VALUES (?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET label = excluded.label",
    )
    .bind(&normalized)
    .bind(&input.label)
    .bind(&created)
    .execute(db)
    .await?;

    Ok(
        sqlx::query_as::<_, Collection>(
            "SELECT id, path, label, created_at FROM collections WHERE path = ?",
        )
        .bind(&normalized)
        .fetch_one(db)
        .await?,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn add_collection(
    db: State<'_, DbPool>,
    input: CollectionInput,
) -> Result<Collection, AppError> {
    add_collection_inner(db.inner(), input, false).await
}

pub async fn delete_collection_inner(
    db: &DbPool,
    collection_id: i64,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM collections WHERE id = ?")
        .bind(collection_id)
        .execute(db)
        .await?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_collection(
    db: State<'_, DbPool>,
    collection_id: i64,
) -> Result<(), AppError> {
    delete_collection_inner(db.inner(), collection_id).await
}

pub async fn clear_all_data_inner(
    db: &DbPool,
    covers_dir: Option<std::path::PathBuf>,
) -> Result<(), AppError> {
    // Delete in FK-safe order: tracks first (they ref albums/artists/collections),
    // then albums (refs artists), then artists, then collections.
    // Settings are preserved so the user doesn't have to re-pick their folder.
    sqlx::query("DELETE FROM tracks").execute(db).await?;
    sqlx::query("DELETE FROM albums").execute(db).await?;
    sqlx::query("DELETE FROM artists").execute(db).await?;
    sqlx::query("DELETE FROM collections").execute(db).await?;

    if let Some(dir) = covers_dir {
        if dir.exists() {
            std::fs::remove_dir_all(&dir)?;
        }
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn clear_all_data(
    db: State<'_, DbPool>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    let covers_dir = app_handle
        .path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("covers"));
    clear_all_data_inner(db.inner(), covers_dir).await
}

// ── Library Stats ──

pub async fn get_library_stats_inner(db: &DbPool) -> Result<LibraryStats, AppError> {
    let total_collections: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM collections")
            .fetch_one(db)
            .await?;
    let total_artists: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM artists")
            .fetch_one(db)
            .await?;
    let total_albums: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM albums")
            .fetch_one(db)
            .await?;
    let track_stats: (i64, i64, f64) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(file_size_bytes), 0), COALESCE(SUM(duration_secs), 0.0) FROM tracks",
    )
    .fetch_one(db)
    .await?;

    Ok(LibraryStats {
        total_collections: total_collections.0,
        total_artists: total_artists.0,
        total_albums: total_albums.0,
        total_tracks: track_stats.0,
        total_size_bytes: track_stats.1,
        total_duration_secs: track_stats.2,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_library_stats(db: State<'_, DbPool>) -> Result<LibraryStats, AppError> {
    get_library_stats_inner(db.inner()).await
}

// ── Database Path ──

pub async fn get_database_path_inner(db: &DbPool) -> Result<String, AppError> {
    let path = sqlx::query("PRAGMA database_list")
        .fetch_one(db)
        .await?;
    Ok(sqlx::Row::try_get(&path, "file")?)
}

#[tauri::command]
#[specta::specta]
pub async fn get_database_path(db: State<'_, DbPool>) -> Result<String, AppError> {
    get_database_path_inner(db.inner()).await
}

// ── Settings Commands ──

pub async fn get_setting_inner(db: &DbPool, key: &str) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(db)
            .await?;
    Ok(row.map(|r| r.0))
}

#[tauri::command]
#[specta::specta]
pub async fn get_setting(db: State<'_, DbPool>, key: String) -> Result<Option<String>, AppError> {
    get_setting_inner(db.inner(), &key).await
}

pub async fn set_setting_inner(
    db: &DbPool,
    key: &str,
    value: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(db)
    .await?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn set_setting(
    db: State<'_, DbPool>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    set_setting_inner(db.inner(), &key, &value).await
}

pub async fn get_all_settings_inner(db: &DbPool) -> Result<Vec<Setting>, AppError> {
    Ok(
        sqlx::query_as::<_, Setting>("SELECT key, value FROM settings ORDER BY key")
            .fetch_all(db)
            .await?,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn get_all_settings(db: State<'_, DbPool>) -> Result<Vec<Setting>, AppError> {
    get_all_settings_inner(db.inner()).await
}

// ── Debug Commands ──

pub async fn debug_query_table_inner(
    db: &DbPool,
    table_name: &str,
) -> Result<Vec<std::collections::HashMap<String, String>>, AppError> {
    let allowed = ["collections", "artists", "albums", "tracks", "settings"];
    if !allowed.contains(&table_name) {
        return Err(AppError::InvalidInput(format!(
            "Table '{}' is not in the allowlist",
            table_name
        )));
    }

    let query = format!("SELECT * FROM {} LIMIT 500", table_name);
    let rows = sqlx::query(&query).fetch_all(db).await?;

    let mut result = Vec::new();
    for row in &rows {
        let mut obj = std::collections::HashMap::new();
        for col in row.columns() {
            let name = col.name();
            let val = if let Ok(v) = sqlx::Row::try_get::<i64, _>(row, name) {
                v.to_string()
            } else if let Ok(v) = sqlx::Row::try_get::<f64, _>(row, name) {
                v.to_string()
            } else if let Ok(v) = sqlx::Row::try_get::<String, _>(row, name) {
                v
            } else {
                "NULL".to_string()
            };
            obj.insert(name.to_string(), val);
        }
        result.push(obj);
    }

    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub async fn debug_query_table(
    db: State<'_, DbPool>,
    table_name: String,
) -> Result<Vec<std::collections::HashMap<String, String>>, AppError> {
    debug_query_table_inner(db.inner(), &table_name).await
}

// ── Track Commands ──

pub async fn list_tracks_inner(db: &DbPool) -> Result<Vec<TrackRow>, AppError> {
    Ok(sqlx::query_as::<_, TrackRow>(
        "SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_path as album_cover_path
         FROM tracks t
         LEFT JOIN artists a ON t.artist_id = a.id
         LEFT JOIN albums al ON t.album_id = al.id
         ORDER BY t.title ASC",
    )
    .fetch_all(db)
    .await?)
}

#[tauri::command]
#[specta::specta]
pub async fn list_tracks(db: State<'_, DbPool>) -> Result<Vec<TrackRow>, AppError> {
    list_tracks_inner(db.inner()).await
}

pub async fn get_track_inner(db: &DbPool, track_id: i64) -> Result<TrackRow, AppError> {
    sqlx::query_as::<_, TrackRow>(
        "SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_path as album_cover_path
         FROM tracks t
         LEFT JOIN artists a ON t.artist_id = a.id
         LEFT JOIN albums al ON t.album_id = al.id
         WHERE t.id = ?",
    )
    .bind(track_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Track {} not found", track_id)))
}

#[tauri::command]
#[specta::specta]
pub async fn get_track(db: State<'_, DbPool>, track_id: i64) -> Result<TrackRow, AppError> {
    get_track_inner(db.inner(), track_id).await
}

/// Find an artist by exact name, or insert a new one and return its id.
async fn find_or_create_artist(db: &DbPool, name: &str) -> Result<i64, AppError> {
    let row: Option<(i64,)> = sqlx::query_as("SELECT id FROM artists WHERE name = ?")
        .bind(name)
        .fetch_optional(db)
        .await?;
    if let Some((id,)) = row {
        return Ok(id);
    }
    let now = Utc::now().to_rfc3339();
    let res = sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
        .bind(name)
        .bind(&now)
        .execute(db)
        .await?;
    Ok(res.last_insert_rowid())
}

/// Find an album by title (optionally scoped to an artist), or insert and return its id.
async fn find_or_create_album(
    db: &DbPool,
    title: &str,
    artist_id: Option<i64>,
) -> Result<i64, AppError> {
    let row: Option<(i64,)> = if let Some(aid) = artist_id {
        sqlx::query_as("SELECT id FROM albums WHERE title = ? AND artist_id = ?")
            .bind(title)
            .bind(aid)
            .fetch_optional(db)
            .await?
    } else {
        sqlx::query_as("SELECT id FROM albums WHERE title = ? AND artist_id IS NULL")
            .bind(title)
            .fetch_optional(db)
            .await?
    };
    if let Some((id,)) = row {
        return Ok(id);
    }
    let now = Utc::now().to_rfc3339();
    let res = sqlx::query("INSERT INTO albums (title, artist_id, created_at) VALUES (?, ?, ?)")
        .bind(title)
        .bind(artist_id)
        .bind(&now)
        .execute(db)
        .await?;
    Ok(res.last_insert_rowid())
}

pub async fn update_track_inner(
    db: &DbPool,
    track_id: i64,
    input: TrackUpdateInput,
) -> Result<TrackRow, AppError> {
    let now = Utc::now().to_rfc3339();

    let existing = sqlx::query_as::<_, Track>(
        "SELECT * FROM tracks WHERE id = ?",
    )
    .bind(track_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Track {} not found", track_id)))?;

    let title = input.title.unwrap_or(existing.title);
    let track_number = input.track_number.or(existing.track_number);
    let disc_number = input.disc_number.or(existing.disc_number);
    let lyrics = input.lyrics.or(existing.lyrics);

    // Resolve new artist_id: None = keep existing, Some("") = clear, Some(name) = find-or-create
    let new_artist_id: Option<i64> = match input.artist_name.as_deref() {
        None => existing.artist_id,
        Some("") => None,
        Some(name) => Some(find_or_create_artist(db, name).await?),
    };

    // Resolve new album_id: None = keep existing, Some("") = clear, Some(title) = find-or-create
    let new_album_id: Option<i64> = match input.album_title.as_deref() {
        None => existing.album_id,
        Some("") => None,
        Some(title) => Some(find_or_create_album(db, title, new_artist_id).await?),
    };

    sqlx::query(
        "UPDATE tracks SET title = ?, track_number = ?, disc_number = ?, lyrics = ?, \
         artist_id = ?, album_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&title)
    .bind(track_number)
    .bind(disc_number)
    .bind(&lyrics)
    .bind(new_artist_id)
    .bind(new_album_id)
    .bind(&now)
    .bind(track_id)
    .execute(db)
    .await?;

    get_track_inner(db, track_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_track(
    db: State<'_, DbPool>,
    track_id: i64,
    input: TrackUpdateInput,
) -> Result<TrackRow, AppError> {
    update_track_inner(db.inner(), track_id, input).await
}

// ── Artist Commands ──

pub async fn list_artists_inner(db: &DbPool) -> Result<Vec<Artist>, AppError> {
    Ok(
        sqlx::query_as::<_, Artist>(
            "SELECT id, name, sort_name, musicbrainz_id, created_at FROM artists ORDER BY name ASC",
        )
        .fetch_all(db)
        .await?,
    )
}

#[tauri::command]
#[specta::specta]
pub async fn list_artists(db: State<'_, DbPool>) -> Result<Vec<Artist>, AppError> {
    list_artists_inner(db.inner()).await
}

pub async fn list_artist_rows_inner(db: &DbPool) -> Result<Vec<ArtistRow>, AppError> {
    Ok(sqlx::query_as::<_, ArtistRow>(
        "SELECT a.id, a.name, a.sort_name,
                (SELECT COUNT(*) FROM albums al WHERE al.artist_id = a.id) as album_count,
                (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id) as track_count,
                (SELECT COALESCE(SUM(t.duration_secs), 0) FROM tracks t WHERE t.artist_id = a.id) as total_duration_secs
         FROM artists a
         ORDER BY a.name ASC",
    )
    .fetch_all(db)
    .await?)
}

#[tauri::command]
#[specta::specta]
pub async fn list_artist_rows(db: State<'_, DbPool>) -> Result<Vec<ArtistRow>, AppError> {
    list_artist_rows_inner(db.inner()).await
}

// ── Album Commands ──

pub async fn list_albums_inner(
    db: &DbPool,
    artist_id: Option<i64>,
) -> Result<Vec<Album>, AppError> {
    if let Some(aid) = artist_id {
        Ok(sqlx::query_as::<_, Album>(
            "SELECT id, title, artist_id, year, genre, cover_path, musicbrainz_id, created_at
             FROM albums WHERE artist_id = ? ORDER BY year ASC, title ASC",
        )
        .bind(aid)
        .fetch_all(db)
        .await?)
    } else {
        Ok(sqlx::query_as::<_, Album>(
            "SELECT id, title, artist_id, year, genre, cover_path, musicbrainz_id, created_at
             FROM albums ORDER BY title ASC",
        )
        .fetch_all(db)
        .await?)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn list_albums(
    db: State<'_, DbPool>,
    artist_id: Option<i64>,
) -> Result<Vec<Album>, AppError> {
    list_albums_inner(db.inner(), artist_id).await
}

pub async fn list_album_rows_inner(db: &DbPool) -> Result<Vec<AlbumRow>, AppError> {
    Ok(sqlx::query_as::<_, AlbumRow>(
        "SELECT al.id, al.title, ar.name as artist_name, al.year, al.genre,
                COUNT(t.id) as track_count,
                COALESCE(SUM(t.duration_secs), 0) as total_duration_secs,
                COALESCE(SUM(t.file_size_bytes), 0) as total_size_bytes
         FROM albums al
         LEFT JOIN artists ar ON al.artist_id = ar.id
         LEFT JOIN tracks t ON t.album_id = al.id
         GROUP BY al.id
         ORDER BY al.title ASC",
    )
    .fetch_all(db)
    .await?)
}

#[tauri::command]
#[specta::specta]
pub async fn list_album_rows(db: State<'_, DbPool>) -> Result<Vec<AlbumRow>, AppError> {
    list_album_rows_inner(db.inner()).await
}

pub async fn list_tracks_by_album_inner(
    db: &DbPool,
    album_id: i64,
) -> Result<Vec<TrackRow>, AppError> {
    Ok(sqlx::query_as::<_, TrackRow>(
        "SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_path as album_cover_path
         FROM tracks t
         LEFT JOIN artists a ON t.artist_id = a.id
         LEFT JOIN albums al ON t.album_id = al.id
         WHERE t.album_id = ?
         ORDER BY t.disc_number ASC, t.track_number ASC",
    )
    .bind(album_id)
    .fetch_all(db)
    .await?)
}

#[tauri::command]
#[specta::specta]
pub async fn list_tracks_by_album(
    db: State<'_, DbPool>,
    album_id: i64,
) -> Result<Vec<TrackRow>, AppError> {
    list_tracks_by_album_inner(db.inner(), album_id).await
}

// ── Scan ──

pub async fn scan_collection_inner(
    db: &DbPool,
    collection_id: i64,
    covers_dir: Option<&Path>,
) -> Result<(), AppError> {
    let collection = sqlx::query_as::<_, Collection>(
        "SELECT * FROM collections WHERE id = ?",
    )
    .bind(collection_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Collection {} not found", collection_id)))?;

    let root_path = PathBuf::from(&collection.path);
    if !root_path.exists() {
        return Err(AppError::Io(format!("Directory not found: {:?}", root_path)));
    }

    // Ensure covers directory exists if provided
    if let Some(dir) = covers_dir {
        std::fs::create_dir_all(dir)
            .map_err(|e| AppError::Io(format!("Failed to create covers dir: {}", e)))?;
    }

    info!("Starting scan of collection: {:?}", root_path);

    for entry in WalkDir::new(&root_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();

        let audio_extensions = ["mp3", "m4a", "flac", "wav", "ogg", "opus", "wma"];
        if !audio_extensions.contains(&ext.as_str()) {
            continue;
        }

        if let Err(e) = process_track(db, collection_id, path, covers_dir).await {
            error!("Error processing track {:?}: {:?}", path, e);
        }
    }

    info!("Scan of collection {:?} complete", root_path);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn scan_collection(
    app_handle: tauri::AppHandle,
    db: State<'_, DbPool>,
    collection_id: i64,
) -> Result<(), AppError> {
    let covers_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("Failed to get app data dir: {}", e)))?
        .join("covers");
    scan_collection_inner(db.inner(), collection_id, Some(&covers_dir)).await
}

async fn process_track(
    db: &DbPool,
    collection_id: i64,
    path: &Path,
    covers_dir: Option<&Path>,
) -> Result<(), AppError> {
    let path_str = path.to_string_lossy().replace('\\', "/");
    let file_size = std::fs::metadata(path).map(|m| m.len() as i64).unwrap_or(0);
    let now = Utc::now().to_rfc3339();

    // Read tags
    let (tag_title, artist_name, album_title, year, track_num, disc_num, duration, cover_data) = match Probe::open(path) {
        Ok(probe) => {
            match probe.read() {
                Ok(tagged_file) => {
                    let properties = tagged_file.properties();
                    let duration = properties.duration().as_secs_f64();

                    let tag = tagged_file.primary_tag()
                        .or_else(|| tagged_file.first_tag());

                    if let Some(t) = tag {
                        // Extract first picture if present
                        let picture_data = t.pictures().first().map(|pic| {
                            let ext = match pic.mime_type() {
                                Some(lofty::picture::MimeType::Png) => "png",
                                _ => "jpg",
                            };
                            (pic.data().to_vec(), ext.to_string())
                        });

                        (
                            t.title().map(|s| s.to_string()),
                            t.artist().map(|s| s.to_string()),
                            t.album().map(|s| s.to_string()),
                            t.year().map(|y| y as i32),
                            t.track().map(|tn| tn as i32),
                            t.disk().map(|dn| dn as i32),
                            Some(duration),
                            picture_data,
                        )
                    } else {
                        (None, None, None, None, None, None, Some(duration), None)
                    }
                }
                Err(e) => {
                    warn!("Failed to read tags for {:?}: {:?}", path, e);
                    (None, None, None, None, None, None, None, None)
                }
            }
        }
        Err(e) => {
            warn!("Failed to probe file {:?}: {:?}", path, e);
            (None, None, None, None, None, None, None, None)
        }
    };

    let title = tag_title.unwrap_or_else(|| {
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown Track")
            .to_string()
    });

    let mut tx = db.begin().await?;

    // 1. Ensure Artist exists
    let artist_id = if let Some(name) = artist_name {
        let row: Option<(i64,)> = sqlx::query_as("SELECT id FROM artists WHERE name = ?")
            .bind(&name)
            .fetch_optional(&mut *tx)
            .await?;

        if let Some(r) = row {
            Some(r.0)
        } else {
            let res = sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
                .bind(&name)
                .bind(&now)
                .execute(&mut *tx)
                .await?;
            Some(res.last_insert_rowid())
        }
    } else {
        None
    };

    // 2. Ensure Album exists
    let album_id = if let Some(title) = album_title {
        let row: Option<(i64,)> = sqlx::query_as("SELECT id FROM albums WHERE title = ? AND (artist_id = ? OR (artist_id IS NULL AND ? IS NULL))")
            .bind(&title)
            .bind(artist_id)
            .bind(artist_id)
            .fetch_optional(&mut *tx)
            .await?;

        if let Some(r) = row {
            Some(r.0)
        } else {
            let res = sqlx::query("INSERT INTO albums (title, artist_id, year, created_at) VALUES (?, ?, ?, ?)")
                .bind(&title)
                .bind(artist_id)
                .bind(year)
                .bind(&now)
                .execute(&mut *tx)
                .await?;
            Some(res.last_insert_rowid())
        }
    } else {
        None
    };

    // 2b. Save cover art if we have picture data, a covers dir, and album has no cover yet
    if let (Some(album_id), Some((ref data, ref ext)), Some(dir)) =
        (album_id, &cover_data, covers_dir)
    {
        let existing_cover: Option<(Option<String>,)> =
            sqlx::query_as("SELECT cover_path FROM albums WHERE id = ?")
                .bind(album_id)
                .fetch_optional(&mut *tx)
                .await?;

        let needs_cover = existing_cover
            .map(|(cp,)| cp.is_none())
            .unwrap_or(false);

        if needs_cover {
            let cover_filename = format!("{}.{}", album_id, ext);
            let cover_path = dir.join(&cover_filename);
            if let Err(e) = std::fs::write(&cover_path, data) {
                warn!("Failed to write cover art for album {}: {}", album_id, e);
            } else {
                let cover_path_str = cover_path.to_string_lossy().replace('\\', "/");
                sqlx::query("UPDATE albums SET cover_path = ? WHERE id = ?")
                    .bind(&cover_path_str)
                    .bind(album_id)
                    .execute(&mut *tx)
                    .await?;
            }
        }
    }

    // 3. Upsert Track
    sqlx::query(
        r#"
        INSERT INTO tracks (
            collection_id, album_id, artist_id, title,
            track_number, disc_number, duration_secs,
            file_path, file_size_bytes, file_format,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(file_path) DO UPDATE SET
            album_id = excluded.album_id,
            artist_id = excluded.artist_id,
            title = excluded.title,
            track_number = excluded.track_number,
            disc_number = excluded.disc_number,
            duration_secs = excluded.duration_secs,
            file_size_bytes = excluded.file_size_bytes,
            updated_at = excluded.updated_at
        "#
    )
    .bind(collection_id)
    .bind(album_id)
    .bind(artist_id)
    .bind(&title)
    .bind(track_num)
    .bind(disc_num)
    .bind(duration)
    .bind(&path_str)
    .bind(file_size)
    .bind(path.extension().and_then(|s| s.to_str()))
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

// ── Cover Art ──

pub async fn get_cover_art_inner(
    db: &DbPool,
    track_id: i64,
) -> Result<Option<CoverArt>, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT file_path FROM tracks WHERE id = ?")
            .bind(track_id)
            .fetch_optional(db)
            .await?;

    let file_path = row
        .ok_or_else(|| AppError::NotFound(format!("Track {} not found", track_id)))?
        .0;

    // Normalize forward slashes back to native separators
    let path = PathBuf::from(file_path.replace('/', std::path::MAIN_SEPARATOR_STR));

    let tagged_file = Probe::open(&path)
        .map_err(|e| AppError::Io(format!("Failed to open {:?}: {}", path, e)))?
        .read()
        .map_err(|e| AppError::Io(format!("Failed to read tags from {:?}: {}", path, e)))?;

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let picture = tag.and_then(|t| t.pictures().first());

    match picture {
        Some(pic) => {
            use base64::Engine;
            let mime = match pic.mime_type() {
                Some(lofty::picture::MimeType::Png) => "image/png",
                Some(lofty::picture::MimeType::Bmp) => "image/bmp",
                Some(lofty::picture::MimeType::Gif) => "image/gif",
                Some(lofty::picture::MimeType::Tiff) => "image/tiff",
                _ => "image/jpeg",
            };
            let b64 = base64::engine::general_purpose::STANDARD.encode(pic.data());
            Ok(Some(CoverArt {
                data: b64,
                mime_type: mime.to_string(),
            }))
        }
        None => Ok(None),
    }
}

pub async fn get_album_cover_art_inner(
    db: &DbPool,
    album_id: i64,
) -> Result<Option<CoverArt>, AppError> {
    // Find the first track in this album to read its embedded art
    let row: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM tracks WHERE album_id = ? LIMIT 1")
            .bind(album_id)
            .fetch_optional(db)
            .await?;

    match row {
        Some((track_id,)) => get_cover_art_inner(db, track_id).await,
        None => Ok(None),
    }
}

pub async fn get_artist_cover_art_inner(
    db: &DbPool,
    artist_id: i64,
) -> Result<Option<CoverArt>, AppError> {
    let row: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM tracks WHERE artist_id = ? LIMIT 1")
            .bind(artist_id)
            .fetch_optional(db)
            .await?;

    match row {
        Some((track_id,)) => get_cover_art_inner(db, track_id).await,
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_cover_art(
    db: State<'_, DbPool>,
    track_id: i64,
) -> Result<Option<CoverArt>, AppError> {
    get_cover_art_inner(db.inner(), track_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_album_cover_art(
    db: State<'_, DbPool>,
    album_id: i64,
) -> Result<Option<CoverArt>, AppError> {
    get_album_cover_art_inner(db.inner(), album_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_artist_cover_art(
    db: State<'_, DbPool>,
    artist_id: i64,
) -> Result<Option<CoverArt>, AppError> {
    get_artist_cover_art_inner(db.inner(), artist_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::setup_test_db;
    use crate::models::TrackUpdateInput;

    // ── Collection Tests ──

    #[tokio::test]
    async fn test_list_collections_empty() {
        let db = setup_test_db().await;
        let result = list_collections_inner(&db).await.unwrap();
        assert!(result.is_empty());
    }

    /// Helper: returns a platform-appropriate absolute path for tests
    fn abs_test_path(suffix: &str) -> String {
        if cfg!(windows) {
            format!("C:/music{}", suffix)
        } else {
            format!("/music{}", suffix)
        }
    }

    #[tokio::test]
    async fn test_add_and_list_collection() {
        let db = setup_test_db().await;
        let path = abs_test_path("/library");
        let input = CollectionInput {
            path: path.clone(),
            label: Some("My Music".to_string()),
        };
        let col = add_collection_inner(&db, input, true).await.unwrap();
        assert_eq!(col.path, path);
        assert_eq!(col.label, Some("My Music".to_string()));

        let all = list_collections_inner(&db).await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, col.id);
    }

    #[tokio::test]
    async fn test_add_collection_rejects_relative_path() {
        let db = setup_test_db().await;
        let input = CollectionInput {
            path: "relative/path".to_string(),
            label: None,
        };
        let result = add_collection_inner(&db, input, true).await;
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::InvalidInput(msg) => assert!(msg.contains("absolute")),
            other => panic!("Expected InvalidInput, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_add_collection_duplicate_path_upserts() {
        let db = setup_test_db().await;
        let path = abs_test_path("/library");
        let input1 = CollectionInput {
            path: path.clone(),
            label: Some("Label 1".to_string()),
        };
        let col1 = add_collection_inner(&db, input1, true).await.unwrap();

        let input2 = CollectionInput {
            path: path.clone(),
            label: Some("Label 2".to_string()),
        };
        let col2 = add_collection_inner(&db, input2, true).await.unwrap();

        assert_eq!(col1.id, col2.id);
        assert_eq!(col2.label, Some("Label 2".to_string()));

        let all = list_collections_inner(&db).await.unwrap();
        assert_eq!(all.len(), 1);
    }

    #[tokio::test]
    async fn test_delete_collection() {
        let db = setup_test_db().await;
        let path = abs_test_path("/library");
        let input = CollectionInput {
            path: path,
            label: None,
        };
        let col = add_collection_inner(&db, input, true).await.unwrap();
        delete_collection_inner(&db, col.id).await.unwrap();

        let all = list_collections_inner(&db).await.unwrap();
        assert!(all.is_empty());
    }

    // ── Settings Tests ──

    #[tokio::test]
    async fn test_get_setting_missing() {
        let db = setup_test_db().await;
        let result = get_setting_inner(&db, "nonexistent").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_set_and_get_setting() {
        let db = setup_test_db().await;
        set_setting_inner(&db, "theme", "dark").await.unwrap();
        let val = get_setting_inner(&db, "theme").await.unwrap();
        assert_eq!(val, Some("dark".to_string()));
    }

    #[tokio::test]
    async fn test_set_setting_overwrites() {
        let db = setup_test_db().await;
        set_setting_inner(&db, "theme", "dark").await.unwrap();
        set_setting_inner(&db, "theme", "light").await.unwrap();
        let val = get_setting_inner(&db, "theme").await.unwrap();
        assert_eq!(val, Some("light".to_string()));
    }

    #[tokio::test]
    async fn test_get_all_settings() {
        let db = setup_test_db().await;
        set_setting_inner(&db, "a_key", "val1").await.unwrap();
        set_setting_inner(&db, "b_key", "val2").await.unwrap();
        let all = get_all_settings_inner(&db).await.unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].key, "a_key");
        assert_eq!(all[1].key, "b_key");
    }

    // ── Track Tests ──

    #[tokio::test]
    async fn test_list_tracks_empty() {
        let db = setup_test_db().await;
        let result = list_tracks_inner(&db).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_get_track_not_found() {
        let db = setup_test_db().await;
        let result = get_track_inner(&db, 999).await;
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NotFound(msg) => assert!(msg.contains("999")),
            other => panic!("Expected NotFound, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_update_track() {
        let db = setup_test_db().await;

        // Insert a collection + track manually
        let col = add_collection_inner(&db, CollectionInput {
            path: abs_test_path(""),
            label: None,
        }, true).await.unwrap();

        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO tracks (collection_id, title, file_path, file_size_bytes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(col.id)
        .bind("Original Title")
        .bind("/music/track.mp3")
        .bind(1000i64)
        .bind(&now)
        .bind(&now)
        .execute(&db)
        .await
        .unwrap();

        let tracks = list_tracks_inner(&db).await.unwrap();
        let track_id = tracks[0].id;

        let updated = update_track_inner(&db, track_id, TrackUpdateInput {
            title: Some("New Title".to_string()),
            track_number: Some(5),
            disc_number: None,
            lyrics: None,
            artist_name: None,
            album_title: None,
        }).await.unwrap();

        assert_eq!(updated.title, "New Title");
        assert_eq!(updated.track_number, Some(5));
    }

    /// Helper: insert a bare track and return its id.
    async fn insert_bare_track(db: &DbPool, col_id: i64, title: &str, path: &str) -> i64 {
        let now = Utc::now().to_rfc3339();
        let res = sqlx::query(
            "INSERT INTO tracks (collection_id, title, file_path, file_size_bytes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(col_id)
        .bind(title)
        .bind(path)
        .bind(1000i64)
        .bind(&now)
        .bind(&now)
        .execute(db)
        .await
        .unwrap();
        res.last_insert_rowid()
    }

    #[tokio::test]
    async fn test_update_track_creates_new_artist() {
        let db = setup_test_db().await;
        let col = add_collection_inner(&db, CollectionInput { path: abs_test_path(""), label: None }, true).await.unwrap();
        let track_id = insert_bare_track(&db, col.id, "Song", "/music/song.mp3").await;

        let updated = update_track_inner(&db, track_id, TrackUpdateInput {
            title: None,
            track_number: None,
            disc_number: None,
            lyrics: None,
            artist_name: Some("New Artist".to_string()),
            album_title: None,
        }).await.unwrap();

        assert_eq!(updated.artist_name, Some("New Artist".to_string()));

        // artist row should exist
        let artists = list_artists_inner(&db).await.unwrap();
        assert_eq!(artists.len(), 1);
        assert_eq!(artists[0].name, "New Artist");
    }

    #[tokio::test]
    async fn test_update_track_reuses_existing_artist() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
            .bind("Existing Artist").bind(&now).execute(&db).await.unwrap();

        let col = add_collection_inner(&db, CollectionInput { path: abs_test_path(""), label: None }, true).await.unwrap();
        let track_id = insert_bare_track(&db, col.id, "Song", "/music/song.mp3").await;

        update_track_inner(&db, track_id, TrackUpdateInput {
            title: None, track_number: None, disc_number: None, lyrics: None,
            artist_name: Some("Existing Artist".to_string()),
            album_title: None,
        }).await.unwrap();

        // should NOT have created a second artist row
        let artists = list_artists_inner(&db).await.unwrap();
        assert_eq!(artists.len(), 1);
    }

    #[tokio::test]
    async fn test_update_track_clears_artist_with_empty_string() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();
        let res = sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
            .bind("Artist").bind(&now).execute(&db).await.unwrap();
        let artist_id = res.last_insert_rowid();

        let col = add_collection_inner(&db, CollectionInput { path: abs_test_path(""), label: None }, true).await.unwrap();
        sqlx::query(
            "INSERT INTO tracks (collection_id, artist_id, title, file_path, file_size_bytes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(col.id).bind(artist_id).bind("Song").bind("/music/s.mp3").bind(1000i64).bind(&now).bind(&now)
        .execute(&db).await.unwrap();
        let (track_id,): (i64,) = sqlx::query_as("SELECT last_insert_rowid()").fetch_one(&db).await.unwrap();

        let updated = update_track_inner(&db, track_id, TrackUpdateInput {
            title: None, track_number: None, disc_number: None, lyrics: None,
            artist_name: Some("".to_string()),
            album_title: None,
        }).await.unwrap();

        assert_eq!(updated.artist_id, None);
        assert_eq!(updated.artist_name, None);
    }

    #[tokio::test]
    async fn test_update_track_creates_new_album() {
        let db = setup_test_db().await;
        let col = add_collection_inner(&db, CollectionInput { path: abs_test_path(""), label: None }, true).await.unwrap();
        let track_id = insert_bare_track(&db, col.id, "Song", "/music/song.mp3").await;

        let updated = update_track_inner(&db, track_id, TrackUpdateInput {
            title: None, track_number: None, disc_number: None, lyrics: None,
            artist_name: None,
            album_title: Some("New Album".to_string()),
        }).await.unwrap();

        assert_eq!(updated.album_title, Some("New Album".to_string()));

        let albums = list_albums_inner(&db, None).await.unwrap();
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].title, "New Album");
    }

    #[tokio::test]
    async fn test_update_track_artist_and_album_together() {
        let db = setup_test_db().await;
        let col = add_collection_inner(&db, CollectionInput { path: abs_test_path(""), label: None }, true).await.unwrap();
        let track_id = insert_bare_track(&db, col.id, "Song", "/music/song.mp3").await;

        let updated = update_track_inner(&db, track_id, TrackUpdateInput {
            title: None, track_number: None, disc_number: None, lyrics: None,
            artist_name: Some("Band".to_string()),
            album_title: Some("Debut".to_string()),
        }).await.unwrap();

        assert_eq!(updated.artist_name, Some("Band".to_string()));
        assert_eq!(updated.album_title, Some("Debut".to_string()));

        // Album should be linked to the created artist
        let albums = list_albums_inner(&db, None).await.unwrap();
        assert_eq!(albums.len(), 1);
        let artists = list_artists_inner(&db).await.unwrap();
        assert_eq!(artists.len(), 1);
        assert_eq!(albums[0].artist_id, Some(artists[0].id));
    }

    #[tokio::test]
    async fn test_update_track_clears_album_with_empty_string() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();
        let res = sqlx::query("INSERT INTO albums (title, created_at) VALUES (?, ?)")
            .bind("Album").bind(&now).execute(&db).await.unwrap();
        let album_id = res.last_insert_rowid();

        let col = add_collection_inner(&db, CollectionInput { path: abs_test_path(""), label: None }, true).await.unwrap();
        sqlx::query(
            "INSERT INTO tracks (collection_id, album_id, title, file_path, file_size_bytes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(col.id).bind(album_id).bind("Song").bind("/music/s.mp3").bind(1000i64).bind(&now).bind(&now)
        .execute(&db).await.unwrap();
        let (track_id,): (i64,) = sqlx::query_as("SELECT last_insert_rowid()").fetch_one(&db).await.unwrap();

        let updated = update_track_inner(&db, track_id, TrackUpdateInput {
            title: None, track_number: None, disc_number: None, lyrics: None,
            artist_name: None,
            album_title: Some("".to_string()),
        }).await.unwrap();

        assert_eq!(updated.album_id, None);
        assert_eq!(updated.album_title, None);
    }

    #[tokio::test]
    async fn test_find_or_create_artist_idempotent() {
        let db = setup_test_db().await;
        let id1 = find_or_create_artist(&db, "Same Artist").await.unwrap();
        let id2 = find_or_create_artist(&db, "Same Artist").await.unwrap();
        assert_eq!(id1, id2);
        let artists = list_artists_inner(&db).await.unwrap();
        assert_eq!(artists.len(), 1);
    }

    // ── Artist / Album Tests ──

    #[tokio::test]
    async fn test_list_artists_empty() {
        let db = setup_test_db().await;
        let result = list_artists_inner(&db).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_list_albums_empty() {
        let db = setup_test_db().await;
        let result = list_albums_inner(&db, None).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_list_artists_after_insert() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
            .bind("Artist A")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();

        let artists = list_artists_inner(&db).await.unwrap();
        assert_eq!(artists.len(), 1);
        assert_eq!(artists[0].name, "Artist A");
    }

    #[tokio::test]
    async fn test_list_albums_after_insert() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO albums (title, created_at) VALUES (?, ?)")
            .bind("Album X")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();

        let albums = list_albums_inner(&db, None).await.unwrap();
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].title, "Album X");
    }

    #[tokio::test]
    async fn test_list_albums_by_artist() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        let res = sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
            .bind("Artist A")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        let artist_id = res.last_insert_rowid();

        sqlx::query("INSERT INTO albums (title, artist_id, created_at) VALUES (?, ?, ?)")
            .bind("Album by A")
            .bind(artist_id)
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();

        sqlx::query("INSERT INTO albums (title, created_at) VALUES (?, ?)")
            .bind("Album no artist")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();

        let filtered = list_albums_inner(&db, Some(artist_id)).await.unwrap();
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].title, "Album by A");
    }

    // ── Artist Row / Album Row Tests ──

    #[tokio::test]
    async fn test_list_artist_rows_empty() {
        let db = setup_test_db().await;
        let result = list_artist_rows_inner(&db).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_list_artist_rows_aggregates() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        // Create artist
        let res = sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
            .bind("Artist A")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        let artist_id = res.last_insert_rowid();

        // Create 2 albums for this artist
        let res = sqlx::query("INSERT INTO albums (title, artist_id, created_at) VALUES (?, ?, ?)")
            .bind("Album 1")
            .bind(artist_id)
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        let album1_id = res.last_insert_rowid();

        let res = sqlx::query("INSERT INTO albums (title, artist_id, created_at) VALUES (?, ?, ?)")
            .bind("Album 2")
            .bind(artist_id)
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        let _album2_id = res.last_insert_rowid();

        // Create collection for tracks
        let col = add_collection_inner(
            &db,
            CollectionInput {
                path: abs_test_path(""),
                label: None,
            },
            true,
        )
        .await
        .unwrap();

        // Insert 3 tracks for this artist (2 in album1, 1 with no album)
        for (i, album_id) in [(1, Some(album1_id)), (2, Some(album1_id)), (3, None)] {
            sqlx::query(
                "INSERT INTO tracks (collection_id, album_id, artist_id, title, file_path, file_size_bytes, duration_secs, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(col.id)
            .bind(album_id)
            .bind(artist_id)
            .bind(format!("Track {}", i))
            .bind(format!("/music/track{}.mp3", i))
            .bind(1000i64)
            .bind(120.0)
            .bind(&now)
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        }

        let rows = list_artist_rows_inner(&db).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Artist A");
        assert_eq!(rows[0].album_count, 2);
        assert_eq!(rows[0].track_count, 3);
        assert_eq!(rows[0].total_duration_secs, 360.0);
    }

    #[tokio::test]
    async fn test_list_album_rows_empty() {
        let db = setup_test_db().await;
        let result = list_album_rows_inner(&db).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_list_album_rows_aggregates() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        // Create artist
        let res = sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
            .bind("Artist B")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        let artist_id = res.last_insert_rowid();

        // Create album with year and genre
        let res = sqlx::query(
            "INSERT INTO albums (title, artist_id, year, genre, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind("Album X")
        .bind(artist_id)
        .bind(2020)
        .bind("Rock")
        .bind(&now)
        .execute(&db)
        .await
        .unwrap();
        let album_id = res.last_insert_rowid();

        // Create collection
        let col = add_collection_inner(
            &db,
            CollectionInput {
                path: abs_test_path(""),
                label: None,
            },
            true,
        )
        .await
        .unwrap();

        // Insert 2 tracks in this album
        for i in 1..=2 {
            sqlx::query(
                "INSERT INTO tracks (collection_id, album_id, artist_id, title, file_path, file_size_bytes, duration_secs, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(col.id)
            .bind(album_id)
            .bind(artist_id)
            .bind(format!("Track {}", i))
            .bind(format!("/music/track{}.mp3", i))
            .bind(5000i64)
            .bind(200.5)
            .bind(&now)
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        }

        let rows = list_album_rows_inner(&db).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].title, "Album X");
        assert_eq!(rows[0].artist_name, Some("Artist B".to_string()));
        assert_eq!(rows[0].year, Some(2020));
        assert_eq!(rows[0].genre, Some("Rock".to_string()));
        assert_eq!(rows[0].track_count, 2);
        assert_eq!(rows[0].total_duration_secs, 401.0);
        assert_eq!(rows[0].total_size_bytes, 10000);
    }

    // ── Library Stats Tests ──

    #[tokio::test]
    async fn test_library_stats_empty() {
        let db = setup_test_db().await;
        let stats = get_library_stats_inner(&db).await.unwrap();
        assert_eq!(stats.total_collections, 0);
        assert_eq!(stats.total_artists, 0);
        assert_eq!(stats.total_albums, 0);
        assert_eq!(stats.total_tracks, 0);
        assert_eq!(stats.total_size_bytes, 0);
        assert_eq!(stats.total_duration_secs, 0.0);
    }

    #[tokio::test]
    async fn test_library_stats_after_inserts() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        let col = add_collection_inner(&db, CollectionInput {
            path: abs_test_path(""),
            label: None,
        }, true).await.unwrap();

        sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
            .bind("Artist")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();

        sqlx::query("INSERT INTO albums (title, created_at) VALUES (?, ?)")
            .bind("Album")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();

        sqlx::query(
            "INSERT INTO tracks (collection_id, title, file_path, file_size_bytes, duration_secs, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(col.id)
        .bind("Track")
        .bind("/music/track.mp3")
        .bind(5000i64)
        .bind(180.5)
        .bind(&now)
        .bind(&now)
        .execute(&db)
        .await
        .unwrap();

        let stats = get_library_stats_inner(&db).await.unwrap();
        assert_eq!(stats.total_collections, 1);
        assert_eq!(stats.total_artists, 1);
        assert_eq!(stats.total_albums, 1);
        assert_eq!(stats.total_tracks, 1);
        assert_eq!(stats.total_size_bytes, 5000);
        assert_eq!(stats.total_duration_secs, 180.5);
    }

    // ── Scan Test ──

    #[tokio::test]
    async fn test_scan_collection_with_fixture() {
        use lofty::config::WriteOptions;
        use lofty::picture::{Picture, PictureType, MimeType};
        use lofty::tag::{Tag, TagType, Accessor};
        use std::io::Write;

        let db = setup_test_db().await;
        let tmp_dir = tempfile::tempdir().unwrap();

        // Create a minimal MP3 fixture: multiple valid MPEG1 Layer 3 frames
        // so lofty recognizes it as a valid file
        let mp3_path = tmp_dir.path().join("test.mp3");
        {
            let mut file = std::fs::File::create(&mp3_path).unwrap();
            // MPEG1, Layer 3, 128kbps, 44100Hz, stereo = frame size 417 bytes
            // Header: 0xFF 0xFB 0x90 0x64
            let mut frame = [0u8; 417];
            frame[0] = 0xFF;
            frame[1] = 0xFB;
            frame[2] = 0x90;
            frame[3] = 0x64;
            // Write 3 frames so lofty sees enough valid data
            for _ in 0..3 {
                file.write_all(&frame).unwrap();
            }
        }

        // Minimal 1x1 PNG (67 bytes)
        let png_bytes: Vec<u8> = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
            0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
            0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00,
            0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
            0xAE, 0x42, 0x60, 0x82,
        ];

        // Write ID3v2 tags using lofty (including cover art)
        {
            let mut tagged_file = lofty::read_from_path(&mp3_path).unwrap();
            tagged_file.insert_tag(Tag::new(TagType::Id3v2));
            let tag = tagged_file.tag_mut(TagType::Id3v2).unwrap();
            tag.set_title("Test Track".to_string());
            tag.set_artist("Test Artist".to_string());
            tag.set_album("Test Album".to_string());
            tag.set_track(1);
            tag.push_picture(Picture::new_unchecked(
                PictureType::CoverFront,
                Some(MimeType::Png),
                None,
                png_bytes.clone(),
            ));
            tagged_file.save_to_path(&mp3_path, WriteOptions::default()).unwrap();
        }

        // Add the temp dir as a collection (skip fs checks since it exists)
        let col_path = tmp_dir.path().to_string_lossy().replace('\\', "/");
        let col = add_collection_inner(&db, CollectionInput {
            path: col_path,
            label: Some("Test Collection".to_string()),
        }, true).await.unwrap();

        // Set up a covers directory inside tmp
        let covers_dir = tmp_dir.path().join("covers");

        // Run scan with covers_dir
        scan_collection_inner(&db, col.id, Some(&covers_dir)).await.unwrap();

        // Verify results
        let tracks = list_tracks_inner(&db).await.unwrap();
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].title, "Test Track");
        assert_eq!(tracks[0].artist_name, Some("Test Artist".to_string()));
        assert_eq!(tracks[0].album_title, Some("Test Album".to_string()));
        assert_eq!(tracks[0].track_number, Some(1));

        let artists = list_artists_inner(&db).await.unwrap();
        assert_eq!(artists.len(), 1);
        assert_eq!(artists[0].name, "Test Artist");

        let albums = list_albums_inner(&db, None).await.unwrap();
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].title, "Test Album");

        // Verify cover art was extracted
        assert!(albums[0].cover_path.is_some(), "Album should have cover_path set");
        let cover_path = PathBuf::from(albums[0].cover_path.as_ref().unwrap().replace('/', std::path::MAIN_SEPARATOR_STR));
        assert!(cover_path.exists(), "Cover file should exist on disk at {:?}", cover_path);
        let saved_bytes = std::fs::read(&cover_path).unwrap();
        assert_eq!(saved_bytes, png_bytes, "Saved cover should match embedded PNG");
    }

    // ── Debug Query Tests ──

    #[tokio::test]
    async fn test_debug_query_table_rejects_invalid() {
        let db = setup_test_db().await;
        let result = debug_query_table_inner(&db, "users").await;
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::InvalidInput(msg) => assert!(msg.contains("users")),
            other => panic!("Expected InvalidInput, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_debug_query_table_allowed() {
        let db = setup_test_db().await;
        let result = debug_query_table_inner(&db, "collections").await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_clear_all_data() {
        let db = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        // Insert artist, album, collection, track
        let res = sqlx::query("INSERT INTO artists (name, created_at) VALUES (?, ?)")
            .bind("Artist X")
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        let artist_id = res.last_insert_rowid();

        let res = sqlx::query("INSERT INTO albums (title, artist_id, created_at) VALUES (?, ?, ?)")
            .bind("Album X")
            .bind(artist_id)
            .bind(&now)
            .execute(&db)
            .await
            .unwrap();
        let album_id = res.last_insert_rowid();

        let res = sqlx::query(
            "INSERT INTO collections (path, label, created_at) VALUES (?, ?, ?)",
        )
        .bind("/music")
        .bind("Test")
        .bind(&now)
        .execute(&db)
        .await
        .unwrap();
        let collection_id = res.last_insert_rowid();

        sqlx::query(
            "INSERT INTO tracks (collection_id, album_id, artist_id, title, file_path, file_size_bytes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(collection_id)
        .bind(album_id)
        .bind(artist_id)
        .bind("Track X")
        .bind("/music/track.mp3")
        .bind(1000i64)
        .bind(&now)
        .bind(&now)
        .execute(&db)
        .await
        .unwrap();

        // Clear without a covers dir (no filesystem side-effect needed)
        clear_all_data_inner(&db, None).await.unwrap();

        let artists = list_artists_inner(&db).await.unwrap();
        let albums = list_albums_inner(&db, None).await.unwrap();
        let collections = list_collections_inner(&db).await.unwrap();
        let tracks = list_tracks_inner(&db).await.unwrap();

        assert!(artists.is_empty(), "artists should be empty after clear");
        assert!(albums.is_empty(), "albums should be empty after clear");
        assert!(collections.is_empty(), "collections should be empty after clear");
        assert!(tracks.is_empty(), "tracks should be empty after clear");
    }
}
