use std::{
    collections::HashSet,
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreMediaFilePayload {
    storage_key: Option<String>,
    prefix: Option<String>,
    mime_type: Option<String>,
    body_base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreMediaFileResponse {
    storage_key: String,
    bytes: u64,
    mime_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadMediaFilePayload {
    storage_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadMediaFileResponse {
    body_base64: String,
    mime_type: String,
    bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMediaFilesPayload {
    storage_keys: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupMediaFilesPayload {
    used_storage_keys: Vec<String>,
    prefixes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaFileMeta {
    storage_key: String,
    mime_type: String,
    bytes: u64,
    created_at_ms: u128,
}

#[tauri::command]
pub fn tauri_store_media_file(
    app: AppHandle,
    payload: StoreMediaFilePayload,
) -> Result<StoreMediaFileResponse, String> {
    let body = general_purpose::STANDARD
        .decode(payload.body_base64)
        .map_err(|error| format!("媒体文件解码失败：{error}"))?;
    let storage_key = payload
        .storage_key
        .filter(|key| !key.trim().is_empty())
        .unwrap_or_else(|| generated_storage_key(payload.prefix.as_deref().unwrap_or("file")));
    let mime_type = payload
        .mime_type
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let paths = media_paths(&app, &storage_key)?;

    fs::write(&paths.body, &body).map_err(|error| format!("写入媒体文件失败：{error}"))?;
    let meta = MediaFileMeta {
        storage_key: storage_key.clone(),
        mime_type: mime_type.clone(),
        bytes: body.len() as u64,
        created_at_ms: now_ms(),
    };
    let meta_json = serde_json::to_vec(&meta).map_err(|error| format!("序列化媒体元数据失败：{error}"))?;
    fs::write(&paths.meta, meta_json).map_err(|error| format!("写入媒体元数据失败：{error}"))?;

    Ok(StoreMediaFileResponse {
        storage_key,
        bytes: body.len() as u64,
        mime_type,
    })
}

#[tauri::command]
pub fn tauri_read_media_file(
    app: AppHandle,
    payload: ReadMediaFilePayload,
) -> Result<Option<ReadMediaFileResponse>, String> {
    let paths = media_paths(&app, &payload.storage_key)?;
    if !paths.body.exists() {
        return Ok(None);
    }

    let body = fs::read(&paths.body).map_err(|error| format!("读取媒体文件失败：{error}"))?;
    let meta = read_media_meta(paths.meta).unwrap_or(MediaFileMeta {
        storage_key: payload.storage_key,
        mime_type: "application/octet-stream".to_string(),
        bytes: body.len() as u64,
        created_at_ms: 0,
    });

    Ok(Some(ReadMediaFileResponse {
        body_base64: general_purpose::STANDARD.encode(body),
        mime_type: meta.mime_type,
        bytes: meta.bytes,
    }))
}

#[tauri::command]
pub fn tauri_delete_media_files(
    app: AppHandle,
    payload: DeleteMediaFilesPayload,
) -> Result<(), String> {
    for storage_key in payload.storage_keys {
        let paths = media_paths(&app, &storage_key)?;
        remove_file_if_exists(paths.body)?;
        remove_file_if_exists(paths.meta)?;
    }
    Ok(())
}

#[tauri::command]
pub fn tauri_cleanup_media_files(
    app: AppHandle,
    payload: CleanupMediaFilesPayload,
) -> Result<Vec<String>, String> {
    let dir = media_dir(&app)?;
    let used_keys = payload.used_storage_keys.into_iter().collect::<HashSet<_>>();
    let prefixes = payload.prefixes;
    let mut deleted = Vec::new();

    for entry in fs::read_dir(&dir).map_err(|error| format!("扫描媒体目录失败：{error}"))? {
        let entry = entry.map_err(|error| format!("读取媒体目录失败：{error}"))?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Some(meta) = read_media_meta(path.clone()) else {
            continue;
        };
        if !prefixes
            .iter()
            .any(|prefix| meta.storage_key.starts_with(prefix))
            || used_keys.contains(&meta.storage_key)
        {
            continue;
        }

        let paths = media_paths_from_dir(&dir, &meta.storage_key)?;
        remove_file_if_exists(paths.body)?;
        remove_file_if_exists(paths.meta)?;
        deleted.push(meta.storage_key);
    }

    Ok(deleted)
}

struct MediaPaths {
    body: PathBuf,
    meta: PathBuf,
}

fn media_paths(app: &AppHandle, storage_key: &str) -> Result<MediaPaths, String> {
    let dir = media_dir(app)?;
    media_paths_from_dir(&dir, storage_key)
}

fn media_paths_from_dir(dir: &PathBuf, storage_key: &str) -> Result<MediaPaths, String> {
    let file_name = safe_file_name(storage_key)?;
    Ok(MediaPaths {
        body: dir.join(format!("{file_name}.bin")),
        meta: dir.join(format!("{file_name}.json")),
    })
}

fn media_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("读取应用数据目录失败：{error}"))?
        .join("media");
    fs::create_dir_all(&dir).map_err(|error| format!("创建媒体目录失败：{error}"))?;
    Ok(dir)
}

fn safe_file_name(storage_key: &str) -> Result<String, String> {
    let value = storage_key
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() || matches!(char, '-' | '_' | '.') {
                char
            } else {
                '_'
            }
        })
        .collect::<String>();
    if value.is_empty() {
        return Err("媒体 storageKey 不能为空".into());
    }
    Ok(value)
}

fn read_media_meta(path: PathBuf) -> Option<MediaFileMeta> {
    let data = fs::read(path).ok()?;
    serde_json::from_slice(&data).ok()
}

fn remove_file_if_exists(path: PathBuf) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("删除媒体文件失败：{error}")),
    }
}

fn generated_storage_key(prefix: &str) -> String {
    format!("{}:{}", prefix, now_ms())
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}
