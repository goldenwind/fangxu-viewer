mod update;
mod viewer;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;

fn build_localized_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_submenu = SubmenuBuilder::new(app, "方序看图")
        .item(&PredefinedMenuItem::about(app, Some("关于 方序看图"), None)?)
        .separator()
        .item(&MenuItemBuilder::with_id("settings", "偏好设置...")
            .accelerator("CmdOrCtrl+,")
            .build(app)?)
        .separator()
        .item(&PredefinedMenuItem::services(app, Some("服务"))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("隐藏 方序看图"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("显示全部"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("退出 方序看图"))?)
        .build()?;

    let file_submenu = SubmenuBuilder::new(app, "文件")
        .item(&MenuItemBuilder::with_id("open", "打开图片...")
            .accelerator("CmdOrCtrl+O")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("save_as", "图片另存为...")
            .accelerator("CmdOrCtrl+S")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("reveal", "在访达中定位")
            .accelerator("CmdOrCtrl+R")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("trash", "移入废纸篓")
            .accelerator("Backspace")
            .build(app)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, Some("关闭窗口"))?)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "编辑")
        .item(&MenuItemBuilder::with_id("copy", "复制图片数据")
            .accelerator("CmdOrCtrl+C")
            .build(app)?)
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, "查看")
        .item(&MenuItemBuilder::with_id("prev", "上一张图片")
            .accelerator("Left")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("next", "下一张图片")
            .accelerator("Right")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("actual_size", "实际大小 (1:1)")
            .accelerator("1")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("fit_window", "适应窗口")
            .accelerator("0")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("zoom_in", "放大")
            .accelerator("CmdOrCtrl+=")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("zoom_out", "缩小")
            .accelerator("CmdOrCtrl+-")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("rotate_left", "逆时针旋转 90°")
            .accelerator("L")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("rotate_right", "顺时针旋转 90°")
            .accelerator("R")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("flip_h", "水平翻转")
            .accelerator("H")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle_filmstrip", "底部缩略图胶片栏")
            .accelerator("T")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("toggle_exif", "图片信息与 EXIF")
            .accelerator("I")
            .build(app)?)
        .item(&MenuItemBuilder::with_id("slideshow", "全屏幻灯片放映")
            .accelerator("F5")
            .build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("fullscreen", "切换全屏模式")
            .accelerator("F11")
            .build(app)?)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "窗口")
        .item(&PredefinedMenuItem::minimize(app, Some("最小化"))?)
        .item(&MenuItemBuilder::with_id("maximize", "最大化 / 还原窗口")
            .build(app)?)
        .separator()
        .item(&PredefinedMenuItem::bring_all_to_front(app, Some("前置全部窗口"))?)
        .build()?;

    let help_submenu = SubmenuBuilder::new(app, "帮助")
        .item(&MenuItemBuilder::with_id("help", "快捷键指南")
            .accelerator("CmdOrCtrl+/")
            .build(app)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
            &help_submenu,
        ])
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(update::UpdateClient::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            let _ = build_localized_menu(app);
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            let _ = app.emit("menu-action", id);
        })
        .invoke_handler(tauri::generate_handler![
            update::product_update_check,
            update::product_update_download,
            viewer::scan_folder_images,
            viewer::read_image_meta,
            viewer::read_image_as_data_url,
            viewer::trash_image_file,
            viewer::copy_image_to_clipboard,
            viewer::open_image_dialog,
            viewer::save_image_as_dialog,
            viewer::reveal_in_file_manager,
            viewer::toggle_fullscreen,
            viewer::minimize_window,
            viewer::toggle_maximize_window,
            viewer::close_window,
            viewer::get_cli_target,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Fangxu viewer");
}
