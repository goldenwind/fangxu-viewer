use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use exif::{In, Reader as ExifReader, Tag};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::Emitter;
#[cfg(not(target_os = "macos"))]
use tauri::{PhysicalPosition, PhysicalSize};

#[cfg(not(target_os = "macos"))]
static PRE_MAX_BOUNDS: Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>> = Mutex::new(None);

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "jpe", "jfif", "png", "apng", "gif", "webp", "bmp", "dib",
    "svg", "svgz", "ico", "cur", "tiff", "tif", "avif", "heic", "heif",
    "tga", "icb", "vda", "vst", "dds", "hdr",
    "pnm", "pbm", "pgm", "ppm", "pam", "qoi", "exr", "ff"
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

fn collect_images_recursively(dir: &Path, entries: &mut Vec<ImageItem>, recursive: bool) {
    if let Ok(read_dir) = fs::read_dir(dir) {
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
            } else if recursive && path.is_dir() {
                if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                    if !dir_name.starts_with('.') {
                        collect_images_recursively(&path, entries, true);
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub async fn scan_folder_images(
    target_path: String,
    recursive: Option<bool>,
) -> Result<FolderScanResult, String> {
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

        let is_recursive = recursive.unwrap_or(false);
        let mut entries = Vec::new();
        collect_images_recursively(&dir_path, &mut entries, is_recursive);

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

        let is_browser_native = matches!(
            ext.as_str(),
            "jpg" | "jpeg" | "jpe" | "jfif" | "png" | "apng" | "gif" | "webp" | "svg" | "svgz" | "bmp" | "dib" | "ico" | "cur" | "avif" | "heic" | "heif"
        );

        if is_browser_native {
            let mime = match ext.as_str() {
                "jpg" | "jpeg" | "jpe" | "jfif" => "image/jpeg",
                "png" | "apng" => "image/png",
                "gif" => "image/gif",
                "webp" => "image/webp",
                "bmp" | "dib" => "image/bmp",
                "svg" | "svgz" => "image/svg+xml",
                "ico" | "cur" => "image/x-icon",
                "avif" => "image/avif",
                "heic" => "image/heic",
                "heif" => "image/heif",
                _ => "application/octet-stream",
            };
            return Ok(format!("data:{};base64,{}", mime, BASE64.encode(bytes)));
        }

        // For non-browser native formats (tga, dds, hdr, pnm, qoi, exr, ff, tiff on non-mac, etc.),
        // decode using the image crate and encode into PNG data URL so WebView can seamlessly display it.
        if let Ok(img) = image::open(&path) {
            let mut buf = std::io::Cursor::new(Vec::new());
            if img.write_to(&mut buf, image::ImageFormat::Png).is_ok() {
                return Ok(format!("data:image/png;base64,{}", BASE64.encode(buf.into_inner())));
            }
        }

        if ext == "tiff" || ext == "tif" {
            return Ok(format!("data:image/tiff;base64,{}", BASE64.encode(bytes)));
        }

        Ok(format!("data:application/octet-stream;base64,{}", BASE64.encode(bytes)))
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertImageResult {
    pub output_path: String,
    pub output_name: String,
    pub dest_path: String,
    pub dest_name: String,
}

#[tauri::command]
pub async fn convert_image_with_system(
    source_path: String,
    target_format: String,
    size_preset: String,
    preserve_metadata: bool,
) -> Result<ConvertImageResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = PathBuf::from(&source_path);
        if !source.exists() {
            return Err("源图片不存在".to_string());
        }

        #[cfg(target_os = "macos")]
        {
            let parent = source.parent().ok_or_else(|| "无法获取上级目录".to_string())?;
            let stem = source.file_stem().and_then(|s| s.to_str()).unwrap_or("image");

            let ext = match target_format.to_ascii_lowercase().as_str() {
                "png" => "png",
                "heif" | "heic" => "heic",
                _ => "jpeg",
            };

            let mut dest = parent.join(format!("{}.{}", stem, ext));
            if dest.exists() {
                let mut counter = 1;
                loop {
                    let candidate = parent.join(format!("{} {}.{}", stem, counter, ext));
                    if !candidate.exists() {
                        dest = candidate;
                        break;
                    }
                    counter += 1;
                }
            }

            let mut cmd = Command::new("/usr/bin/sips");
            let sips_format = match ext {
                "png" => "png",
                "heic" => "heic",
                _ => "jpeg",
            };
            cmd.arg("-s").arg("format").arg(sips_format);
            cmd.arg("-s").arg("formatOptions").arg("best");

            match size_preset.to_ascii_lowercase().as_str() {
                "small" | "小" => {
                    cmd.arg("-Z").arg("640");
                }
                "medium" | "中" => {
                    cmd.arg("-Z").arg("1280");
                }
                "large" | "大" => {
                    cmd.arg("-Z").arg("1920");
                }
                _ => {}
            }

            if !preserve_metadata {
                cmd.arg("--deleteColorManagementProperties");
            }

            cmd.arg(&source).arg("--out").arg(&dest);

            let output = cmd.output().map_err(|e| format!("执行系统转换命令失败: {e}"))?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("系统图像转换失败: {stderr}"));
            }

            let output_name = dest.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            let output_path = dest.to_string_lossy().to_string();

            Ok(ConvertImageResult {
                dest_path: output_path.clone(),
                dest_name: output_name.clone(),
                output_path,
                output_name,
            })
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (target_format, size_preset, preserve_metadata);
            Err("系统转换图像功能仅支持 macOS 平台".to_string())
        }
    })
    .await
    .map_err(|e| format!("异步执行任务失败: {e}"))?
}

