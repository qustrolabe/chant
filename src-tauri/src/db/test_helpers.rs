use sqlx::SqlitePool;
use super::DbPool;
use super::queries::*;

pub async fn setup_test_db() -> DbPool {
    let pool = SqlitePool::connect("sqlite::memory:")
        .await
        .expect("Failed to create in-memory SQLite pool");

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .expect("Failed to enable foreign keys");

    // Create all tables (same as init_db)
    sqlx::query(CREATE_COLLECTIONS_TABLE).execute(&pool).await.unwrap();
    sqlx::query(CREATE_ARTISTS_TABLE).execute(&pool).await.unwrap();
    sqlx::query(CREATE_ARTISTS_NAME_INDEX).execute(&pool).await.unwrap();
    sqlx::query(CREATE_ALBUMS_TABLE).execute(&pool).await.unwrap();
    sqlx::query(CREATE_ALBUMS_TITLE_INDEX).execute(&pool).await.unwrap();
    sqlx::query(CREATE_ALBUMS_ARTIST_INDEX).execute(&pool).await.unwrap();
    sqlx::query(CREATE_TRACKS_TABLE).execute(&pool).await.unwrap();
    sqlx::query(CREATE_TRACKS_COLLECTION_INDEX).execute(&pool).await.unwrap();
    sqlx::query(CREATE_TRACKS_ALBUM_INDEX).execute(&pool).await.unwrap();
    sqlx::query(CREATE_TRACKS_ARTIST_INDEX).execute(&pool).await.unwrap();
    sqlx::query(CREATE_TRACKS_FILE_PATH_INDEX).execute(&pool).await.unwrap();
    sqlx::query(CREATE_SETTINGS_TABLE).execute(&pool).await.unwrap();

    pool
}
