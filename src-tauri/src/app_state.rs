use crate::error::ClipflowError;
use crate::history::ClipStore;
use directories::ProjectDirs;
use std::fs;
use std::sync::Mutex;

pub struct AppState {
    pub store: Mutex<ClipStore>,
}

impl AppState {
    fn new() -> Result<Self, ClipflowError> {
        let dirs = ProjectDirs::from("app", "ClipFlow", "ClipFlow")
            .ok_or(ClipflowError::DataDirectoryUnavailable)?;
        let data_dir = dirs.data_local_dir();
        fs::create_dir_all(data_dir)?;
        let store = ClipStore::open(data_dir.join("clipflow.sqlite3"))?;

        Ok(Self {
            store: Mutex::new(store),
        })
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            store: Mutex::new(ClipStore::in_memory().expect("in-memory store")),
        })
    }
}
