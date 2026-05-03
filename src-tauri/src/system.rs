use crate::app_state::AppState;
use crate::error::ClipflowError;
use crate::models::{Settings, SettingsPatch, SourceAppInfo, WindowPositionMode};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::{error::Error, thread, time::Duration};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(target_os = "windows")]
use windows::core::{PCWSTR, PWSTR};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::CloseHandle;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
#[cfg(target_os = "windows")]
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegSetValueExW, HKEY, HKEY_CURRENT_USER,
    KEY_SET_VALUE, REG_OPTION_NON_VOLATILE, REG_SZ,
};
#[cfg(target_os = "windows")]
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

pub const CLIPS_CHANGED_EVENT: &str = "clips-changed";
pub const PANEL_SHOWN_EVENT: &str = "panel-shown";
pub const SETTINGS_CHANGED_EVENT: &str = "settings-changed";

pub fn setup_app(app: &mut App) -> Result<(), Box<dyn Error>> {
    setup_tray(app)?;
    register_stored_panel_hotkey(app.handle());
    apply_stored_panel_pin(app.handle());
    apply_stored_launch_on_startup(app.handle());
    start_clipboard_watcher(app.handle().clone());
    start_edge_auto_hide_watcher(app.handle().clone());
    show_panel(app.handle());
    Ok(())
}

pub fn show_panel<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let settings = read_settings(app);
        let _ = window.show();
        let _ = window.unminimize();
        if let Some(settings) = settings.as_ref() {
            let _ = window.set_always_on_top(settings.panel_pinned);
        }
        position_panel(app, &window, settings.as_ref());
        let _ = window.set_focus();
        let _ = app.emit(PANEL_SHOWN_EVENT, ());
    }
}

pub fn apply_panel_pinned<R: Runtime>(app: &AppHandle<R>, pinned: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(pinned);
    }
}

pub fn apply_launch_on_startup(enabled: bool) -> Result<(), ClipflowError> {
    apply_launch_on_startup_platform(enabled)
}

pub fn hide_panel<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub fn register_panel_hotkey<R: Runtime>(
    app: &AppHandle<R>,
    value: &str,
) -> Result<(), ClipflowError> {
    let shortcut = parse_shortcut(value)?;
    let registry = app.global_shortcut();
    registry
        .unregister_all()
        .map_err(to_shortcut_registration_error)?;
    registry
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                show_panel(app);
            }
        })
        .map_err(to_shortcut_registration_error)
}

fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "打开 ClipFlow", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "toggle_capture", "暂停/继续记录", true, None::<&str>)?;
    let clear = MenuItem::with_id(app, "clear_history", "清空历史", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &pause, &clear, &separator, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("ClipFlow")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_panel(app),
            "toggle_capture" => toggle_capture(app),
            "clear_history" => clear_history(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_panel(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn register_stored_panel_hotkey<R: Runtime>(app: &AppHandle<R>) {
    let Some(settings) = read_settings(app) else {
        return;
    };
    let _ = register_panel_hotkey(app, &settings.shortcuts.show_panel);
}

fn apply_stored_panel_pin<R: Runtime>(app: &AppHandle<R>) {
    let Some(settings) = read_settings(app) else {
        return;
    };
    apply_panel_pinned(app, settings.panel_pinned);
}

fn apply_stored_launch_on_startup<R: Runtime>(app: &AppHandle<R>) {
    let Some(settings) = read_settings(app) else {
        return;
    };
    let _ = apply_launch_on_startup(settings.launch_on_startup);
}

#[cfg(target_os = "windows")]
fn apply_launch_on_startup_platform(enabled: bool) -> Result<(), ClipflowError> {
    const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const VALUE_NAME: &str = "ClipFlow";

    let subkey = wide_null(RUN_KEY);
    let value_name = wide_null(VALUE_NAME);
    let mut key = HKEY::default();
    let open_result = unsafe {
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            0,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            None,
            &mut key,
            None,
        )
    };
    if open_result != ERROR_SUCCESS {
        return Err(ClipflowError::StartupSettingFailed(format!(
            "cannot open Run key: {}",
            open_result.0
        )));
    }

    let result = if enabled {
        let command = startup_command()?;
        let data = wide_bytes(&command);
        unsafe { RegSetValueExW(key, PCWSTR(value_name.as_ptr()), 0, REG_SZ, Some(&data)) }
    } else {
        let delete_result = unsafe { RegDeleteValueW(key, PCWSTR(value_name.as_ptr())) };
        if delete_result == ERROR_FILE_NOT_FOUND {
            ERROR_SUCCESS
        } else {
            delete_result
        }
    };

    let _ = unsafe { RegCloseKey(key) };
    if result != ERROR_SUCCESS {
        return Err(ClipflowError::StartupSettingFailed(format!(
            "cannot update Run value: {}",
            result.0
        )));
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn apply_launch_on_startup_platform(_enabled: bool) -> Result<(), ClipflowError> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn startup_command() -> Result<String, ClipflowError> {
    let executable = std::env::current_exe()?;
    Ok(format!("\"{}\"", executable.display()))
}

#[cfg(target_os = "windows")]
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
fn wide_bytes(value: &str) -> Vec<u8> {
    wide_null(value)
        .into_iter()
        .flat_map(u16::to_le_bytes)
        .collect()
}

fn read_settings<R: Runtime>(app: &AppHandle<R>) -> Option<Settings> {
    let state = app.state::<AppState>();
    let store = state.store.lock().ok()?;
    store.settings().ok()
}

fn position_panel<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    settings: Option<&Settings>,
) {
    match settings.map(|settings| settings.window_position) {
        Some(WindowPositionMode::FollowMouse) => move_panel_to_cursor(app, window),
        Some(WindowPositionMode::ScreenCenter) => {
            let _ = window.center();
        }
        _ => {}
    }
}

fn move_panel_to_cursor<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let Ok(cursor) = window.cursor_position() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let x = cursor.x.round() as i32 - size.width as i32 / 2;
    let y = cursor.y.round() as i32 + 12;
    let (x, y) = clamp_to_cursor_monitor(app, cursor.x, cursor.y, x, y, size.width, size.height);
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn clamp_to_cursor_monitor<R: Runtime>(
    app: &AppHandle<R>,
    cursor_x: f64,
    cursor_y: f64,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> (i32, i32) {
    let Ok(Some(monitor)) = app.monitor_from_point(cursor_x, cursor_y) else {
        return (x, y);
    };
    let area = monitor.work_area();
    let max_x = area.position.x + area.size.width as i32 - width as i32;
    let max_y = area.position.y + area.size.height as i32 - height as i32;
    (
        x.clamp(area.position.x, max_x.max(area.position.x)),
        y.clamp(area.position.y, max_y.max(area.position.y)),
    )
}

#[derive(Clone, Copy)]
enum SnapEdge {
    Left,
    Right,
    Top,
    Bottom,
}

#[derive(Clone, Copy)]
struct HiddenEdgeState {
    edge: SnapEdge,
    visible_x: i32,
    visible_y: i32,
    monitor_x: i32,
    monitor_y: i32,
    monitor_width: u32,
    monitor_height: u32,
}

fn start_edge_auto_hide_watcher<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        let mut hidden_state: Option<HiddenEdgeState> = None;

        loop {
            if let Some(window) = app.get_webview_window("main") {
                let settings = read_settings(&app);
                let enabled = settings
                    .as_ref()
                    .map(|settings| settings.edge_auto_hide)
                    .unwrap_or(false);

                if !enabled {
                    restore_hidden_edge(&window, &mut hidden_state);
                    thread::sleep(Duration::from_millis(320));
                    continue;
                }

                if matches!(window.is_visible(), Ok(true)) {
                    tick_edge_auto_hide(&app, &window, &mut hidden_state);
                }
            }

            thread::sleep(Duration::from_millis(320));
        }
    });
}

fn tick_edge_auto_hide<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    hidden_state: &mut Option<HiddenEdgeState>,
) {
    if let Some(state) = hidden_state.as_ref().copied() {
        if cursor_near_hidden_edge(window, state) {
            let _ = window.set_position(PhysicalPosition::new(state.visible_x, state.visible_y));
            *hidden_state = None;
        }
        return;
    }

    let Some((edge, state)) = detect_snap_edge(app, window) else {
        return;
    };

    if cursor_inside_window(window) {
        return;
    }

    let Ok(size) = window.outer_size() else {
        return;
    };
    let hidden_position = match edge {
        SnapEdge::Left => {
            PhysicalPosition::new(state.monitor_x - size.width as i32 + 8, state.visible_y)
        }
        SnapEdge::Right => PhysicalPosition::new(
            state.monitor_x + state.monitor_width as i32 - 8,
            state.visible_y,
        ),
        SnapEdge::Top => {
            PhysicalPosition::new(state.visible_x, state.monitor_y - size.height as i32 + 8)
        }
        SnapEdge::Bottom => PhysicalPosition::new(
            state.visible_x,
            state.monitor_y + state.monitor_height as i32 - 8,
        ),
    };

    let _ = window.set_position(hidden_position);
    *hidden_state = Some(state);
}

fn restore_hidden_edge<R: Runtime>(
    window: &WebviewWindow<R>,
    hidden_state: &mut Option<HiddenEdgeState>,
) {
    if let Some(state) = hidden_state.take() {
        let _ = window.set_position(PhysicalPosition::new(state.visible_x, state.visible_y));
    }
}

