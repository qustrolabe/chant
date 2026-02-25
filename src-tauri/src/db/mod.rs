use log::info;
use sqlx::{Pool, Sqlite, SqlitePool};
use std::path::PathBuf;
use tauri::Manager;

pub mod queries;
#[cfg(test)]
pub mod test_helpers;
use queries::*;

pub type DbPool = Pool<Sqlite>;

fn get_db_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let path = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get app data dir")
        .join("chant.db");

    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    path
}

pub async fn init_db(app_handle: &tauri::AppHandle) -> Result<DbPool, sqlx::Error> {
    let db_path = get_db_path(app_handle);
    info!("Initializing Chant database at: {:?}", db_path);

    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    let pool = SqlitePool::connect(&db_url).await?;

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;

    // Collections
    sqlx::query(CREATE_COLLECTIONS_TABLE).execute(&pool).await?;

    // Artists
    sqlx::query(CREATE_ARTISTS_TABLE).execute(&pool).await?;
    sqlx::query(CREATE_ARTISTS_NAME_INDEX).execute(&pool).await?;

    // Albums
    sqlx::query(CREATE_ALBUMS_TABLE).execute(&pool).await?;
    sqlx::query(CREATE_ALBUMS_TITLE_INDEX).execute(&pool).await?;
    sqlx::query(CREATE_ALBUMS_ARTIST_INDEX).execute(&pool).await?;

    // Tracks
    sqlx::query(CREATE_TRACKS_TABLE).execute(&pool).await?;
    sqlx::query(CREATE_TRACKS_COLLECTION_INDEX)
        .execute(&pool)
        .await?;
    sqlx::query(CREATE_TRACKS_ALBUM_INDEX).execute(&pool).await?;
    sqlx::query(CREATE_TRACKS_ARTIST_INDEX)
        .execute(&pool)
        .await?;
    sqlx::query(CREATE_TRACKS_FILE_PATH_INDEX)
        .execute(&pool)
        .await?;

    // Settings
    sqlx::query(CREATE_SETTINGS_TABLE).execute(&pool).await?;

    info!("Chant database initialized successfully");
    Ok(pool)
}
