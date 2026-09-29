mod membership;
mod update;
mod viewer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(membership::MembershipClient::default())
        .manage(update::UpdateClient::default())
        .invoke_handler(tauri::generate_handler![
            membership::membership_challenge,
            membership::membership_login_status,
            membership::membership_validate_account,
            membership::membership_plans,
            membership::membership_status,
            membership::membership_redeem_code,
            membership::membership_create_order,
            membership::membership_order,
            membership::load_membership_account,
            membership::save_membership_account,
            membership::clear_membership_account,
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
