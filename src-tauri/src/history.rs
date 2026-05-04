use crate::error::ClipflowError;
use crate::models::{ClipFilter, ClipItem, ClipKind, Settings, SettingsPatch, SourceAppInfo};
use chrono::{Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub struct ClipStore {
    conn: Connection,
}

const CLIP_COLUMNS: &str = "id, text, preview, kind, content_hash, created_at, last_used_at, use_count, image_width, image_height, file_count, file_paths, image_bytes, is_favorite, source_app_name, source_app_icon, source_app_path, rich_html, deleted_at";

struct ExistingClip {
    id: String,
    deleted_at: Option<String>,
}

impl ClipStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, ClipflowError> {
        let conn = Connection::open(path)?;
        let store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    pub fn in_memory() -> Result<Self, ClipflowError> {
        let conn = Connection::open_in_memory()?;
        let store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    pub fn add_text(&mut self, text: &str) -> Result<Option<ClipItem>, ClipflowError> {
        self.add_text_with_source(text, None)
    }

    pub fn add_text_with_source(
        &mut self,
        text: &str,
        source: Option<SourceAppInfo>,
    ) -> Result<Option<ClipItem>, ClipflowError> {
        let settings = self.settings()?;
        if settings.capture_paused {
            return Ok(None);
        }

        let normalized = normalize_text(text);
        if normalized.is_empty() {
            return Ok(None);
        }

        let now = now();
        let kind = classify_text(&normalized);
        let file_paths = if kind == ClipKind::File {
            parse_file_paths(&normalized)
        } else {
            Vec::new()
        };
        let file_count = optional_count(file_paths.len());
        let hash = content_hash(&format!("{}:{normalized}", kind_to_db(kind)));
        let existing = self.existing_clip_by_hash(&hash)?;
        if existing
            .as_ref()
            .is_some_and(|clip| clip.deleted_at.is_none())
        {
            return Ok(None);
        }

        let id = existing
            .map(|clip| clip.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        self.conn.execute(
            "INSERT INTO clips (
                id, text, preview, kind, content_hash, created_at, last_used_at, use_count,
                image_width, image_height, file_count, file_paths, image_bytes,
                source_app_name, source_app_icon, source_app_path, rich_html, deleted_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, 0, NULL, NULL, ?7, ?8, NULL, ?9, ?10, ?11, NULL, NULL)
            ON CONFLICT(content_hash) DO UPDATE SET
                text = excluded.text,
                preview = excluded.preview,
                kind = excluded.kind,
                image_width = excluded.image_width,
                image_height = excluded.image_height,
                file_count = excluded.file_count,
                file_paths = excluded.file_paths,
                image_bytes = excluded.image_bytes,
                source_app_name = excluded.source_app_name,
                source_app_icon = excluded.source_app_icon,
                source_app_path = excluded.source_app_path,
                rich_html = excluded.rich_html,
                deleted_at = NULL",
            params![
                id,
                normalized,
                preview_for_clip(kind, &normalized, &file_paths, None),
                kind_to_db(kind),
                hash,
                now,
                file_count,
                serialize_file_paths(&file_paths)?,
                source_app_name(&source),
                source_app_icon(&source),
                source_app_path(&source)
            ],
        )?;
        self.enforce_history_policy(&settings)?;
        self.get_clip_by_hash(&hash).map(Some)
    }

    pub fn add_rich_text_with_source(
        &mut self,
        text: &str,
        html: &str,
        source: Option<SourceAppInfo>,
    ) -> Result<Option<ClipItem>, ClipflowError> {
        let settings = self.settings()?;
        if settings.capture_paused {
            return Ok(None);
        }

        let normalized = normalize_text(text);
        let rich_html = html.trim();
        if normalized.is_empty() || rich_html.is_empty() {
            return Ok(None);
        }

        let now = now();
        let hash = content_hash(&format!("rich:{normalized}:{rich_html}"));
        let existing = self.existing_clip_by_hash(&hash)?;
        if existing
            .as_ref()
            .is_some_and(|clip| clip.deleted_at.is_none())
        {
            return Ok(None);
        }

        let id = existing
            .map(|clip| clip.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        self.conn.execute(
            "INSERT INTO clips (
                id, text, preview, kind, content_hash, created_at, last_used_at, use_count,
                image_width, image_height, file_count, file_paths, image_bytes,
                source_app_name, source_app_icon, source_app_path, rich_html, deleted_at
            ) VALUES (?1, ?2, ?3, 'richText', ?4, ?5, NULL, 0, NULL, NULL, NULL, '[]', NULL, ?6, ?7, ?8, ?9, NULL)
            ON CONFLICT(content_hash) DO UPDATE SET
                text = excluded.text,
                preview = excluded.preview,
                kind = excluded.kind,
                source_app_name = excluded.source_app_name,
                source_app_icon = excluded.source_app_icon,
                source_app_path = excluded.source_app_path,
                rich_html = excluded.rich_html,
                deleted_at = NULL",
            params![
                id,
                normalized,
                preview_for_clip(ClipKind::RichText, &normalized, &[], None),
                hash,
                now,
                source_app_name(&source),
                source_app_icon(&source),
                source_app_path(&source),
                rich_html
            ],
        )?;
        self.enforce_history_policy(&settings)?;
        self.get_clip_by_hash(&hash).map(Some)
    }

    pub fn add_image(
        &mut self,
        width: u32,
        height: u32,
        bytes: Vec<u8>,
    ) -> Result<Option<ClipItem>, ClipflowError> {
        self.add_image_with_source(width, height, bytes, None)
    }

    pub fn add_image_with_source(
        &mut self,
        width: u32,
        height: u32,
        bytes: Vec<u8>,
        source: Option<SourceAppInfo>,
    ) -> Result<Option<ClipItem>, ClipflowError> {
        let settings = self.settings()?;
        if settings.capture_paused || width == 0 || height == 0 || bytes.is_empty() {
            return Ok(None);
        }

        let now = now();
        let text = format!("图片 {width} × {height}");
        let hash = content_hash_bytes("image", width, height, &bytes);
        let existing = self.existing_clip_by_hash(&hash)?;
        if existing
            .as_ref()
            .is_some_and(|clip| clip.deleted_at.is_none())
        {
            return Ok(None);
        }

        let id = existing
            .map(|clip| clip.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        self.conn.execute(
            "INSERT INTO clips (
                id, text, preview, kind, content_hash, created_at, last_used_at, use_count,
                image_width, image_height, file_count, file_paths, image_bytes,
                source_app_name, source_app_icon, source_app_path, rich_html, deleted_at
            ) VALUES (?1, ?2, ?3, 'image', ?4, ?5, NULL, 0, ?6, ?7, NULL, '[]', ?8, ?9, ?10, ?11, NULL, NULL)
            ON CONFLICT(content_hash) DO UPDATE SET
                text = excluded.text,
                preview = excluded.preview,
                kind = excluded.kind,
                image_width = excluded.image_width,
                image_height = excluded.image_height,
                file_count = excluded.file_count,
                file_paths = excluded.file_paths,
                image_bytes = excluded.image_bytes,
                source_app_name = excluded.source_app_name,
                source_app_icon = excluded.source_app_icon,
                source_app_path = excluded.source_app_path,
                rich_html = excluded.rich_html,
                deleted_at = NULL",
            params![
                id,
                text,
                format!("图片 {width} × {height}"),
                hash,
                now,
                width,
                height,
                bytes,
                source_app_name(&source),
                source_app_icon(&source),
                source_app_path(&source)
            ],
        )?;
        self.enforce_history_policy(&settings)?;
        self.get_clip_by_hash(&hash).map(Some)
    }

    pub fn add_files(&mut self, paths: &[PathBuf]) -> Result<Option<ClipItem>, ClipflowError> {
        self.add_files_with_source(paths, None)
    }

    pub fn add_files_with_source(
        &mut self,
        paths: &[PathBuf],
        source: Option<SourceAppInfo>,
    ) -> Result<Option<ClipItem>, ClipflowError> {
        let settings = self.settings()?;
        if settings.capture_paused {
            return Ok(None);
        }

        let file_paths = paths
            .iter()
            .map(|path| path.to_string_lossy().trim().to_string())
            .filter(|path| !path.is_empty())
            .collect::<Vec<_>>();
        if file_paths.is_empty() {
            return Ok(None);
        }

        let now = now();
        let text = file_paths.join("\n");
        let preview = file_preview(&file_paths);
        let hash = content_hash(&format!("file:{}", file_paths.join("\n")));
        let existing = self.existing_clip_by_hash(&hash)?;
        if existing
            .as_ref()
            .is_some_and(|clip| clip.deleted_at.is_none())
        {
            return Ok(None);
        }

        let id = existing
            .map(|clip| clip.id)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        self.conn.execute(
            "INSERT INTO clips (
                id, text, preview, kind, content_hash, created_at, last_used_at, use_count,
                image_width, image_height, file_count, file_paths, image_bytes,
                source_app_name, source_app_icon, source_app_path, rich_html, deleted_at
            ) VALUES (?1, ?2, ?3, 'file', ?4, ?5, NULL, 0, NULL, NULL, ?6, ?7, NULL, ?8, ?9, ?10, NULL, NULL)
            ON CONFLICT(content_hash) DO UPDATE SET
                text = excluded.text,
                preview = excluded.preview,
                kind = excluded.kind,
                image_width = excluded.image_width,
                image_height = excluded.image_height,
                file_count = excluded.file_count,
                file_paths = excluded.file_paths,
                image_bytes = excluded.image_bytes,
                source_app_name = excluded.source_app_name,
                source_app_icon = excluded.source_app_icon,
                source_app_path = excluded.source_app_path,
                rich_html = excluded.rich_html,
                deleted_at = NULL",
            params![
                id,
                text,
                preview,
                hash,
                now,
                optional_count(file_paths.len()),
                serialize_file_paths(&file_paths)?,
                source_app_name(&source),
                source_app_icon(&source),
                source_app_path(&source)
            ],
        )?;
        self.enforce_history_policy(&settings)?;
        self.get_clip_by_hash(&hash).map(Some)
    }

    pub fn list(
        &self,
        query: Option<&str>,
        filter: ClipFilter,
    ) -> Result<Vec<ClipItem>, ClipflowError> {
        let query = normalize_text(query.unwrap_or_default()).to_lowercase();
        let filter_clause = match filter {
            ClipFilter::All => "",
            ClipFilter::Text => "AND deleted_at IS NULL AND kind = 'text'",
            ClipFilter::Favorite => "AND deleted_at IS NULL AND is_favorite = 1",
            ClipFilter::Image => "AND deleted_at IS NULL AND kind = 'image'",
            ClipFilter::File => "AND deleted_at IS NULL AND kind = 'file'",
            ClipFilter::Link => "AND deleted_at IS NULL AND kind = 'link'",
            ClipFilter::Code => "AND deleted_at IS NULL AND kind = 'code'",
            ClipFilter::RichText => "AND deleted_at IS NULL AND kind = 'richText'",
            ClipFilter::Recent => {
                "AND deleted_at IS NULL AND (last_used_at IS NOT NULL OR use_count > 0)"
            }
            ClipFilter::Trash => "AND deleted_at IS NOT NULL",
        };
        let order_clause = if filter == ClipFilter::Trash {
            "ORDER BY deleted_at DESC"
        } else if filter == ClipFilter::Recent {
            "ORDER BY COALESCE(last_used_at, created_at) DESC"
        } else {
            "ORDER BY created_at DESC"
        };
        let sql = format!(
            "SELECT {CLIP_COLUMNS}
             FROM clips
             WHERE (?1 = '' OR lower(text) LIKE '%' || ?1 || '%' OR lower(preview) LIKE '%' || ?1 || '%' OR lower(file_paths) LIKE '%' || ?1 || '%' OR lower(COALESCE(rich_html, '')) LIKE '%' || ?1 || '%' OR lower(COALESCE(source_app_name, '')) LIKE '%' || ?1 || '%')
             {filter_clause}
             {order_clause}"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params![query], row_to_clip)?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(ClipflowError::from)
    }

    pub fn mark_used(&mut self, id: &str) -> Result<ClipItem, ClipflowError> {
        let now = now();
        let updated = self.conn.execute(
            "UPDATE clips SET last_used_at = ?1, use_count = use_count + 1 WHERE id = ?2",
            params![now, id],
        )?;
        if updated == 0 {
            return Err(ClipflowError::ClipNotFound(id.to_string()));
        }

        self.get_clip(id)
    }

    pub fn toggle_favorite(&mut self, id: &str) -> Result<ClipItem, ClipflowError> {
        let updated = self.conn.execute(
            "UPDATE clips
             SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END
             WHERE id = ?1",
            params![id],
        )?;
        if updated == 0 {
            return Err(ClipflowError::ClipNotFound(id.to_string()));
        }

        self.get_clip(id)
    }

    pub fn update_text(&mut self, id: &str, text: &str) -> Result<ClipItem, ClipflowError> {
        let normalized = normalize_text(text);
        if normalized.is_empty() {
            return Err(ClipflowError::EmptyClipContent);
        }

        let kind = classify_text(&normalized);
        let file_paths = if kind == ClipKind::File {
            parse_file_paths(&normalized)
        } else {
            Vec::new()
        };
        let hash = content_hash(&format!("edited:{id}:{}:{normalized}", kind_to_db(kind)));
        let updated = self.conn.execute(
            "UPDATE clips SET
                text = ?1,
                preview = ?2,
                kind = ?3,
                content_hash = ?4,
                image_width = NULL,
                image_height = NULL,
                file_count = ?5,
                file_paths = ?6,
                image_bytes = NULL,
                rich_html = NULL
             WHERE id = ?7 AND deleted_at IS NULL",
            params![
                normalized,
                preview_for_clip(kind, &normalized, &file_paths, None),
                kind_to_db(kind),
                hash,
                optional_count(file_paths.len()),
                serialize_file_paths(&file_paths)?,
                id
            ],
        )?;
        if updated == 0 {
            return Err(ClipflowError::ClipNotFound(id.to_string()));
        }

        self.get_clip(id)
    }

    pub fn get_clip(&self, id: &str) -> Result<ClipItem, ClipflowError> {
        self.conn
            .query_row(
                &format!("SELECT {CLIP_COLUMNS} FROM clips WHERE id = ?1"),
                params![id],
                row_to_clip,
            )
            .optional()?
            .ok_or_else(|| ClipflowError::ClipNotFound(id.to_string()))
    }

    pub fn delete(&mut self, id: &str) -> Result<(), ClipflowError> {
        let updated = self.conn.execute(
            "UPDATE clips SET deleted_at = ?1 WHERE id = ?2",
            params![now(), id],
        )?;
        if updated == 0 {
            return Err(ClipflowError::ClipNotFound(id.to_string()));
        }
        let settings = self.settings()?;
        self.enforce_trash_retention(settings.trash_retention_days)?;
        Ok(())
    }

    pub fn permanently_delete(&mut self, id: &str) -> Result<(), ClipflowError> {
        let deleted = self
            .conn
            .execute("DELETE FROM clips WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(ClipflowError::ClipNotFound(id.to_string()));
        }
        Ok(())
    }

    pub fn restore(&mut self, id: &str) -> Result<ClipItem, ClipflowError> {
        let updated = self.conn.execute(
            "UPDATE clips SET deleted_at = NULL WHERE id = ?1",
            params![id],
        )?;
        if updated == 0 {
            return Err(ClipflowError::ClipNotFound(id.to_string()));
        }
        self.get_clip(id)
    }

    pub fn clear(&mut self) -> Result<(), ClipflowError> {
        self.conn.execute(
            "UPDATE clips SET deleted_at = ?1 WHERE deleted_at IS NULL",
            params![now()],
        )?;
        let settings = self.settings()?;
        self.enforce_trash_retention(settings.trash_retention_days)?;
        Ok(())
    }

    pub fn purge_trash(&mut self) -> Result<(), ClipflowError> {
        self.conn
            .execute("DELETE FROM clips WHERE deleted_at IS NOT NULL", [])?;
        Ok(())
    }

    pub fn settings(&self) -> Result<Settings, ClipflowError> {
        let value = self
            .conn
            .query_row("SELECT value FROM settings WHERE key = 'app'", [], |row| {
                row.get::<_, String>(0)
            })
            .optional()?;

        match value {
            Some(value) => {
                let mut settings = serde_json::from_str::<Settings>(&value)
                    .map_err(|_| ClipflowError::DataDirectoryUnavailable)?;
                settings.trash_retention_days =
                    normalize_trash_retention_days(settings.trash_retention_days);
                Ok(settings)
            }
            None => Ok(Settings::default()),
        }
    }

    pub fn update_settings(&mut self, patch: SettingsPatch) -> Result<Settings, ClipflowError> {
        let mut settings = self.settings()?;
        if let Some(hotkey) = patch.hotkey {
            settings.hotkey = hotkey.clone();
            settings.shortcuts.show_panel = hotkey;
        }
        if let Some(shortcuts) = patch.shortcuts {
            if let Some(show_panel) = shortcuts.show_panel {
                settings.hotkey = show_panel.clone();
                settings.shortcuts.show_panel = show_panel;
            }
            if let Some(paste_selected) = shortcuts.paste_selected {
                settings.shortcuts.paste_selected = paste_selected;
            }
            if let Some(copy_selected) = shortcuts.copy_selected {
                settings.shortcuts.copy_selected = copy_selected;
            }
            if let Some(delete_selected) = shortcuts.delete_selected {
                settings.shortcuts.delete_selected = delete_selected;
            }
            if let Some(next_item) = shortcuts.next_item {
                settings.shortcuts.next_item = next_item;
            }
            if let Some(previous_item) = shortcuts.previous_item {
                settings.shortcuts.previous_item = previous_item;
            }
        }
        if let Some(history_limit) = patch.history_limit {
            settings.history_limit = history_limit;
        }
        if let Some(retention_days) = patch.retention_days {
            settings.retention_days = retention_days;
        }
        if let Some(trash_retention_days) = patch.trash_retention_days {
            settings.trash_retention_days = normalize_trash_retention_days(trash_retention_days);
        }
        if let Some(launch_on_startup) = patch.launch_on_startup {
            settings.launch_on_startup = launch_on_startup;
        }
        if let Some(show_tray_icon) = patch.show_tray_icon {
            settings.show_tray_icon = show_tray_icon;
        }
        if let Some(show_taskbar_icon) = patch.show_taskbar_icon {
            settings.show_taskbar_icon = show_taskbar_icon;
        }
        if let Some(color_preset) = patch.color_preset {
            settings.color_preset = color_preset;
        }
        if let Some(custom_color) = patch.custom_color {
            settings.custom_color = custom_color;
        }
        if let Some(motion_preset) = patch.motion_preset {
            settings.motion_preset = motion_preset;
        }
        if let Some(panel_pinned) = patch.panel_pinned {
            settings.panel_pinned = panel_pinned;
        }
        if let Some(window_position) = patch.window_position {
            settings.window_position = window_position;
        }
        if let Some(copy_sound) = patch.copy_sound {
            settings.copy_sound = copy_sound;
        }
        if let Some(search_box_position) = patch.search_box_position {
            settings.search_box_position = search_box_position;
        }
        if let Some(mouse_paste_trigger) = patch.mouse_paste_trigger {
            settings.mouse_paste_trigger = mouse_paste_trigger;
        }
        if let Some(delete_confirmation) = patch.delete_confirmation {
            settings.delete_confirmation = delete_confirmation;
        }
        if let Some(edge_auto_hide) = patch.edge_auto_hide {
            settings.edge_auto_hide = edge_auto_hide;
        }
        if let Some(optional_filters) = patch.optional_filters {
            settings.optional_filters = optional_filters;
        }
        if let Some(capture_paused) = patch.capture_paused {
            settings.capture_paused = capture_paused;
        }
        if let Some(theme_mode) = patch.theme_mode {
            settings.theme_mode = theme_mode;
        }

        let serialized = serde_json::to_string(&settings)
            .map_err(|_| ClipflowError::DataDirectoryUnavailable)?;
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES ('app', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![serialized],
        )?;
        self.enforce_history_policy(&settings)?;
        Ok(settings)
    }

    fn migrate(&self) -> Result<(), ClipflowError> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                preview TEXT NOT NULL,
                kind TEXT NOT NULL,
                content_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                last_used_at TEXT,
                use_count INTEGER NOT NULL DEFAULT 0,
                image_width INTEGER,
                image_height INTEGER,
                file_count INTEGER,
                file_paths TEXT NOT NULL DEFAULT '[]',
                image_bytes BLOB,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                source_app_name TEXT,
                source_app_icon TEXT,
                source_app_path TEXT,
                rich_html TEXT,
                deleted_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_clips_created_at ON clips(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_clips_kind ON clips(kind);
            CREATE INDEX IF NOT EXISTS idx_clips_deleted_at ON clips(deleted_at DESC);
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
        )?;
        self.add_missing_clip_column("image_width", "INTEGER")?;
        self.add_missing_clip_column("image_height", "INTEGER")?;
        self.add_missing_clip_column("file_count", "INTEGER")?;
        self.add_missing_clip_column("file_paths", "TEXT NOT NULL DEFAULT '[]'")?;
        self.add_missing_clip_column("image_bytes", "BLOB")?;
        self.add_missing_clip_column("is_favorite", "INTEGER NOT NULL DEFAULT 0")?;
        self.add_missing_clip_column("source_app_name", "TEXT")?;
        self.add_missing_clip_column("source_app_icon", "TEXT")?;
        self.add_missing_clip_column("source_app_path", "TEXT")?;
        self.add_missing_clip_column("rich_html", "TEXT")?;
        self.add_missing_clip_column("deleted_at", "TEXT")?;
        Ok(())
    }

    fn add_missing_clip_column(
        &self,
        column_name: &str,
        column_type: &str,
    ) -> Result<(), ClipflowError> {
        let exists = self
            .conn
            .prepare("PRAGMA table_info(clips)")?
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?
            .iter()
            .any(|name| name == column_name);
        if !exists {
            self.conn.execute(
                &format!("ALTER TABLE clips ADD COLUMN {column_name} {column_type}"),
                [],
            )?;
        }
        Ok(())
    }

    fn enforce_limit(&mut self, limit: usize) -> Result<(), ClipflowError> {
        if limit == 0 {
            return Ok(());
        }

        self.conn.execute(
            "DELETE FROM clips
             WHERE deleted_at IS NULL
             AND id NOT IN (
                SELECT id FROM clips WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?1
             )",
            params![limit as i64],
        )?;
        Ok(())
    }

    fn enforce_retention(&mut self, retention_days: u32) -> Result<(), ClipflowError> {
        if retention_days == 0 {
            return Ok(());
        }

        let cutoff = (Utc::now() - Duration::days(i64::from(retention_days)))
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        self.conn.execute(
            "DELETE FROM clips WHERE deleted_at IS NULL AND created_at < ?1",
            params![cutoff],
        )?;
        Ok(())
    }

    fn enforce_trash_retention(&mut self, retention_days: u32) -> Result<(), ClipflowError> {
        let retention_days = normalize_trash_retention_days(retention_days);

        let cutoff = (Utc::now() - Duration::days(i64::from(retention_days)))
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        self.conn.execute(
            "DELETE FROM clips WHERE deleted_at IS NOT NULL AND deleted_at < ?1",
            params![cutoff],
        )?;
        Ok(())
    }

    fn enforce_history_policy(&mut self, settings: &Settings) -> Result<(), ClipflowError> {
        self.enforce_retention(settings.retention_days)?;
        self.enforce_limit(settings.history_limit)?;
        self.enforce_trash_retention(settings.trash_retention_days)
    }

    fn get_clip_by_hash(&self, hash: &str) -> Result<ClipItem, ClipflowError> {
        self.conn
            .query_row(
                &format!("SELECT {CLIP_COLUMNS} FROM clips WHERE content_hash = ?1"),
                params![hash],
                row_to_clip,
            )
            .map_err(ClipflowError::from)
    }

    fn existing_clip_by_hash(&self, hash: &str) -> Result<Option<ExistingClip>, ClipflowError> {
        self.conn
            .query_row(
                "SELECT id, deleted_at FROM clips WHERE content_hash = ?1",
                params![hash],
                |row| {
                    Ok(ExistingClip {
                        id: row.get(0)?,
                        deleted_at: row.get(1)?,
                    })
                },
            )
            .optional()
            .map_err(ClipflowError::from)
    }
}

pub fn normalize_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn preview(value: &str, max_length: usize) -> String {
    let normalized = normalize_text(value);
    let char_count = normalized.chars().count();
    if char_count <= max_length {
        return normalized;
    }

    let take_count = max_length.saturating_sub(1);
    format!(
        "{}…",
        normalized.chars().take(take_count).collect::<String>()
    )
}

pub fn classify_text(value: &str) -> ClipKind {
    if is_likely_file_list(value) {
        return ClipKind::File;
    }

    let lower = value.to_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") {
        return ClipKind::Link;
    }

    if [
        "cargo ", "npm ", "pnpm ", "git ", "winget ", "rustup ", "node ",
    ]
    .iter()
    .any(|prefix| lower.starts_with(prefix))
        || value.contains("--")
        || value.contains("=>")
        || value.contains("::")
    {
        return ClipKind::Code;
    }

    ClipKind::Text
}

