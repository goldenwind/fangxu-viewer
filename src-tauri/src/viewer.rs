use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use exif::{In, Reader as ExifReader, Tag};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "tiff", "tif", "avif", "heic", "heif", "jfif"
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageItem {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub modified_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderScanResult {
    pub folder_path: String,
    pub images: Vec<ImageItem>,
    pub current_index: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExifInfo {
    pub make: Option<String>,
    pub model: Option<String>,
    pub lens: Option<String>,
    pub date_time: Option<String>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    pub iso: Option<String>,
    pub focal_length: Option<String>,
    pub exposure_bias: Option<String>,
    pub flash: Option<String>,
    pub software: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadataResult {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub modified_ms: u64,
    pub exif: Option<ExifInfo>,
}

pub fn is_supported_image<P: AsRef<Path>>(path: P) -> bool {
    path.as_ref()
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lower = ext.to_ascii_lowercase();
            SUPPORTED_EXTENSIONS.contains(&lower.as_str())
        })
        .unwrap_or(false)
}

/// Natural sorting comparator chunk
#[derive(Debug, PartialEq, Eq)]
enum Chunk<'a> {
    Num(u128),
    Str(&'a str),
}

fn chunk_str(mut s: &str) -> Vec<Chunk<'_>> {
    let mut chunks = Vec::new();
    while !s.is_empty() {
        if s.chars().next().unwrap().is_ascii_digit() {
            let end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
            let num_str = &s[..end];
            let num = num_str.parse::<u128>().unwrap_or(u128::MAX);
            chunks.push(Chunk::Num(num));
            s = &s[end..];
        } else {
            let end = s.find(|c: char| c.is_ascii_digit()).unwrap_or(s.len());
            chunks.push(Chunk::Str(&s[..end]));
            s = &s[end..];
        }
    }
    chunks
}

pub fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let a_chunks = chunk_str(a);
    let b_chunks = chunk_str(b);

    for (ca, cb) in a_chunks.iter().zip(b_chunks.iter()) {
        match (ca, cb) {
            (Chunk::Num(na), Chunk::Num(nb)) => {
                if na != nb {
                    return na.cmp(nb);
                }
            }
            (Chunk::Str(sa), Chunk::Str(sb)) => {
                let ord = sa.to_lowercase().cmp(&sb.to_lowercase());
                if ord != std::cmp::Ordering::Equal {
                    return ord;
                }
            }
            (Chunk::Num(_), Chunk::Str(_)) => return std::cmp::Ordering::Less,
            (Chunk::Str(_), Chunk::Num(_)) => return std::cmp::Ordering::Greater,
        }
    }
    a_chunks.len().cmp(&b_chunks.len()).then_with(|| a.cmp(b))
}

#[tauri::command]
pub async fn scan_folder_images(target_path: String) -> Result<FolderScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = PathBuf::from(&target_path);
        let (dir_path, target_file) = if p.is_dir() {
            (p, None)
        } else {
            let parent = p.parent().ok_or_else(|| "无法获取文件所在目录".to_string())?;
            (parent.to_path_buf(), Some(p))
        };

        if !dir_path.exists() {
            return Err("目录不存在".to_string());
        }

        let mut entries = Vec::new();
        let read_dir = fs::read_dir(&dir_path).map_err(|e| format!("读取目录失败: {e}"))?;

        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.is_file() && is_supported_image(&path) {
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let metadata = entry.metadata().ok();
                let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                let modified_ms = metadata
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                entries.push(ImageItem {
                    path: path.to_string_lossy().to_string(),
                    name,
                    size_bytes,
                    modified_ms,
                });
            }
        }

        // Sort naturally
        entries.sort_by(|a, b| natural_cmp(&a.name, &b.name));

        let current_index = if let Some(target) = target_file {
            let target_str = target.to_string_lossy().to_string();
            entries.iter().position(|item| item.path == target_str).map(|i| i as i32).unwrap_or(0)
        } else if !entries.is_empty() {
            0
        } else {
            -1
        };

        Ok(FolderScanResult {
            folder_path: dir_path.to_string_lossy().to_string(),
            images: entries,
            current_index,
        })
    })
    .await
    .map_err(|e| format!("扫描目录任务失败: {e}"))?
}

fn extract_exif(path: &Path) -> Option<ExifInfo> {
    let file = File::open(path).ok()?;
    let mut bufreader = BufReader::new(&file);
    let exifreader = ExifReader::new();
    let exif = exifreader.read_from_container(&mut bufreader).ok()?;

    let mut info = ExifInfo::default();

    if let Some(field) = exif.get_field(Tag::Make, In::PRIMARY) {
        info.make = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::Model, In::PRIMARY) {
        info.model = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::LensModel, In::PRIMARY) {
        info.lens = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::DateTimeOriginal, In::PRIMARY).or_else(|| exif.get_field(Tag::DateTime, In::PRIMARY)) {
        info.date_time = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::ExposureTime, In::PRIMARY) {
        info.exposure_time = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::FNumber, In::PRIMARY) {
        info.f_number = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::PhotographicSensitivity, In::PRIMARY) {
        info.iso = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::FocalLength, In::PRIMARY) {
        info.focal_length = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::ExposureBiasValue, In::PRIMARY) {
        info.exposure_bias = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::Flash, In::PRIMARY) {
        info.flash = Some(field.display_value().to_string().trim_matches('"').to_string());
    }
    if let Some(field) = exif.get_field(Tag::Software, In::PRIMARY) {
        info.software = Some(field.display_value().to_string().trim_matches('"').to_string());
    }

    Some(info)
}

