use crate::app_state::AppState;
use crate::error::ClipflowError;
use crate::models::{
    ClipItem, ClipKind, Settings, SettingsPatch, SourceAppInfo, WindowPositionMode,
};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use std::{error::Error, thread};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    App, AppHandle, Emitter, Manager, PhysicalPosition, Runtime, WebviewWindow, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(target_os = "windows")]
use windows::core::{PCWSTR, PWSTR};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{CloseHandle, HWND};
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
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, IsWindow, SetForegroundWindow,
};

pub const CLIPS_CHANGED_EVENT: &str = "clips-changed";
pub const PANEL_SHOWN_EVENT: &str = "panel-shown";
pub const SETTINGS_CHANGED_EVENT: &str = "settings-changed";
const TRAY_ID: &str = "clipflow-tray";
const CLIPBOARD_CAPTURE_SUPPRESSION_MS: u64 = 1_500;
const FOCUS_LOSS_HIDE_SUPPRESSION_MS: u64 = 900;

struct ClipboardSuppression {
    signature: String,
    expires_at: Instant,
}

#[derive(Debug, Eq, PartialEq)]
enum PanelHotkeyAction {
    Show,
    Hide,
}

static CLIPBOARD_WRITE_SUPPRESSION: OnceLock<Mutex<Option<ClipboardSuppression>>> = OnceLock::new();
static FOCUS_LOSS_HIDE_SUPPRESSION: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

#[cfg(target_os = "windows")]
static REMEMBERED_FOREGROUND_WINDOW: OnceLock<Mutex<Option<isize>>> = OnceLock::new();

pub fn setup_app(app: &mut App) -> Result<(), Box<dyn Error>> {
    setup_tray(app)?;
    setup_focus_loss_hide(app);
    register_stored_panel_hotkey(app.handle());
    apply_stored_panel_pin(app.handle());
    apply_stored_launch_on_startup(app.handle());
    apply_stored_tray_icon_visibility(app.handle());
    apply_stored_taskbar_icon_visibility(app.handle());
    start_clipboard_watcher(app.handle().clone());
    start_edge_auto_hide_watcher(app.handle().clone());
    show_panel(app.handle());
    Ok(())
}

pub fn show_panel<R: Runtime>(app: &AppHandle<R>) {
    remember_foreground_window();
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

pub fn apply_tray_icon_visibility<R: Runtime>(app: &AppHandle<R>, visible: bool) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_visible(visible);
    }
}

pub fn apply_taskbar_icon_visibility<R: Runtime>(app: &AppHandle<R>, visible: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_skip_taskbar(!visible);
    }
}

pub fn hide_panel<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub fn suppress_next_focus_loss_hide() {
    remember_focus_loss_hide_suppression_until(
        Instant::now() + Duration::from_millis(FOCUS_LOSS_HIDE_SUPPRESSION_MS),
    );
}

fn setup_focus_loss_hide(app: &mut App) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let app_handle = app.handle().clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Focused(false) => {
            let app_for_thread = app_handle.clone();
            let app_for_closure = app_handle.clone();
            if let Err(error) = app_for_thread
                .run_on_main_thread(move || hide_clipboard_panel_on_focus_loss(&app_for_closure))
            {
                eprintln!("failed to process panel focus loss: {error}");
            }
        }
        WindowEvent::CloseRequested { api, .. } => {
            if should_minimize_on_close(&app_handle) {
                api.prevent_close();
                let app_for_thread = app_handle.clone();
                let app_for_closure = app_handle.clone();
                if let Err(error) =
                    app_for_thread.run_on_main_thread(move || hide_panel(&app_for_closure))
                {
                    eprintln!("failed to minimize panel on close: {error}");
                }
            }
        }
        _ => {}
    });
}

fn should_minimize_on_close<R: Runtime>(app: &AppHandle<R>) -> bool {
    read_settings(app)
        .map(|settings| settings.minimize_on_close)
        .unwrap_or(true)
}

fn hide_clipboard_panel_on_focus_loss<R: Runtime>(app: &AppHandle<R>) {
    if consume_focus_loss_hide_suppression() {
        return;
    }

    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Some(settings) = read_settings(app) else {
        return;
    };

    if settings.panel_pinned || is_settings_route(&window) {
        return;
    }

    let _ = window.hide();
}

pub fn prepare_paste_target<R: Runtime>(app: &AppHandle<R>) {
    hide_panel(app);
    let _ = restore_remembered_foreground_window();
    thread::sleep(Duration::from_millis(90));
}

