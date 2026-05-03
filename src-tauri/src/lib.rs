mod app_state;
mod commands;
mod error;
mod history;
mod models;
mod paste;
mod system;

use app_state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState::default())
        .setup(system::setup_app)
        .invoke_handler(tauri::generate_handler![
            commands::capture_text,
            commands::capture_image,
            commands::capture_files,
            commands::clear_history,
            commands::copy_clip,
            commands::delete_clip,
            commands::get_settings,
            commands::hide_panel,
            commands::list_clips,
            commands::paste_clip,
            commands::permanently_delete_clip,
            commands::purge_trash,
            commands::restore_clip,
            commands::show_panel,
            commands::toggle_favorite,
            commands::update_clip_text,
            commands::update_settings
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ClipFlow");
}
