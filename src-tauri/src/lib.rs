mod backend;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(backend::http::HttpClient::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            backend::http::tauri_http_request,
            backend::media::tauri_store_media_file,
            backend::media::tauri_read_media_file,
            backend::media::tauri_delete_media_files,
            backend::media::tauri_cleanup_media_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
