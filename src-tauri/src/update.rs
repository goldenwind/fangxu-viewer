use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, time::Duration};
use tauri::{AppHandle, Emitter, State};
use tokio::{fs, io::AsyncWriteExt};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfig {
    product_id: u64,
    base_url: String,
    channel: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(default, rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct UpdateInfo {
    #[serde(alias = "updateAvailable")]
    update_available: bool,
    #[serde(alias = "forceUpdate")]
    force_update: bool,
    #[serde(alias = "currentVersion")]
    current_version: String,
    #[serde(alias = "latestVersion")]
    latest_version: String,
    #[serde(alias = "minSupportedVersion")]
    min_supported_version: String,
    channel: String,
    platform: String,
    arch: String,
    title: String,
    #[serde(alias = "releaseNotes")]
    release_notes: String,
    #[serde(alias = "downloadUrl")]
    download_url: String,
    #[serde(alias = "pageUrl")]
    page_url: String,
    sha256: String,
    #[serde(alias = "fileSize")]
    file_size: u64,
}

#[derive(Debug, Serialize)]
pub struct UpdateError {
    message: String,
    status: Option<u16>,
}

impl UpdateError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            status: None,
        }
    }

    fn response(message: impl Into<String>, status: u16) -> Self {
        Self {
            message: message.into(),
            status: Some(status),
        }
    }
}

#[derive(Deserialize)]
struct Envelope {
    status: u16,
    message: Option<String>,
    data: Option<UpdateInfo>,
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    path: String,
}

pub struct UpdateClient(Client);

impl Default for UpdateClient {
    fn default() -> Self {
        Self(
            Client::builder()
                .timeout(Duration::from_secs(30))
                .redirect(reqwest::redirect::Policy::custom(|attempt| {
                    if attempt.url().scheme() == "https" {
                        attempt.follow()
                    } else {
                        attempt.stop()
                    }
                }))
                .user_agent(concat!(
                    env!("CARGO_PKG_NAME"),
                    "/",
                    env!("CARGO_PKG_VERSION")
                ))
                .build()
                .expect("update HTTP client should build"),
        )
    }
}

fn secure_base_url(raw: &str) -> Result<Url, UpdateError> {
    let mut url = Url::parse(raw).map_err(|_| UpdateError::new("升级服务地址无效。"))?;
    let local_http = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    if url.scheme() != "https" && !(cfg!(debug_assertions) && url.scheme() == "http" && local_http) {
        return Err(UpdateError::new("升级服务必须使用 HTTPS。"));
    }
    url.set_query(None);
    url.set_fragment(None);
    if !url.path().ends_with('/') {
        url.set_path(&format!("{}/", url.path()));
    }
    Ok(url)
}

fn normalized_platform() -> &'static str {
    match std::env::consts::OS {
        "macos" => "macos",
        "windows" => "windows",
        _ => "linux",
    }
}

fn normalized_arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        _ => "x86",
    }
}

fn safe_file_name(url: &Url, version: &str) -> String {
    let candidate = url
        .path_segments()
        .and_then(|mut parts| parts.next_back())
        .unwrap_or("");
    let cleaned: String = candidate
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() || matches!(char, '.' | '-' | '_') {
                char
            } else {
                '_'
            }
        })
        .collect();
    if cleaned.is_empty() {
        format!("product-update-{version}.bin")
    } else {
        cleaned
    }
}

#[tauri::command]
pub async fn product_update_check(
    app: AppHandle,
    client: State<'_, UpdateClient>,
    config: UpdateConfig,
    installation_id: String,
) -> Result<UpdateInfo, UpdateError> {
    if config.product_id == 0 {
        return Err(UpdateError::new("升级产品尚未配置。"));
    }
    let mut url = secure_base_url(&config.base_url)?;
    let product_id = config.product_id.to_string();
    url.path_segments_mut()
        .map_err(|_| UpdateError::new("升级服务地址无效。"))?
        .extend(["api", "products", &product_id, "releases", "latest"]);
    url.query_pairs_mut()
        .append_pair("current_version", &app.package_info().version.to_string())
        .append_pair("channel", &config.channel)
        .append_pair("platform", normalized_platform())
        .append_pair("arch", normalized_arch())
        .append_pair("installation_id", &installation_id);
    let response = client
        .0
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| UpdateError::new("无法连接升级服务，请稍后重试。"))?;
    let http_status = response.status().as_u16();
    let envelope: Envelope = response
        .json()
        .await
        .map_err(|_| UpdateError::response("升级服务返回了无法识别的数据。", http_status))?;
    if envelope.status != 200 {
        return Err(UpdateError::response(
            envelope
                .message
                .unwrap_or_else(|| "检查升级失败。".into()),
            envelope.status,
        ));
    }
    envelope
        .data
        .ok_or_else(|| UpdateError::response("升级服务返回了无法识别的数据。", http_status))
}

