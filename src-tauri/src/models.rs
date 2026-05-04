use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ClipKind {
    Text,
    Link,
    Code,
    Image,
    File,
    RichText,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ClipFilter {
    All,
    Text,
    Favorite,
    Image,
    File,
    Link,
    Code,
    RichText,
    Recent,
    Trash,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum OptionalClipFilter {
    Link,
    Code,
    RichText,
    Recent,
    Trash,
}

impl Default for ClipFilter {
    fn default() -> Self {
        Self::All
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipItem {
    pub id: String,
    pub text: String,
    pub preview: String,
    pub kind: ClipKind,
    pub content_hash: String,
    pub created_at: String,
    pub last_used_at: Option<String>,
    pub use_count: u32,
    pub is_favorite: bool,
    pub source_app_name: Option<String>,
    pub source_app_icon: Option<String>,
    pub source_app_path: Option<String>,
    pub rich_html: Option<String>,
    pub deleted_at: Option<String>,
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
    pub file_count: Option<u32>,
    pub file_paths: Vec<String>,
    #[serde(skip_serializing, default)]
    pub image_bytes: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceAppInfo {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default = "default_hotkey")]
    pub hotkey: String,
    #[serde(default)]
    pub shortcuts: Shortcuts,
    #[serde(default = "default_history_limit")]
    pub history_limit: usize,
    #[serde(default = "default_retention_days")]
    pub retention_days: u32,
    #[serde(default = "default_trash_retention_days")]
    pub trash_retention_days: u32,
    #[serde(default)]
    pub launch_on_startup: bool,
    #[serde(default = "default_true")]
    pub show_tray_icon: bool,
    #[serde(default = "default_true")]
    pub show_taskbar_icon: bool,
    #[serde(default)]
    pub color_preset: ColorPreset,
    #[serde(default = "default_custom_color")]
    pub custom_color: String,
    #[serde(default)]
    pub motion_preset: MotionPreset,
    #[serde(default)]
    pub auto_sort_duplicates: bool,
    #[serde(default = "default_true")]
    pub minimize_on_close: bool,
    #[serde(default)]
    pub panel_pinned: bool,
    #[serde(default)]
    pub window_position: WindowPositionMode,
    #[serde(default)]
    pub copy_sound: bool,
    #[serde(default)]
    pub search_box_position: SearchBoxPosition,
    #[serde(default)]
    pub mouse_paste_trigger: MousePasteTrigger,
    #[serde(default = "default_true")]
    pub delete_confirmation: bool,
    #[serde(default)]
    pub edge_auto_hide: bool,
    #[serde(default)]
    pub optional_filters: Vec<OptionalClipFilter>,
    #[serde(default)]
    pub capture_paused: bool,
    #[serde(default)]
    pub theme_mode: ThemeMode,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            hotkey: default_hotkey(),
            shortcuts: Shortcuts::default(),
            history_limit: default_history_limit(),
            retention_days: default_retention_days(),
            trash_retention_days: default_trash_retention_days(),
            launch_on_startup: false,
            show_tray_icon: true,
            show_taskbar_icon: true,
            color_preset: ColorPreset::Teal,
            custom_color: default_custom_color(),
            motion_preset: MotionPreset::A,
            auto_sort_duplicates: false,
            minimize_on_close: true,
            panel_pinned: false,
            window_position: WindowPositionMode::Remember,
            copy_sound: false,
            search_box_position: SearchBoxPosition::Top,
            mouse_paste_trigger: MousePasteTrigger::DoubleClick,
            delete_confirmation: true,
            edge_auto_hide: false,
            optional_filters: Vec::new(),
            capture_paused: false,
            theme_mode: ThemeMode::System,
        }
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shortcuts {
    pub show_panel: String,
    pub paste_selected: String,
    pub copy_selected: String,
    pub delete_selected: String,
    pub next_item: String,
    pub previous_item: String,
}

impl Default for Shortcuts {
    fn default() -> Self {
        Self {
            show_panel: default_hotkey(),
            paste_selected: "Enter".to_string(),
            copy_selected: "Ctrl+Enter".to_string(),
            delete_selected: "Delete".to_string(),
            next_item: "ArrowDown".to_string(),
            previous_item: "ArrowUp".to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ThemeMode {
    System,
    Light,
    Dark,
}

impl Default for ThemeMode {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ColorPreset {
    Teal,
    Blue,
    Indigo,
    Violet,
    Rose,
    Coral,
    Amber,
    Slate,
    Custom,
}

impl Default for ColorPreset {
    fn default() -> Self {
        Self::Teal
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MotionPreset {
    A,
    B,
    C,
    D,
}

impl Default for MotionPreset {
    fn default() -> Self {
        Self::A
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WindowPositionMode {
    Remember,
    FollowMouse,
    ScreenCenter,
}

impl Default for WindowPositionMode {
    fn default() -> Self {
        Self::Remember
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SearchBoxPosition {
    Top,
    Bottom,
    Hidden,
}

impl Default for SearchBoxPosition {
    fn default() -> Self {
        Self::Top
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MousePasteTrigger {
    SingleClick,
    DoubleClick,
}

impl Default for MousePasteTrigger {
    fn default() -> Self {
        Self::DoubleClick
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub hotkey: Option<String>,
    pub shortcuts: Option<ShortcutsPatch>,
    pub history_limit: Option<usize>,
    pub retention_days: Option<u32>,
    pub trash_retention_days: Option<u32>,
    pub launch_on_startup: Option<bool>,
    pub show_tray_icon: Option<bool>,
    pub show_taskbar_icon: Option<bool>,
    pub color_preset: Option<ColorPreset>,
    pub custom_color: Option<String>,
    pub motion_preset: Option<MotionPreset>,
    pub auto_sort_duplicates: Option<bool>,
    pub minimize_on_close: Option<bool>,
    pub panel_pinned: Option<bool>,
    pub window_position: Option<WindowPositionMode>,
    pub copy_sound: Option<bool>,
    pub search_box_position: Option<SearchBoxPosition>,
    pub mouse_paste_trigger: Option<MousePasteTrigger>,
    pub delete_confirmation: Option<bool>,
    pub edge_auto_hide: Option<bool>,
    pub optional_filters: Option<Vec<OptionalClipFilter>>,
    pub capture_paused: Option<bool>,
    pub theme_mode: Option<ThemeMode>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutsPatch {
    pub show_panel: Option<String>,
    pub paste_selected: Option<String>,
    pub copy_selected: Option<String>,
    pub delete_selected: Option<String>,
    pub next_item: Option<String>,
    pub previous_item: Option<String>,
}

fn default_hotkey() -> String {
    "Alt+C".to_string()
}

fn default_history_limit() -> usize {
    100
}

fn default_custom_color() -> String {
    "#0d9488".to_string()
}

fn default_retention_days() -> u32 {
    30
}

fn default_trash_retention_days() -> u32 {
    7
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_show_tray_and_taskbar_icons() {
        let settings = Settings::default();

        assert!(settings.show_tray_icon);
        assert!(settings.show_taskbar_icon);
    }

    #[test]
    fn default_settings_use_requested_window_and_sorting_behavior() {
        let settings = Settings::default();

        assert!(!settings.auto_sort_duplicates);
        assert!(settings.minimize_on_close);
    }

    #[test]
    fn default_settings_use_motion_preset_a() {
        let settings = Settings::default();

        assert_eq!(MotionPreset::A, settings.motion_preset);
    }

    #[test]
    fn legacy_settings_without_icon_visibility_fields_default_to_visible() {
        let settings = serde_json::from_str::<Settings>(
            r#"{
                "launchOnStartup": false,
                "historyLimit": 100,
                "retentionDays": 30
            }"#,
        )
        .expect("legacy settings");

        assert!(settings.show_tray_icon);
        assert!(settings.show_taskbar_icon);
    }

    #[test]
    fn legacy_settings_without_motion_preset_default_to_a() {
        let settings = serde_json::from_str::<Settings>(
            r#"{
                "launchOnStartup": false,
                "historyLimit": 100,
                "retentionDays": 30
            }"#,
        )
        .expect("legacy settings");

        assert_eq!(MotionPreset::A, settings.motion_preset);
    }

    #[test]
    fn legacy_settings_without_new_behavior_fields_use_requested_defaults() {
        let settings = serde_json::from_str::<Settings>(
            r#"{
                "launchOnStartup": false,
                "historyLimit": 100,
                "retentionDays": 30
            }"#,
        )
        .expect("legacy settings");

        assert!(!settings.auto_sort_duplicates);
        assert!(settings.minimize_on_close);
    }
}