fn detect_snap_edge<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) -> Option<(SnapEdge, HiddenEdgeState)> {
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    let center_x = f64::from(position.x) + f64::from(size.width) / 2.0;
    let center_y = f64::from(position.y) + f64::from(size.height) / 2.0;
    let monitor = app.monitor_from_point(center_x, center_y).ok()??;
    let area = monitor.work_area();
    let threshold = 12;
    let right = area.position.x + area.size.width as i32;
    let bottom = area.position.y + area.size.height as i32;
    let edge = if position.x <= area.position.x + threshold {
        SnapEdge::Left
    } else if position.x + size.width as i32 >= right - threshold {
        SnapEdge::Right
    } else if position.y <= area.position.y + threshold {
        SnapEdge::Top
    } else if position.y + size.height as i32 >= bottom - threshold {
        SnapEdge::Bottom
    } else {
        return None;
    };

    Some((
        edge,
        HiddenEdgeState {
            edge,
            visible_x: position.x,
            visible_y: position.y,
            monitor_x: area.position.x,
            monitor_y: area.position.y,
            monitor_width: area.size.width,
            monitor_height: area.size.height,
        },
    ))
}

fn cursor_inside_window<R: Runtime>(window: &WebviewWindow<R>) -> bool {
    let Ok(cursor) = window.cursor_position() else {
        return false;
    };
    let Ok(position) = window.outer_position() else {
        return false;
    };
    let Ok(size) = window.outer_size() else {
        return false;
    };

    let x = cursor.x.round() as i32;
    let y = cursor.y.round() as i32;
    x >= position.x
        && x <= position.x + size.width as i32
        && y >= position.y
        && y <= position.y + size.height as i32
}

fn cursor_near_hidden_edge<R: Runtime>(window: &WebviewWindow<R>, state: HiddenEdgeState) -> bool {
    let Ok(cursor) = window.cursor_position() else {
        return false;
    };
    let x = cursor.x.round() as i32;
    let y = cursor.y.round() as i32;
    let right = state.monitor_x + state.monitor_width as i32;
    let bottom = state.monitor_y + state.monitor_height as i32;

    match state.edge {
        SnapEdge::Left => x <= state.monitor_x + 12 && y >= state.monitor_y && y <= bottom,
        SnapEdge::Right => x >= right - 12 && y >= state.monitor_y && y <= bottom,
        SnapEdge::Top => y <= state.monitor_y + 12 && x >= state.monitor_x && x <= right,
        SnapEdge::Bottom => y >= bottom - 12 && x >= state.monitor_x && x <= right,
    }
}

fn start_clipboard_watcher<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        let mut last_seen: Option<String> = None;

        loop {
            if let Ok(mut clipboard) = arboard::Clipboard::new() {
                let source = detect_source_app();

                if let Ok(paths) = clipboard.get().file_list() {
                    if !paths.is_empty() {
                        let signature = file_signature(&paths);
                        if last_seen.as_deref() != Some(signature.as_str()) {
                            last_seen = Some(signature);
                            capture_clipboard_files(&app, &paths, source.clone());
                        }
                        thread::sleep(Duration::from_millis(750));
                        continue;
                    }
                }

                if let Ok(image) = clipboard.get_image() {
                    let signature =
                        image_signature(image.width, image.height, image.bytes.as_ref());
                    if last_seen.as_deref() != Some(signature.as_str()) {
                        last_seen = Some(signature);
                        capture_clipboard_image(
                            &app,
                            image.width as u32,
                            image.height as u32,
                            image.bytes.into_owned(),
                            source.clone(),
                        );
                    }
                    thread::sleep(Duration::from_millis(750));
                    continue;
                }

                if let Ok(html) = clipboard.get().html() {
                    let text = clipboard
                        .get_text()
                        .unwrap_or_else(|_| plain_text_from_html(&html));
                    let signature = format!("rich:{text}:{html}");
                    if last_seen.as_deref() != Some(signature.as_str()) {
                        last_seen = Some(signature);
                        capture_clipboard_rich_text(&app, &text, &html, source.clone());
                    }
                    thread::sleep(Duration::from_millis(750));
                    continue;
                }

                if let Ok(text) = clipboard.get_text() {
                    let signature = format!("text:{text}");
                    if last_seen.as_deref() != Some(signature.as_str()) {
                        last_seen = Some(signature);
                        capture_clipboard_text(&app, &text, source);
                    }
                }
            }

            thread::sleep(Duration::from_millis(750));
        }
    });
}

fn capture_clipboard_image<R: Runtime>(
    app: &AppHandle<R>,
    width: u32,
    height: u32,
    bytes: Vec<u8>,
    source: Option<SourceAppInfo>,
) {
    let state = app.state::<AppState>();
    let Ok(mut store) = state.store.lock() else {
        return;
    };

    if matches!(
        store.add_image_with_source(width, height, bytes, source),
        Ok(Some(_))
    ) {
        let _ = app.emit(CLIPS_CHANGED_EVENT, ());
    }
}