#[tauri::command]
pub async fn product_update_download(
    app: AppHandle,
    client: State<'_, UpdateClient>,
    release: UpdateInfo,
) -> Result<DownloadResult, UpdateError> {
    if !release.update_available || release.download_url.is_empty() {
        return Err(UpdateError::new("该版本没有可用的安装包直链。"));
    }
    let url = Url::parse(&release.download_url)
        .map_err(|_| UpdateError::new("安装包地址无效。"))?;
    if url.scheme() != "https" {
        return Err(UpdateError::new("安装包必须通过 HTTPS 下载。"));
    }
    let mut response = client
        .0
        .get(url.clone())
        .send()
        .await
        .map_err(|_| UpdateError::new("无法下载安装包，请稍后重试。"))?;
    if !response.status().is_success() {
        return Err(UpdateError::response(
            "安装包下载失败。",
            response.status().as_u16(),
        ));
    }
    let total = response.content_length().unwrap_or(release.file_size);
    let directory: PathBuf =
        std::env::temp_dir().join(format!("{}-updates", env!("CARGO_PKG_NAME")));
    fs::create_dir_all(&directory)
        .await
        .map_err(|_| UpdateError::new("无法创建升级下载目录。"))?;
    let final_path = directory.join(safe_file_name(&url, &release.latest_version));
    let partial_path = final_path.with_extension(format!(
        "{}.part",
        final_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("download")
    ));
    let mut file = fs::File::create(&partial_path)
        .await
        .map_err(|_| UpdateError::new("无法创建安装包文件。"))?;
    let mut digest = Sha256::new();
    let mut downloaded = 0_u64;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| UpdateError::new("安装包下载中断。"))?
    {
        file.write_all(&chunk)
            .await
            .map_err(|_| UpdateError::new("无法写入安装包文件。"))?;
        digest.update(&chunk);
        downloaded += chunk.len() as u64;
        let _ = app.emit(
            "product-update-download-progress",
            DownloadProgress { downloaded, total },
        );
    }
    file.flush()
        .await
        .map_err(|_| UpdateError::new("无法保存安装包文件。"))?;
    if !release.sha256.is_empty() {
        let actual = format!("{:x}", digest.finalize());
        if !actual.eq_ignore_ascii_case(&release.sha256) {
            let _ = fs::remove_file(&partial_path).await;
            return Err(UpdateError::new("安装包校验失败，文件可能不完整，请重新下载。"));
        }
    }
    if fs::try_exists(&final_path).await.unwrap_or(false) {
        fs::remove_file(&final_path)
            .await
            .map_err(|_| UpdateError::new("无法替换旧的安装包文件。"))?;
    }
    fs::rename(&partial_path, &final_path)
        .await
        .map_err(|_| UpdateError::new("无法完成安装包下载。"))?;
    Ok(DownloadResult {
        path: final_path.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_service_requires_https() {
        assert!(secure_base_url("http://updates.example.com").is_err());
        assert!(secure_base_url("https://updates.example.com/base").is_ok());
    }

    #[test]
    fn download_file_name_cannot_escape_cache_directory() {
        let url = Url::parse("https://cdn.example.com/releases/app%20setup.dmg").unwrap();
        assert_eq!(safe_file_name(&url, "1.0.0"), "app_20setup.dmg");
    }

    #[test]
    fn release_accepts_server_and_frontend_field_names() {
        let snake: UpdateInfo = serde_json::from_str(
            r#"{"update_available":true,"latest_version":"2.0.0"}"#,
        )
        .unwrap();
        let camel: UpdateInfo = serde_json::from_str(
            r#"{"updateAvailable":true,"latestVersion":"2.0.0"}"#,
        )
        .unwrap();
        assert!(snake.update_available);
        assert!(camel.update_available);
        assert_eq!(snake.latest_version, camel.latest_version);
    }
}
