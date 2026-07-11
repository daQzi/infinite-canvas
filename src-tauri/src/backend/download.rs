use std::fs;

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use super::{http::HttpClient, media::read_media_bytes};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFilePayload {
    file_name: String,
    source: DownloadSource,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum DownloadSource {
    Url { url: String },
    Storage { storage_key: String },
    Base64 { body_base64: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFileResponse {
    status: &'static str,
    path: Option<String>,
}

#[tauri::command]
pub async fn tauri_save_file(
    app: AppHandle,
    client: State<'_, HttpClient>,
    payload: SaveFilePayload,
) -> Result<SaveFileResponse, String> {
    let selected = app
        .dialog()
        .file()
        .set_file_name(safe_file_name(&payload.file_name))
        .blocking_save_file();
    let Some(selected) = selected else {
        return Ok(SaveFileResponse {
            status: "cancelled",
            path: None,
        });
    };
    let path = selected
        .into_path()
        .map_err(|error| format!("读取保存路径失败：{error}"))?;
    let body = match payload.source {
        DownloadSource::Url { url } => client.download(&url).await?,
        DownloadSource::Storage { storage_key } => read_media_bytes(&app, &storage_key)?,
        DownloadSource::Base64 { body_base64 } => general_purpose::STANDARD
            .decode(body_base64)
            .map_err(|error| format!("下载文件解码失败：{error}"))?,
    };

    fs::write(&path, body).map_err(|error| format!("保存文件失败：{error}"))?;
    Ok(SaveFileResponse {
        status: "saved",
        path: Some(path.to_string_lossy().into_owned()),
    })
}

fn safe_file_name(value: &str) -> String {
    let name = value
        .trim()
        .chars()
        .map(|char| {
            if char.is_control() || matches!(char, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                '_'
            } else {
                char
            }
        })
        .collect::<String>();
    if name.trim().is_empty() {
        "download".into()
    } else {
        name
    }
}

#[cfg(test)]
mod tests {
    use super::safe_file_name;

    #[test]
    fn sanitizes_suggested_file_names() {
        assert_eq!(safe_file_name("../bad:name?.png"), ".._bad_name_.png");
        assert_eq!(safe_file_name("  "), "download");
    }

    #[test]
    fn accepts_only_http_download_urls() {
        assert!(super::super::http::http_url("https://example.com/file.png").is_ok());
        assert!(super::super::http::http_url("http://example.com/file.png").is_ok());
        assert!(super::super::http::http_url("file:///tmp/file.png").is_err());
    }
}
