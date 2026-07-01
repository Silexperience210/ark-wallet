use std::path::PathBuf;

use tauri::{AppHandle, Manager};

/// User-configurable ARK Service Provider settings.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ArkConfig {
    pub server_address: String,
    pub esplora_address: Option<String>,
    pub server_access_token: Option<String>,
    pub network: String,
}

impl Default for ArkConfig {
    fn default() -> Self {
        Self::bitcoin_default()
    }
}

impl ArkConfig {
    /// Default Signet ASP used during early development.
    pub fn signet_default() -> Self {
        Self {
            server_address: "https://ark.signet.2nd.dev".into(),
            esplora_address: Some("https://esplora.signet.2nd.dev".into()),
            server_access_token: None,
            network: "signet".into(),
        }
    }

    /// Second's public Bitcoin mainnet ASP (launched 2026-06-09).
    pub fn bitcoin_default() -> Self {
        Self {
            server_address: "https://ark.second.tech".into(),
            esplora_address: Some("https://mempool.second.tech/api".into()),
            server_access_token: None,
            network: "bitcoin".into(),
        }
    }
}

fn config_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_local_data_dir()
        .map(|p| p.join("ark-config.json"))
        .map_err(|e| e.to_string())
}

/// Load saved ASP config, or return the Signet default if none exists.
pub fn load_ark_config(app_handle: &AppHandle) -> Result<ArkConfig, String> {
    let path = config_path(app_handle)?;
    if !path.exists() {
        return Ok(ArkConfig::default());
    }
    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(config)
}

/// Persist ASP config.
pub fn save_ark_config(app_handle: &AppHandle, config: &ArkConfig) -> Result<(), String> {
    let path = config_path(app_handle)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_mainnet() {
        let cfg = ArkConfig::default();
        assert_eq!(cfg.network, "bitcoin");
        assert_eq!(cfg.server_address, "https://ark.second.tech");
        assert_eq!(
            cfg.esplora_address,
            Some("https://mempool.second.tech/api".to_string())
        );
    }

    #[test]
    fn bitcoin_default_uses_second_mainnet() {
        let cfg = ArkConfig::bitcoin_default();
        assert_eq!(cfg.network, "bitcoin");
        assert_eq!(cfg.server_address, "https://ark.second.tech");
        assert_eq!(
            cfg.esplora_address,
            Some("https://mempool.second.tech/api".to_string())
        );
    }
}