pub fn remember_app_clipboard_write(item: &ClipItem) {
    if let Some(signature) = clipboard_signature_for_item(item) {
        remember_clipboard_write_signature(signature);
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
    let shortcut_to_check = shortcut.clone();
    registry
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                show_panel_from_hotkey(app);
            }
        })
        .map_err(to_shortcut_registration_error)?;
    if !registry.is_registered(shortcut_to_check) {
        return Err(ClipflowError::ShortcutRegistrationFailed(format!(
            "shortcut '{value}' was not registered after registration"
        )));
    }

    Ok(())
}

fn show_panel_from_hotkey<R: Runtime>(app: &AppHandle<R>) {
    let app_for_thread = app.clone();
    let app_for_closure = app.clone();
    if let Err(error) =
        app_for_thread.run_on_main_thread(move || toggle_panel_from_hotkey(&app_for_closure))
    {
        eprintln!("failed to toggle panel from hotkey on main thread: {error}");
    }
}

fn toggle_panel_from_hotkey<R: Runtime>(app: &AppHandle<R>) {
    let action = app
        .get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .map(panel_hotkey_action)
        .unwrap_or(PanelHotkeyAction::Show);

    match action {
        PanelHotkeyAction::Show => show_panel(app),
        PanelHotkeyAction::Hide => hide_panel(app),
    }
}

fn panel_hotkey_action(window_visible: bool) -> PanelHotkeyAction {
    if window_visible {
        PanelHotkeyAction::Hide
    } else {
        PanelHotkeyAction::Show
    }
}

fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "打开 ClipFlow", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "toggle_capture", "暂停/继续记录", true, None::<&str>)?;
    let clear = MenuItem::with_id(app, "clear_history", "清空历史", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &pause, &clear, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
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
    if let Err(error) = register_panel_hotkey(app, &settings.shortcuts.show_panel) {
        eprintln!(
            "failed to register panel hotkey '{}': {error}",
            settings.shortcuts.show_panel
        );
    }
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

fn apply_stored_tray_icon_visibility<R: Runtime>(app: &AppHandle<R>) {
    let Some(settings) = read_settings(app) else {
        return;
    };
    apply_tray_icon_visibility(app, settings.show_tray_icon);
}

fn apply_stored_taskbar_icon_visibility<R: Runtime>(app: &AppHandle<R>) {
    let Some(settings) = read_settings(app) else {
        return;
    };
    apply_taskbar_icon_visibility(app, settings.show_taskbar_icon);
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

#[cfg(target_os = "windows")]
fn remembered_foreground_window_slot() -> &'static Mutex<Option<isize>> {
    REMEMBERED_FOREGROUND_WINDOW.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "windows")]
fn remember_foreground_window() {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return;
    }

    if let Ok(mut slot) = remembered_foreground_window_slot().lock() {
        *slot = Some(hwnd.0 as isize);
    }
}

#[cfg(not(target_os = "windows"))]
fn remember_foreground_window() {}

#[cfg(target_os = "windows")]
fn restore_remembered_foreground_window() -> bool {
    let raw_hwnd = remembered_foreground_window_slot()
        .lock()
        .ok()
        .and_then(|slot| *slot);
    let Some(raw_hwnd) = raw_hwnd else {
        return false;
    };
    let hwnd = HWND(raw_hwnd as *mut std::ffi::c_void);

    if !unsafe { IsWindow(hwnd).as_bool() } {
        return false;
    }

    unsafe { SetForegroundWindow(hwnd).as_bool() }
}

#[cfg(not(target_os = "windows"))]
fn restore_remembered_foreground_window() -> bool {
    false
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

fn is_settings_route<R: Runtime>(window: &WebviewWindow<R>) -> bool {
    let Ok(url) = window.url() else {
        return false;
    };
    let path = url.path().trim_end_matches('/');
    path == "/settings" || path.ends_with("/settings")
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

                if is_settings_route(&window) {
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
                        if should_capture_clipboard_signature(&mut last_seen, signature) {
                            capture_clipboard_files(&app, &paths, source.clone());
                        }
                        thread::sleep(Duration::from_millis(750));
                        continue;
                    }
                }

                if let Ok(image) = clipboard.get_image() {
                    let signature =
                        image_signature(image.width, image.height, image.bytes.as_ref());
                    if should_capture_clipboard_signature(&mut last_seen, signature) {
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
                    if should_capture_clipboard_signature(&mut last_seen, signature) {
                        capture_clipboard_rich_text(&app, &text, &html, source.clone());
                    }
                    thread::sleep(Duration::from_millis(750));
                    continue;
                }

                if let Ok(text) = clipboard.get_text() {
                    let signature = format!("text:{text}");
                    if should_capture_clipboard_signature(&mut last_seen, signature) {
                        capture_clipboard_text(&app, &text, source);
                    }
                }
            }

            thread::sleep(Duration::from_millis(750));
        }
    });
}