#[tauri::command]
pub fn set_fullscreen_state(window: tauri::Window, fullscreen: bool) -> Result<bool, String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())?;
    Ok(fullscreen)
}

#[tauri::command]
pub fn is_fullscreen(window: tauri::Window) -> Result<bool, String> {
    window.is_fullscreen().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    let target = !is_fullscreen;
    window.set_fullscreen(target).map_err(|e| e.to_string())?;
    Ok(target)
}

#[tauri::command]
pub fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
static PRE_MAX_FRAME: Mutex<Option<objc2_foundation::NSRect>> = Mutex::new(None);

#[cfg(target_os = "macos")]
fn toggle_maximize_macos(window: &tauri::Window) -> Result<bool, String> {
    use objc2_app_kit::NSWindow;
    use objc2_foundation::{NSPoint, NSRect, NSSize};

    let ptr = window.ns_window().map_err(|e| e.to_string())? as *mut NSWindow;
    if ptr.is_null() {
        return Err("NSWindow is null".to_string());
    }
    let ns_win = unsafe { &*ptr };

    let screen = match ns_win.screen() {
        Some(s) => s,
        None => return Err("Cannot get screen".to_string()),
    };

    let vis_frame = screen.visibleFrame();
    let current_frame = ns_win.frame();

    // Check if the window is currently covering the visible work area
    let is_already_max = (current_frame.origin.x - vis_frame.origin.x).abs() < 4.0
        && (current_frame.origin.y - vis_frame.origin.y).abs() < 4.0
        && (current_frame.size.width - vis_frame.size.width).abs() < 4.0
        && (current_frame.size.height - vis_frame.size.height).abs() < 4.0;

    let mut lock = PRE_MAX_FRAME.lock().map_err(|e| e.to_string())?;

    if is_already_max {
        // Restore to previous frame or a sensible default within the visible frame
        let target_frame = if let Some(saved) = lock.take() {
            let w = saved.size.width.clamp(480.0, vis_frame.size.width);
            let h = saved.size.height.clamp(360.0, vis_frame.size.height);
            let x = saved.origin.x.clamp(
                vis_frame.origin.x,
                (vis_frame.origin.x + vis_frame.size.width - w).max(vis_frame.origin.x),
            );
            let y = saved.origin.y.clamp(
                vis_frame.origin.y,
                (vis_frame.origin.y + vis_frame.size.height - h).max(vis_frame.origin.y),
            );
            NSRect {
                origin: NSPoint { x, y },
                size: NSSize { width: w, height: h },
            }
        } else {
            let default_w = 1200.0f64.min(vis_frame.size.width - 80.0).max(640.0);
            let default_h = 800.0f64.min(vis_frame.size.height - 80.0).max(480.0);
            let x = vis_frame.origin.x + (vis_frame.size.width - default_w) / 2.0;
            let y = vis_frame.origin.y + (vis_frame.size.height - default_h) / 2.0;
            NSRect {
                origin: NSPoint { x, y },
                size: NSSize { width: default_w, height: default_h },
            }
        };

        ns_win.setFrame_display_animate(target_frame, true, true);
        Ok(false)
    } else {
        // Save current frame before maximizing
        *lock = Some(current_frame);
        ns_win.setFrame_display_animate(vis_frame, true, true);
        Ok(true)
    }
}