fn content_hash(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn content_hash_bytes(kind: &str, width: u32, height: u32, bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(kind.as_bytes());
    hasher.update(width.to_le_bytes());
    hasher.update(height.to_le_bytes());
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn preview_for_clip(
    kind: ClipKind,
    text: &str,
    file_paths: &[String],
    image_size: Option<(u32, u32)>,
) -> String {
    match kind {
        ClipKind::File => file_preview(file_paths),
        ClipKind::Image => image_size
            .map(|(width, height)| format!("图片 {width} × {height}"))
            .unwrap_or_else(|| "图片".to_string()),
        ClipKind::RichText => preview(text, 96),
        _ => preview(text, 96),
    }
}

fn file_preview(file_paths: &[String]) -> String {
    let names = file_paths
        .iter()
        .take(2)
        .map(|path| {
            Path::new(path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(path)
                .to_string()
        })
        .collect::<Vec<_>>();
    let suffix = if file_paths.len() > 2 { "…" } else { "" };
    format!(
        "{} 个文件 · {}{}",
        file_paths.len(),
        names.join(", "),
        suffix
    )
}

fn parse_file_paths(value: &str) -> Vec<String> {
    value
        .split('\n')
        .flat_map(|line| line.split(';'))
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn serialize_file_paths(paths: &[String]) -> Result<String, ClipflowError> {
    serde_json::to_string(paths).map_err(|_| ClipflowError::DataDirectoryUnavailable)
}

fn deserialize_file_paths(value: Option<String>) -> Vec<String> {
    value
        .and_then(|paths| serde_json::from_str::<Vec<String>>(&paths).ok())
        .unwrap_or_default()
}

fn optional_count(count: usize) -> Option<u32> {
    if count == 0 {
        None
    } else {
        Some(count as u32)
    }
}

fn source_app_name(source: &Option<SourceAppInfo>) -> Option<&str> {
    source.as_ref().and_then(|value| value.name.as_deref())
}

fn source_app_icon(source: &Option<SourceAppInfo>) -> Option<&str> {
    source.as_ref().and_then(|value| value.icon.as_deref())
}

fn source_app_path(source: &Option<SourceAppInfo>) -> Option<&str> {
    source.as_ref().and_then(|value| value.path.as_deref())
}

fn normalize_trash_retention_days(value: u32) -> u32 {
    value.clamp(1, 30)
}

fn is_likely_file_list(value: &str) -> bool {
    let paths = parse_file_paths(value);
    !paths.is_empty() && paths.iter().all(|path| is_likely_file_path(path))
}

fn is_likely_file_path(value: &str) -> bool {
    let lower = value.to_lowercase();
    let has_drive = value
        .chars()
        .nth(1)
        .map(|character| character == ':')
        .unwrap_or(false)
        && (value.contains('\\') || value.contains('/'));
    let has_unc = value.starts_with("\\\\");
    let has_unix = value.starts_with('/') && value.matches('/').count() >= 2;
    let has_known_extension = [
        ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf", ".docx", ".xlsx", ".pptx",
        ".txt", ".md", ".zip", ".rar", ".7z", ".mp4", ".mov", ".mp3", ".wav", ".rs", ".ts", ".tsx",
        ".js", ".json",
    ]
    .iter()
    .any(|extension| lower.ends_with(extension));
    (has_drive || has_unc || has_unix) && has_known_extension
}

fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn row_to_clip(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClipItem> {
    let kind: String = row.get(3)?;
    Ok(ClipItem {
        id: row.get(0)?,
        text: row.get(1)?,
        preview: row.get(2)?,
        kind: db_to_kind(&kind),
        content_hash: row.get(4)?,
        created_at: row.get(5)?,
        last_used_at: row.get(6)?,
        use_count: row.get::<_, u32>(7)?,
        image_width: row.get(8)?,
        image_height: row.get(9)?,
        file_count: row.get(10)?,
        file_paths: deserialize_file_paths(row.get(11)?),
        image_bytes: row.get(12)?,
        is_favorite: row.get::<_, i64>(13)? == 1,
        source_app_name: row.get(14)?,
        source_app_icon: row.get(15)?,
        source_app_path: row.get(16)?,
        rich_html: row.get(17)?,
        deleted_at: row.get(18)?,
    })
}

fn kind_to_db(kind: ClipKind) -> &'static str {
    match kind {
        ClipKind::Text => "text",
        ClipKind::Link => "link",
        ClipKind::Code => "code",
        ClipKind::Image => "image",
        ClipKind::File => "file",
        ClipKind::RichText => "richText",
    }
}

fn db_to_kind(value: &str) -> ClipKind {
    match value {
        "link" => ClipKind::Link,
        "code" => ClipKind::Code,
        "image" => ClipKind::Image,
        "file" => ClipKind::File,
        "richText" => ClipKind::RichText,
        _ => ClipKind::Text,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{MotionPreset, OptionalClipFilter, SettingsPatch};

    #[test]
    fn ignores_blank_text() {
        let mut store = ClipStore::in_memory().expect("store");

        let result = store.add_text(" \n\t ").expect("add text");

        assert!(result.is_none());
        assert!(store.list(None, ClipFilter::All).expect("list").is_empty());
    }

    #[test]
    fn normalizes_classifies_and_previews_text() {
        let mut store = ClipStore::in_memory().expect("store");

        let item = store
            .add_text("  cargo   tauri   dev --target x86_64-pc-windows-msvc ")
            .expect("add text")
            .expect("item");

        assert_eq!("cargo tauri dev --target x86_64-pc-windows-msvc", item.text);
        assert_eq!(ClipKind::Code, item.kind);
        assert_eq!(item.text, item.preview);
    }

    #[test]
    fn deduplicates_by_normalized_text_hash() {
        let mut store = ClipStore::in_memory().expect("store");

        let first = store.add_text("hello world").expect("first").expect("item");
        let second = store.add_text(" hello   world ").expect("second");
        let items = store.list(None, ClipFilter::All).expect("list");

        assert!(second.is_none());
        assert_eq!(1, items.len());
        assert_eq!(first.id, items[0].id);
    }

    #[test]
    fn duplicate_active_text_preserves_original_created_at_and_does_not_reinsert() {
        let mut store = ClipStore::in_memory().expect("store");

        let first = store.add_text("hello world").expect("first").expect("item");
        store
            .conn
            .execute(
                "UPDATE clips SET created_at = ?1 WHERE id = ?2",
                params!["2026-05-02T10:00:00.000Z", first.id],
            )
            .expect("set created_at");

        let duplicate = store.add_text(" hello   world ").expect("duplicate");
        let items = store.list(None, ClipFilter::All).expect("list");

        assert!(duplicate.is_none());
        assert_eq!(1, items.len());
        assert_eq!("2026-05-02T10:00:00.000Z", items[0].created_at);
    }

    #[test]
    fn duplicate_deleted_text_restores_existing_clip_without_creating_another_row() {
        let mut store = ClipStore::in_memory().expect("store");

        let first = store.add_text("restore me").expect("first").expect("item");
        store
            .conn
            .execute(
                "UPDATE clips SET created_at = ?1 WHERE id = ?2",
                params!["2026-05-02T10:00:00.000Z", first.id],
            )
            .expect("set created_at");
        store.delete(&first.id).expect("delete");

        let restored = store
            .add_text("restore me")
            .expect("restore")
            .expect("item");
        let items = store.list(None, ClipFilter::All).expect("active list");

        assert_eq!(first.id, restored.id);
        assert_eq!(1, items.len());
        assert_eq!("2026-05-02T10:00:00.000Z", restored.created_at);
        assert!(restored.deleted_at.is_none());
    }

    #[test]
    fn enforces_history_limit_after_insert() {
        let mut store = ClipStore::in_memory().expect("store");
        store
            .update_settings(SettingsPatch {
                history_limit: Some(10),
                ..SettingsPatch::default()
            })
            .expect("settings");

        for index in 0..12 {
            store.add_text(&format!("clip {index}")).expect("add");
        }

        assert_eq!(10, store.list(None, ClipFilter::All).expect("list").len());
    }

    #[test]
    fn zero_history_limit_keeps_all_items() {
        let mut store = ClipStore::in_memory().expect("store");
        store
            .update_settings(SettingsPatch {
                history_limit: Some(0),
                ..SettingsPatch::default()
            })
            .expect("settings");

        for index in 0..12 {
            store.add_text(&format!("clip {index}")).expect("add");
        }

        assert_eq!(12, store.list(None, ClipFilter::All).expect("list").len());
    }

    #[test]
    fn retention_days_zero_keeps_old_items() {
        let mut store = ClipStore::in_memory().expect("store");
        store.add_text("old clip").expect("add");
        store
            .conn
            .execute(
                "UPDATE clips SET created_at = ?1",
                params!["2000-01-01T00:00:00.000Z"],
            )
            .expect("age clip");

        store
            .update_settings(SettingsPatch {
                retention_days: Some(0),
                ..SettingsPatch::default()
            })
            .expect("settings");

        assert_eq!(1, store.list(None, ClipFilter::All).expect("list").len());
    }

    #[test]
    fn trash_retention_days_zero_is_normalized_to_one_day() {
        let mut store = ClipStore::in_memory().expect("store");
        let item = store.add_text("old trash").expect("add").expect("item");
        store.delete(&item.id).expect("delete");
        store
            .conn
            .execute(
                "UPDATE clips SET deleted_at = ?1 WHERE id = ?2",
                params!["2000-01-01T00:00:00.000Z", item.id],
            )
            .expect("age trash");

        let settings = store
            .update_settings(SettingsPatch {
                trash_retention_days: Some(0),
                ..SettingsPatch::default()
            })
            .expect("settings");

        assert_eq!(1, settings.trash_retention_days);
        assert!(store
            .list(None, ClipFilter::Trash)
            .expect("trash")
            .is_empty());
    }

    #[test]
    fn trash_retention_days_above_thirty_is_normalized() {
        let mut store = ClipStore::in_memory().expect("store");

        let settings = store
            .update_settings(SettingsPatch {
                trash_retention_days: Some(60),
                ..SettingsPatch::default()
            })
            .expect("settings");

        assert_eq!(30, settings.trash_retention_days);
        assert_eq!(
            30,
            store
                .settings()
                .expect("stored settings")
                .trash_retention_days
        );
    }

    #[test]
    fn legacy_zero_trash_retention_days_is_read_as_one_day() {
        let store = ClipStore::in_memory().expect("store");
        let mut settings = Settings::default();
        settings.trash_retention_days = 0;
        let serialized = serde_json::to_string(&settings).expect("serialize settings");
        store
            .conn
            .execute(
                "INSERT INTO settings (key, value) VALUES ('app', ?1)",
                params![serialized],
            )
            .expect("insert settings");

        assert_eq!(1, store.settings().expect("settings").trash_retention_days);
    }

    #[test]
    fn searches_and_filters_by_kind() {
        let mut store = ClipStore::in_memory().expect("store");
        store.add_text("https://tauri.app").expect("link");
        store.add_text("cargo tauri dev").expect("code");
        store.add_text("Material expressive design").expect("text");

        let search = store.list(Some("TAURI"), ClipFilter::All).expect("search");
        let links = store.list(None, ClipFilter::Link).expect("links");
        let code = store.list(None, ClipFilter::Code).expect("code");

        assert_eq!(2, search.len());
        assert_eq!(1, links.len());
        assert_eq!(ClipKind::Link, links[0].kind);
        assert_eq!(1, code.len());
        assert_eq!(ClipKind::Code, code[0].kind);
    }

    #[test]
    fn stores_and_filters_image_items() {
        let mut store = ClipStore::in_memory().expect("store");

        let item = store
            .add_image(2, 2, vec![255; 16])
            .expect("add image")
            .expect("item");
        let images = store.list(None, ClipFilter::Image).expect("images");

        assert_eq!(ClipKind::Image, item.kind);
        assert_eq!(Some(2), item.image_width);
        assert_eq!(Some(2), item.image_height);
        assert_eq!(Some(vec![255; 16]), item.image_bytes);
        assert_eq!(
            vec![item.id],
            images.into_iter().map(|clip| clip.id).collect::<Vec<_>>()
        );
    }

    #[test]
    fn stores_and_filters_file_items() {
        let mut store = ClipStore::in_memory().expect("store");
        let paths = vec![
            PathBuf::from("C:\\Users\\jiangbeichen\\Pictures\\a.png"),
            PathBuf::from("C:\\Users\\jiangbeichen\\Documents\\b.pdf"),
        ];

        let item = store.add_files(&paths).expect("add files").expect("item");
        let files = store.list(Some("b.pdf"), ClipFilter::File).expect("files");

        assert_eq!(ClipKind::File, item.kind);
        assert_eq!(Some(2), item.file_count);
        assert_eq!(2, item.file_paths.len());
        assert_eq!(
            vec![item.id],
            files.into_iter().map(|clip| clip.id).collect::<Vec<_>>()
        );
    }

    #[test]
    fn toggles_and_filters_favorite_items() {
        let mut store = ClipStore::in_memory().expect("store");
        let item = store.add_text("favorite clip").expect("add").expect("item");

        let favorited = store.toggle_favorite(&item.id).expect("favorite");
        let favorites = store.list(None, ClipFilter::Favorite).expect("favorites");

        assert!(favorited.is_favorite);
        assert_eq!(
            vec![item.id.clone()],
            favorites
                .into_iter()
                .map(|clip| clip.id)
                .collect::<Vec<_>>()
        );

        let unfavorited = store.toggle_favorite(&item.id).expect("unfavorite");
        assert!(!unfavorited.is_favorite);
        assert!(store
            .list(None, ClipFilter::Favorite)
            .expect("favorites")
            .is_empty());
    }

    #[test]
    fn moves_deleted_items_to_trash_and_restores_them() {
        let mut store = ClipStore::in_memory().expect("store");
        let item = store.add_text("trash me").expect("add").expect("item");

        store.delete(&item.id).expect("delete");
        let trashed = store.list(None, ClipFilter::Trash).expect("trash");

        assert_eq!(
            vec![item.id.clone()],
            trashed
                .iter()
                .map(|clip| clip.id.clone())
                .collect::<Vec<_>>()
        );
        assert!(trashed[0].deleted_at.is_some());

        let restored = store.restore(&item.id).expect("restore");
        assert!(restored.deleted_at.is_none());
        assert!(store
            .list(None, ClipFilter::Trash)
            .expect("trash")
            .is_empty());
    }

    #[test]
    fn stores_and_filters_rich_text_items() {
        let mut store = ClipStore::in_memory().expect("store");

        let item = store
            .add_rich_text_with_source("Hello world", "<b>Hello</b> <i>world</i>", None)
            .expect("add rich")
            .expect("item");
        let rich = store.list(None, ClipFilter::RichText).expect("rich");

        assert_eq!(ClipKind::RichText, item.kind);
        assert_eq!(
            Some("<b>Hello</b> <i>world</i>".to_string()),
            item.rich_html
        );
        assert_eq!(
            vec![item.id],
            rich.into_iter().map(|clip| clip.id).collect::<Vec<_>>()
        );
    }

    #[test]
    fn marks_clip_as_recently_used() {
        let mut store = ClipStore::in_memory().expect("store");
        let item = store.add_text("copy me").expect("add").expect("item");

        let used = store.mark_used(&item.id).expect("mark");
        let recent = store.list(None, ClipFilter::Recent).expect("recent");

        assert_eq!(1, used.use_count);
        assert!(used.last_used_at.is_some());
        assert_eq!(
            vec![used.id],
            recent.into_iter().map(|clip| clip.id).collect::<Vec<_>>()
        );
    }

    #[test]
    fn pause_setting_prevents_capture() {
        let mut store = ClipStore::in_memory().expect("store");
        store
            .update_settings(SettingsPatch {
                capture_paused: Some(true),
                ..SettingsPatch::default()
            })
            .expect("settings");

        let result = store.add_text("secret token").expect("add");

        assert!(result.is_none());
        assert!(store.list(None, ClipFilter::All).expect("list").is_empty());
    }

    #[test]
    fn persists_optional_filter_settings() {
        let mut store = ClipStore::in_memory().expect("store");

        let settings = store
            .update_settings(SettingsPatch {
                optional_filters: Some(vec![
                    OptionalClipFilter::Link,
                    OptionalClipFilter::RichText,
                    OptionalClipFilter::Trash,
                ]),
                ..SettingsPatch::default()
            })
            .expect("settings");

        assert_eq!(
            vec![
                OptionalClipFilter::Link,
                OptionalClipFilter::RichText,
                OptionalClipFilter::Trash
            ],
            settings.optional_filters
        );
        assert_eq!(
            settings.optional_filters,
            store.settings().expect("stored settings").optional_filters
        );
    }

    #[test]
    fn persists_icon_visibility_settings() {
        let mut store = ClipStore::in_memory().expect("store");

        let hidden_settings = store
            .update_settings(SettingsPatch {
                show_tray_icon: Some(false),
                show_taskbar_icon: Some(false),
                ..SettingsPatch::default()
            })
            .expect("hide icons");

        assert!(!hidden_settings.show_tray_icon);
        assert!(!hidden_settings.show_taskbar_icon);
        assert!(!store.settings().expect("stored hidden").show_tray_icon);
        assert!(!store.settings().expect("stored hidden").show_taskbar_icon);

        let visible_settings = store
            .update_settings(SettingsPatch {
                show_tray_icon: Some(true),
                show_taskbar_icon: Some(true),
                ..SettingsPatch::default()
            })
            .expect("show icons");

        assert!(visible_settings.show_tray_icon);
        assert!(visible_settings.show_taskbar_icon);
        assert!(store.settings().expect("stored visible").show_tray_icon);
        assert!(store.settings().expect("stored visible").show_taskbar_icon);
    }

    #[test]
    fn persists_motion_preset_settings() {
        let mut store = ClipStore::in_memory().expect("store");

        let settings = store
            .update_settings(SettingsPatch {
                motion_preset: Some(MotionPreset::D),
                ..SettingsPatch::default()
            })
            .expect("motion preset");

        assert_eq!(MotionPreset::D, settings.motion_preset);
        assert_eq!(
            MotionPreset::D,
            store.settings().expect("stored settings").motion_preset
        );
    }
}