fn should_capture_clipboard_signature(last_seen: &mut Option<String>, signature: String) -> bool {
    let is_repeat = last_seen.as_deref() == Some(signature.as_str());
    *last_seen = Some(signature.clone());
    !is_repeat && !should_suppress_clipboard_capture(&signature)
}

fn clipboard_suppression_slot() -> &'static Mutex<Option<ClipboardSuppression>> {
    CLIPBOARD_WRITE_SUPPRESSION.get_or_init(|| Mutex::new(None))
}

fn focus_loss_hide_suppression_slot() -> &'static Mutex<Option<Instant>> {
    FOCUS_LOSS_HIDE_SUPPRESSION.get_or_init(|| Mutex::new(None))
}

fn remember_clipboard_write_signature(signature: String) {
    if let Ok(mut slot) = clipboard_suppression_slot().lock() {
        *slot = Some(ClipboardSuppression {
            signature,
            expires_at: Instant::now() + Duration::from_millis(CLIPBOARD_CAPTURE_SUPPRESSION_MS),
        });
    }
}

fn remember_focus_loss_hide_suppression_until(expires_at: Instant) {
    if let Ok(mut slot) = focus_loss_hide_suppression_slot().lock() {
        *slot = Some(expires_at);
    }
}

fn consume_focus_loss_hide_suppression() -> bool {
    let Ok(mut slot) = focus_loss_hide_suppression_slot().lock() else {
        return false;
    };
    let Some(expires_at) = *slot else {
        return false;
    };

    *slot = None;
    Instant::now() < expires_at
}

fn should_suppress_clipboard_capture(signature: &str) -> bool {
    let Ok(mut slot) = clipboard_suppression_slot().lock() else {
        return false;
    };

    let Some(state) = slot.as_ref() else {
        return false;
    };

    if Instant::now() >= state.expires_at {
        *slot = None;
        return false;
    }

    if state.signature == signature {
        *slot = None;
        return true;
    }

    false
}

#[cfg(test)]
fn reset_clipboard_capture_suppression_for_test() {
    if let Ok(mut slot) = clipboard_suppression_slot().lock() {
        *slot = None;
    }
}

#[cfg(test)]
fn reset_focus_loss_hide_suppression_for_test() {
    if let Ok(mut slot) = focus_loss_hide_suppression_slot().lock() {
        *slot = None;
    }
}

fn clipboard_signature_for_item(item: &ClipItem) -> Option<String> {
    match item.kind {
        ClipKind::Image => Some(image_signature(
            item.image_width? as usize,
            item.image_height? as usize,
            item.image_bytes.as_ref()?,
        )),
        ClipKind::File => {
            let paths = item
                .file_paths
                .iter()
                .map(PathBuf::from)
                .collect::<Vec<_>>();
            if paths.is_empty() {
                Some(format!("text:{}", item.text))
            } else {
                Some(file_signature(&paths))
            }
        }
        ClipKind::RichText => item
            .rich_html
            .as_ref()
            .map(|html| format!("rich:{}:{html}", item.text)),
        _ => Some(format!("text:{}", item.text)),
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suppresses_app_owned_clipboard_signature_until_consumed() {
        reset_clipboard_capture_suppression_for_test();

        remember_clipboard_write_signature("text:hello".to_string());

        assert!(should_suppress_clipboard_capture("text:hello"));
        assert!(!should_suppress_clipboard_capture("text:world"));
    }

    #[test]
    fn internal_window_interaction_suppresses_one_focus_loss_hide() {
        reset_focus_loss_hide_suppression_for_test();

        suppress_next_focus_loss_hide();

        assert!(consume_focus_loss_hide_suppression());
        assert!(!consume_focus_loss_hide_suppression());
    }

    #[test]
    fn expired_focus_loss_hide_suppression_is_ignored() {
        reset_focus_loss_hide_suppression_for_test();
        remember_focus_loss_hide_suppression_until(Instant::now() - Duration::from_millis(1));

        assert!(!consume_focus_loss_hide_suppression());
    }

    #[test]
    fn panel_hotkey_toggles_based_on_current_visibility() {
        assert_eq!(PanelHotkeyAction::Hide, panel_hotkey_action(true));
        assert_eq!(PanelHotkeyAction::Show, panel_hotkey_action(false));
    }
}