#[tauri::command]
pub fn toggle_maximize_window(window: tauri::Window) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    let res = toggle_maximize_macos(&window);

    #[cfg(not(target_os = "macos"))]
    let res = (|| -> Result<bool, String> {
        let mut bounds_lock = PRE_MAX_BOUNDS.lock().map_err(|e| e.to_string())?;
        if let Some((pos, size)) = bounds_lock.take() {
            let _ = window.unmaximize();
            let _ = window.set_position(pos);
            let _ = window.set_size(size);
            return Ok(false);
        }

        let is_max = window.is_maximized().unwrap_or(false);
        if is_max {
            let _ = window.unmaximize();
            return Ok(false);
        }

        let curr_pos = window.outer_position().map_err(|e| e.to_string())?;
        let curr_size = window.outer_size().map_err(|e| e.to_string())?;
        *bounds_lock = Some((curr_pos, curr_size));

        if let Ok(Some(monitor)) = window.current_monitor() {
            let mon_size = monitor.size();
            let mon_pos = monitor.position();
            let _ = window.set_position(*mon_pos);
            let _ = window.set_size(*mon_size);
        } else {
            let _ = window.maximize();
        }
        Ok(true)
    })();

    if let Ok(is_max) = res {
        let _ = window.emit("window-maximize-change", is_max);
    }
    res
}

#[tauri::command]
pub fn maximize_window_initial(window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSWindow;
        let ptr = window.ns_window().map_err(|e| e.to_string())? as *mut NSWindow;
        if !ptr.is_null() {
            let ns_win = unsafe { &*ptr };
            if let Some(screen) = ns_win.screen() {
                let vis_frame = screen.visibleFrame();
                let mut lock = PRE_MAX_FRAME.lock().map_err(|e| e.to_string())?;
                if lock.is_none() {
                    *lock = Some(ns_win.frame());
                }
                ns_win.setFrame_display_animate(vis_frame, true, false);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.maximize();
    }
    let _ = window.emit("window-maximize-change", true);
    Ok(())
}

#[tauri::command]
pub fn is_window_maximized(window: tauri::Window) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = &window;
        let lock = PRE_MAX_FRAME.lock().map_err(|e| e.to_string())?;
        Ok(lock.is_some())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let is_max = window.is_maximized().unwrap_or(false);
        let bounds_lock = PRE_MAX_BOUNDS.lock().map_err(|e| e.to_string())?;
        Ok(is_max || bounds_lock.is_some())
    }
}

#[tauri::command]
pub fn close_window(window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSWindow;
        if let Ok(ptr) = window.ns_window() {
            let ptr = ptr as *mut NSWindow;
            if !ptr.is_null() {
                let ns_win = unsafe { &*ptr };
                ns_win.close();
                return Ok(());
            }
        }
    }
    window.destroy().map_err(|e| e.to_string())
}

static PENDING_TARGET: Mutex<Option<String>> = Mutex::new(None);

pub fn set_pending_target(path: String) {
    if let Ok(mut lock) = PENDING_TARGET.lock() {
        *lock = Some(path);
    }
}

pub fn get_pending_target() -> Option<String> {
    if let Ok(mut lock) = PENDING_TARGET.lock() {
        lock.take()
    } else {
        None
    }
}

#[tauri::command]
pub fn get_cli_target() -> Option<String> {
    // 1. Check if there is a pending target from RunEvent::Opened (macOS file association)
    if let Some(target) = get_pending_target() {
        return Some(target);
    }

    // 2. Check command line arguments (Windows / CLI)
    std::env::args().skip(1).find(|arg| {
        let p = Path::new(arg);
        p.exists() && (p.is_file() || p.is_dir())
    })
}

