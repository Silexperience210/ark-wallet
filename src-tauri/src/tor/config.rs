use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Persistent configuration for the embedded Tor client.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TorConfig {
    /// Whether Tor should be used for tapd connections when applicable.
    pub enabled: bool,
    /// If set, force all tapd traffic through Tor, even for non-.onion hosts.
    pub force_tor: bool,
}

const TOR_CONFIG_FILE: &str = "tor-config.json";

impl TorConfig {
    pub fn load(app: &AppHandle) -> Result<Self, String> {
        let path = Self::path(app);
        if !path.exists() {
            return Ok(Self::default());
        }
        let text = std::fs::read_to_string(&path).map_err(|e| format!("read tor config: {e}"))?;
        serde_json::from_str(&text).map_err(|e| format!("parse tor config: {e}"))
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), String> {
        let path = Self::path(app);
        let text =
            serde_json::to_string_pretty(self).map_err(|e| format!("serialize tor config: {e}"))?;
        std::fs::write(&path, text).map_err(|e| format!("write tor config: {e}"))
    }

    fn path(app: &AppHandle) -> PathBuf {
        app.path()
            .app_local_data_dir()
            .expect("app_local_data_dir")
            .join(TOR_CONFIG_FILE)
    }
}
