use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ClipflowError {
    #[error("clipboard is unavailable")]
    ClipboardUnavailable,
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("data directory is unavailable")]
    DataDirectoryUnavailable,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("state lock is poisoned")]
    StatePoisoned,
    #[error("clip not found: {0}")]
    ClipNotFound(String),
    #[error("clip content cannot be empty")]
    EmptyClipContent,
    #[error("paste automation failed")]
    PasteAutomationFailed,
    #[error("startup setting failed: {0}")]
    StartupSettingFailed(String),
    #[error("shortcut registration failed: {0}")]
    ShortcutRegistrationFailed(String),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub message: String,
}

impl From<ClipflowError> for CommandError {
    fn from(value: ClipflowError) -> Self {
        Self {
            message: value.to_string(),
        }
    }
}

impl From<arboard::Error> for ClipflowError {
    fn from(_: arboard::Error) -> Self {
        Self::ClipboardUnavailable
    }
}