#[cfg(target_os = "macos")]
mod macos_ls {
    use std::ffi::c_void;

    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        pub fn LSSetDefaultRoleHandlerForContentType(
            inContentType: *const c_void,
            inRole: u32,
            inHandlerBundleID: *const c_void,
        ) -> i32;

        pub fn UTTypeCreatePreferredIdentifierForTag(
            inTagClass: *const c_void,
            inTag: *const c_void,
            inConformingToUTI: *const c_void,
        ) -> *const c_void;

        pub static kUTTagClassFilenameExtension: *const c_void;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        pub fn CFRelease(cf: *const c_void);
    }
}

#[cfg(target_os = "macos")]
fn set_macos_default_handler_for_ext(ext: &str, bundle_id: &str) -> Result<(), String> {
    use objc2_foundation::NSString;
    use std::ffi::c_void;

    let ns_ext = NSString::from_str(ext);
    let ns_bundle = NSString::from_str(bundle_id);

    unsafe {
        let cf_ext = (&*ns_ext as *const NSString).cast::<c_void>();
        let cf_bundle = (&*ns_bundle as *const NSString).cast::<c_void>();

        let uti = macos_ls::UTTypeCreatePreferredIdentifierForTag(
            macos_ls::kUTTagClassFilenameExtension,
            cf_ext,
            std::ptr::null(),
        );

        if !uti.is_null() {
            let status = macos_ls::LSSetDefaultRoleHandlerForContentType(uti, 0xFFFFFFFF, cf_bundle);
            macos_ls::CFRelease(uti);
            if status != 0 {
                return Err(format!("LSSetDefaultRoleHandlerForContentType failed with code {status}"));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn apply_file_associations(extensions: Vec<String>) -> Result<usize, String> {
    let count = extensions.len();

    #[cfg(target_os = "macos")]
    {
        // 1. If running as a .app bundle, register with LaunchServices lsregister
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(app_bundle) = exe_path.ancestors().find(|a| a.extension().map_or(false, |e| e == "app")) {
                let lsregister_bin = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
                if Path::new(lsregister_bin).exists() {
                    let _ = Command::new(lsregister_bin)
                        .arg("-f")
                        .arg(app_bundle)
                        .output();
                }
            }
        }

        // 2. Set default role handler for each extension
        for ext in &extensions {
            let _ = set_macos_default_handler_for_ext(ext, "com.fangxu.viewer");
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            let exe_str = exe_path.to_string_lossy().to_string();
            let prog_id = "FangxuViewer.Image";

            // Configure ProgID open command
            let open_cmd = format!(r#""{}" "%1""#, exe_str);
            let _ = Command::new("reg")
                .args(&["add", &format!(r"HKCU\Software\Classes\{}\shell\open\command", prog_id), "/ve", "/d", &open_cmd, "/f"])
                .output();

            for ext in &extensions {
                let dot_ext = if ext.starts_with('.') { ext.clone() } else { format!(".{}", ext) };
                let _ = Command::new("reg")
                    .args(&["add", &format!(r"HKCU\Software\Classes\{}", dot_ext), "/ve", "/d", prog_id, "/f"])
                    .output();
            }
        }
    }

    Ok(count)
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

    #[test]
    fn test_collect_images_recursively() {
        let temp_dir = std::env::temp_dir().join(format!("test_fx_viewer_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let sub_dir = temp_dir.join("subdir");
        fs::create_dir_all(&sub_dir).unwrap();

        fs::write(temp_dir.join("root.jpg"), b"fake_jpg").unwrap();
        fs::write(sub_dir.join("sub.png"), b"fake_png").unwrap();

        let mut non_rec_entries = Vec::new();
        collect_images_recursively(&temp_dir, &mut non_rec_entries, false);
        assert_eq!(non_rec_entries.len(), 1);
        assert_eq!(non_rec_entries[0].name, "root.jpg");

        let mut rec_entries = Vec::new();
        collect_images_recursively(&temp_dir, &mut rec_entries, true);
        assert_eq!(rec_entries.len(), 2);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