#[tauri::command]
pub async fn read_image_meta(file_path: String) -> Result<ImageMetadataResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&file_path);
        if !path.exists() {
            return Err("文件不存在".to_string());
        }

        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        let metadata = fs::metadata(&path).map_err(|e| format!("无法读取元信息: {e}"))?;
        let size_bytes = metadata.len();
        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_uppercase();

        let (width, height) = match image::image_dimensions(&path) {
            Ok((w, h)) => (w, h),
            Err(_) => (0, 0),
        };

        let exif = extract_exif(&path);

        Ok(ImageMetadataResult {
            path: file_path,
            name,
            size_bytes,
            width,
            height,
            format: ext,
            modified_ms,
            exif,
        })
    })
    .await
    .map_err(|e| format!("读取元数据任务失败: {e}"))?
}

#[tauri::command]
pub async fn read_image_as_data_url(file_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&file_path);
        let bytes = fs::read(&path).map_err(|e| format!("读取图片文件失败: {e}"))?;
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        let mime = match ext.as_str() {
            "jpg" | "jpeg" | "jfif" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "svg" => "image/svg+xml",
            "ico" => "image/x-icon",
            "tiff" | "tif" => "image/tiff",
            "avif" => "image/avif",
            _ => "application/octet-stream",
        };
        Ok(format!("data:{};base64,{}", mime, BASE64.encode(bytes)))
    })
    .await
    .map_err(|e| format!("读取 Data URL 失败: {e}"))?
}

#[tauri::command]
pub async fn trash_image_file(file_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&file_path);
        if !path.exists() {
            return Err("文件不存在".to_string());
        }
        trash::delete(&path).map_err(|e| format!("移入回收站失败: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("删除任务失败: {e}"))?
}

#[tauri::command]
pub async fn copy_image_to_clipboard(file_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&file_path);
        if !path.exists() {
            return Err("文件不存在".to_string());
        }

        let img = image::open(&path).map_err(|e| format!("解码图片失败: {e}"))?;
        let rgba = img.to_rgba8();
        let (width, height) = rgba.dimensions();

        let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("无法访问剪贴板: {e}"))?;
        clipboard
            .set_image(arboard::ImageData {
                width: width as usize,
                height: height as usize,
                bytes: std::borrow::Cow::Borrowed(&rgba),
            })
            .map_err(|e| format!("拷贝到剪贴板失败: {e}"))?;

        Ok(())
    })
    .await
    .map_err(|e| format!("剪贴板操作失败: {e}"))?
}

#[tauri::command]
pub async fn open_image_dialog() -> Result<Option<String>, String> {
    let dialog = rfd::AsyncFileDialog::new()
        .set_title("选择要打开的图片")
        .add_filter("图片文件", SUPPORTED_EXTENSIONS);

    let file = dialog.pick_file().await;
    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn save_image_as_dialog(source_path: String, suggested_name: Option<String>) -> Result<Option<String>, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("源图片不存在".to_string());
    }

    let default_name = suggested_name.unwrap_or_else(|| {
        source.file_name().and_then(|n| n.to_str()).unwrap_or("image.png").to_string()
    });

    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");

    let dialog = rfd::AsyncFileDialog::new()
        .set_title("另存为图片")
        .set_file_name(&default_name)
        .add_filter("图片文件", &[ext]);

    if let Some(dest) = dialog.save_file().await {
        let dest_path = dest.path();
        fs::copy(&source, dest_path).map_err(|e| format!("保存文件失败: {e}"))?;
        Ok(Some(dest_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("文件或路径不存在".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg("-R")
            .arg(target)
            .status()
            .map_err(|e| format!("在访达中显示失败: {e}"))?;
        if !status.success() {
            return Err("打开访达失败".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("explorer")
            .arg(format!("/select,\"{}\"", target.to_string_lossy()))
            .status()
            .map_err(|e| format!("在资源管理器中显示失败: {e}"))?;
        if !status.success() {
            return Err("打开资源管理器失败".to_string());
        }
    }

    #[cfg(target_os = "linux")]
    {
        let parent = target.parent().unwrap_or(target);
        let status = Command::new("xdg-open")
            .arg(parent)
            .status()
            .map_err(|e| format!("打开文件管理器失败: {e}"))?;
        if !status.success() {
            return Err("打开文件管理器失败".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
pub fn toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())?;
    Ok(!is_fullscreen)
}

#[tauri::command]
pub fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_maximize_window(window: tauri::Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cli_target() -> Option<String> {
    std::env::args().skip(1).find(|arg| {
        let p = Path::new(arg);
        p.exists() && (p.is_file() || p.is_dir())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_natural_cmp() {
        let mut list = vec!["img10.png", "img1.png", "img2.png", "IMG100.png", "img20.png"];
        list.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(list, vec!["img1.png", "img2.png", "img10.png", "img20.png", "IMG100.png"]);
    }

    #[test]
    fn test_supported_images() {
        assert!(is_supported_image("test.jpg"));
        assert!(is_supported_image("test.PNG"));
        assert!(is_supported_image("test.webp"));
        assert!(is_supported_image("test.gif"));
        assert!(is_supported_image("test.bmp"));
        assert!(is_supported_image("test.svg"));
        assert!(is_supported_image("test.avif"));
        assert!(!is_supported_image("test.exe"));
        assert!(!is_supported_image("test.txt"));
    }
}