fn capture_clipboard_files<R: Runtime>(
    app: &AppHandle<R>,
    paths: &[PathBuf],
    source: Option<SourceAppInfo>,
) {
    let state = app.state::<AppState>();
    let Ok(mut store) = state.store.lock() else {
        return;
    };

    if matches!(store.add_files_with_source(paths, source), Ok(Some(_))) {
        let _ = app.emit(CLIPS_CHANGED_EVENT, ());
    }
}

fn capture_clipboard_rich_text<R: Runtime>(
    app: &AppHandle<R>,
    text: &str,
    html: &str,
    source: Option<SourceAppInfo>,
) {
    let state = app.state::<AppState>();
    let Ok(mut store) = state.store.lock() else {
        return;
    };

    if matches!(
        store.add_rich_text_with_source(text, html, source),
        Ok(Some(_))
    ) {
        let _ = app.emit(CLIPS_CHANGED_EVENT, ());
    }
}

fn capture_clipboard_text<R: Runtime>(
    app: &AppHandle<R>,
    text: &str,
    source: Option<SourceAppInfo>,
) {
    let state = app.state::<AppState>();
    let Ok(mut store) = state.store.lock() else {
        return;
    };

    if matches!(store.add_text_with_source(text, source), Ok(Some(_))) {
        let _ = app.emit(CLIPS_CHANGED_EVENT, ());
    }
}

fn plain_text_from_html(html: &str) -> String {
    let mut text = String::with_capacity(html.len());
    let mut in_tag = false;

    for character in html.chars() {
        match character {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                text.push(' ');
            }
            _ if !in_tag => text.push(character),
            _ => {}
        }
    }

    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(target_os = "windows")]
pub fn detect_source_app() -> Option<SourceAppInfo> {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return None;
    }

    let mut process_id = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
    }
    if process_id == 0 {
        return None;
    }

    let path = foreground_process_path(process_id);
    let name = path
        .as_ref()
        .and_then(|value| {
            Path::new(value)
                .file_stem()
                .map(|name| name.to_string_lossy().to_string())
        })
        .or_else(|| Some(format!("PID {process_id}")));
    let icon = windows_icons::get_icon_base64_by_process_id(process_id)
        .ok()
        .map(|value| format!("data:image/png;base64,{value}"));

    Some(SourceAppInfo { name, icon, path })
}

#[cfg(not(target_os = "windows"))]
pub fn detect_source_app() -> Option<SourceAppInfo> {
    None
}

#[cfg(target_os = "windows")]
fn foreground_process_path(process_id: u32) -> Option<String> {
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) };
    let Ok(process) = process else {
        return None;
    };

    let mut buffer = vec![0u16; 2048];
    let mut size = buffer.len() as u32;
    let success = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_FORMAT(0),
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        )
        .is_ok()
    };
    unsafe {
        let _ = CloseHandle(process);
    }

    if !success || size == 0 {
        return None;
    }

    Some(String::from_utf16_lossy(&buffer[..size as usize]))
}

fn image_signature(width: usize, height: usize, bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(width.to_le_bytes());
    hasher.update(height.to_le_bytes());
    hasher.update(bytes);
    format!("image:{:x}", hasher.finalize())
}

fn file_signature(paths: &[PathBuf]) -> String {
    format!(
        "file:{}",
        paths
            .iter()
            .map(|path| path.to_string_lossy())
            .collect::<Vec<_>>()
            .join("\n")
    )
}

fn toggle_capture<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    let Ok(mut store) = state.store.lock() else {
        return;
    };

    let Ok(settings) = store.settings() else {
        return;
    };

    let updated = store.update_settings(SettingsPatch {
        capture_paused: Some(!settings.capture_paused),
        ..SettingsPatch::default()
    });

    if let Ok(settings) = updated {
        let _ = app.emit(SETTINGS_CHANGED_EVENT, settings);
    }
}

fn clear_history<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    let Ok(mut store) = state.store.lock() else {
        return;
    };

    if store.clear().is_ok() {
        let _ = app.emit(CLIPS_CHANGED_EVENT, ());
    }
}

fn parse_shortcut(value: &str) -> Result<Shortcut, ClipflowError> {
    value
        .trim()
        .parse::<Shortcut>()
        .map_err(|error| ClipflowError::ShortcutRegistrationFailed(error.to_string()))
}

fn to_shortcut_registration_error(error: tauri_plugin_global_shortcut::Error) -> ClipflowError {
    ClipflowError::ShortcutRegistrationFailed(error.to_string())
}
