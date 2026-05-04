use crate::app_state::AppState;
use crate::error::{ClipflowError, CommandError};
use crate::models::{ClipFilter, ClipItem, Settings, SettingsPatch};
use crate::paste;
use crate::system;
use arboard::ImageData;
use std::{borrow::Cow, path::PathBuf};
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub fn capture_text(
    app: AppHandle,
    state: State<'_, AppState>,
    text: String,
) -> Result<Option<ClipItem>, CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    let item = store
        .add_text_with_source(&text, system::detect_source_app())
        .map_err(CommandError::from)?;
    if item.is_some() {
        let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    }

    Ok(item)
}

#[tauri::command]
pub fn capture_image(
    app: AppHandle,
    state: State<'_, AppState>,
    width: u32,
    height: u32,
    bytes: Vec<u8>,
) -> Result<Option<ClipItem>, CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    let item = store
        .add_image_with_source(width, height, bytes, system::detect_source_app())
        .map_err(CommandError::from)?;
    if item.is_some() {
        let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    }

    Ok(item)
}

#[tauri::command]
pub fn capture_files(
    app: AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<Option<ClipItem>, CommandError> {
    let paths = paths.into_iter().map(PathBuf::from).collect::<Vec<_>>();
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    let item = store
        .add_files_with_source(&paths, system::detect_source_app())
        .map_err(CommandError::from)?;
    if item.is_some() {
        let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    }

    Ok(item)
}

#[tauri::command]
pub fn list_clips(
    state: State<'_, AppState>,
    query: Option<String>,
    filter: Option<ClipFilter>,
) -> Result<Vec<ClipItem>, CommandError> {
    let store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    store
        .list(query.as_deref(), filter.unwrap_or_default())
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn paste_clip(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<ClipItem, CommandError> {
    let item = {
        let mut store = state
            .store
            .lock()
            .map_err(|_| ClipflowError::StatePoisoned)?;
        store.mark_used(&id).map_err(CommandError::from)?
    };
    write_clipboard_item(&item).map_err(CommandError::from)?;
    system::remember_app_clipboard_write(&item);
    system::prepare_paste_target(&app);
    paste::send_ctrl_v().map_err(CommandError::from)?;
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());

    Ok(item)
}

#[tauri::command]
pub fn copy_clip(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<ClipItem, CommandError> {
    let item = {
        let mut store = state
            .store
            .lock()
            .map_err(|_| ClipflowError::StatePoisoned)?;
        store.mark_used(&id).map_err(CommandError::from)?
    };
    write_clipboard_item(&item).map_err(CommandError::from)?;
    system::remember_app_clipboard_write(&item);
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    Ok(item)
}

#[tauri::command]
pub fn delete_clip(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    store.delete(&id).map_err(CommandError::from)?;
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_clip(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    store.permanently_delete(&id).map_err(CommandError::from)?;
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    Ok(())
}

#[tauri::command]
pub fn restore_clip(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<ClipItem, CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    let item = store.restore(&id).map_err(CommandError::from)?;
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    Ok(item)
}

#[tauri::command]
pub fn update_clip_text(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    text: String,
) -> Result<ClipItem, CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    let item = store.update_text(&id, &text).map_err(CommandError::from)?;
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    Ok(item)
}

#[tauri::command]
pub fn toggle_favorite(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<ClipItem, CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    let item = store.toggle_favorite(&id).map_err(CommandError::from)?;
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    Ok(item)
}

#[tauri::command]
pub fn clear_history(app: AppHandle, state: State<'_, AppState>) -> Result<(), CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    store.clear().map_err(CommandError::from)?;
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    Ok(())
}

#[tauri::command]
pub fn purge_trash(app: AppHandle, state: State<'_, AppState>) -> Result<(), CommandError> {
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    store.purge_trash().map_err(CommandError::from)?;
    let _ = app.emit(system::CLIPS_CHANGED_EVENT, ());
    Ok(())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, CommandError> {
    let store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    store.settings().map_err(CommandError::from)
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    patch: SettingsPatch,
) -> Result<Settings, CommandError> {
    let requested_panel_hotkey = patch
        .shortcuts
        .as_ref()
        .and_then(|shortcuts| shortcuts.show_panel.as_ref())
        .or(patch.hotkey.as_ref())
        .cloned();
    let updates_panel_pin = patch.panel_pinned.is_some();
    let updates_launch_on_startup = patch.launch_on_startup.is_some();
    let updates_tray_icon = patch.show_tray_icon.is_some();
    let updates_taskbar_icon = patch.show_taskbar_icon.is_some();
    let previous_panel_hotkey = if requested_panel_hotkey.is_some() {
        let store = state
            .store
            .lock()
            .map_err(|_| ClipflowError::StatePoisoned)?;
        Some(
            store
                .settings()
                .map_err(CommandError::from)?
                .shortcuts
                .show_panel,
        )
    } else {
        None
    };
    if let Some(shortcut) = requested_panel_hotkey.as_ref() {
        if let Err(error) = system::register_panel_hotkey(&app, shortcut) {
            if let Some(previous) = previous_panel_hotkey.as_ref() {
                let _ = system::register_panel_hotkey(&app, previous);
            }
            return Err(CommandError::from(error));
        }
    }
    let mut store = state
        .store
        .lock()
        .map_err(|_| ClipflowError::StatePoisoned)?;
    let settings = match store.update_settings(patch) {
        Ok(settings) => settings,
        Err(error) => {
            drop(store);
            if let Some(previous) = previous_panel_hotkey.as_ref() {
                let _ = system::register_panel_hotkey(&app, previous);
            }
            return Err(CommandError::from(error));
        }
    };
    drop(store);
    if updates_panel_pin {
        system::apply_panel_pinned(&app, settings.panel_pinned);
    }
    if updates_launch_on_startup {
        system::apply_launch_on_startup(settings.launch_on_startup).map_err(CommandError::from)?;
    }
    if updates_tray_icon {
        system::apply_tray_icon_visibility(&app, settings.show_tray_icon);
    }
    if updates_taskbar_icon {
        system::apply_taskbar_icon_visibility(&app, settings.show_taskbar_icon);
    }
    let _ = app.emit(system::SETTINGS_CHANGED_EVENT, settings.clone());
    Ok(settings)
}

#[tauri::command]
pub fn show_panel(app: AppHandle) -> Result<(), CommandError> {
    system::show_panel(&app);
    Ok(())
}

#[tauri::command]
pub fn hide_panel(app: AppHandle) -> Result<(), CommandError> {
    system::hide_panel(&app);
    Ok(())
}

fn write_clipboard_item(item: &ClipItem) -> Result<(), ClipflowError> {
    let mut clipboard = arboard::Clipboard::new()?;
    match item.kind {
        crate::models::ClipKind::Image => {
            if let (Some(width), Some(height), Some(bytes)) = (
                item.image_width,
                item.image_height,
                item.image_bytes.clone(),
            ) {
                clipboard.set_image(ImageData {
                    width: width as usize,
                    height: height as usize,
                    bytes: Cow::Owned(bytes),
                })?;
            } else {
                clipboard.set_text(item.text.clone())?;
            }
        }
        crate::models::ClipKind::File => {
            let paths = item
                .file_paths
                .iter()
                .map(PathBuf::from)
                .collect::<Vec<_>>();
            if paths.is_empty() {
                clipboard.set_text(item.text.clone())?;
            } else {
                clipboard.set().file_list(&paths)?;
            }
        }
        crate::models::ClipKind::RichText => {
            if let Some(html) = item.rich_html.as_deref() {
                clipboard.set_html(html.to_string(), Some(item.text.clone()))?;
            } else {
                clipboard.set_text(item.text.clone())?;
            }
        }
        _ => clipboard.set_text(item.text.clone())?,
    }
    Ok(())
}
