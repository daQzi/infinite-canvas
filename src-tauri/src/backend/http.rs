use std::collections::HashMap;

use base64::{engine::general_purpose, Engine as _};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use tauri::State;

pub struct HttpClient {
    client: reqwest::Client,
}

impl Default for HttpClient {
    fn default() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestPayload {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body_base64: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponsePayload {
    status: u16,
    headers: HashMap<String, String>,
    body_base64: String,
}

#[tauri::command]
pub async fn tauri_http_request(
    client: State<'_, HttpClient>,
    payload: HttpRequestPayload,
) -> Result<HttpResponsePayload, String> {
    let url = reqwest::Url::parse(&payload.url).map_err(|error| format!("请求地址不合法：{error}"))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Tauri HTTP 仅支持 http/https 请求".into());
    }

    let method = payload
        .method
        .parse::<reqwest::Method>()
        .map_err(|_| format!("请求方法不支持：{}", payload.method))?;
    let mut request = client
        .client
        .request(method, url)
        .headers(build_headers(payload.headers)?);

    if let Some(body_base64) = payload.body_base64 {
        let body = general_purpose::STANDARD
            .decode(body_base64)
            .map_err(|error| format!("请求体解码失败：{error}"))?;
        request = request.body(body);
    }

    let response = request.send().await.map_err(|error| format!("请求失败：{error}"))?;
    let status = response.status().as_u16();
    let headers = response_headers(response.headers());
    let body = response.bytes().await.map_err(|error| format!("读取响应失败：{error}"))?;

    Ok(HttpResponsePayload {
        status,
        headers,
        body_base64: general_purpose::STANDARD.encode(body),
    })
}

fn build_headers(input: HashMap<String, String>) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    for (name, value) in input {
        let normalized_name = name.to_ascii_lowercase();
        if matches!(
            normalized_name.as_str(),
            "connection"
                | "content-length"
                | "host"
                | "origin"
                | "referer"
                | "te"
                | "trailer"
                | "transfer-encoding"
                | "upgrade"
        ) {
            continue;
        }

        let header_name =
            HeaderName::from_bytes(name.as_bytes()).map_err(|error| format!("请求头名称不合法：{name}（{error}）"))?;
        let header_value =
            HeaderValue::from_str(&value).map_err(|error| format!("请求头 {name} 的值不合法：{error}"))?;
        headers.insert(header_name, header_value);
    }
    Ok(headers)
}

fn response_headers(input: &HeaderMap) -> HashMap<String, String> {
    input
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.as_str().to_string(), value.to_string()))
        })
        .collect()
}
