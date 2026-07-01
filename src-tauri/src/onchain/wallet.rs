use std::path::Path;
use std::str::FromStr;
use std::sync::Arc;

use bdk_esplora::esplora_client;
use bdk_esplora::EsploraAsyncExt;
use bdk_wallet::chain::ChainPosition;
use bdk_wallet::rusqlite::Connection;
use bdk_wallet::template::{Bip84, DescriptorTemplate};
use bdk_wallet::{KeychainKind, PersistedWallet, Wallet, WalletPersister};
use bitcoin::bip32::Xpriv;
use bitcoin::{Address, Amount, FeeRate, Network, NetworkKind};

use crate::wallet::seed::validate_mnemonic;

#[derive(Debug, Clone, serde::Serialize)]
pub struct OnchainTxSummary {
    pub txid: String,
    pub amount_sats: i64,
    pub kind: String,
    pub confirmations: Option<u32>,
    pub timestamp: Option<u64>,
}

#[derive(Debug, thiserror::Error)]
pub enum OnchainError {
    #[error("invalid mnemonic: {0}")]
    InvalidMnemonic(String),
    #[error("bdk error: {0}")]
    Bdk(String),
    #[error("bitcoin error: {0}")]
    Bitcoin(String),
    #[error("esplora error: {0}")]
    Esplora(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub type SharedWallet = Arc<tokio::sync::Mutex<PersistedWallet<Connection>>>;

fn build_descriptors(
    mnemonic: &str,
    passphrase: Option<&str>,
    network: Network,
) -> Result<
    (
        bdk_wallet::descriptor::ExtendedDescriptor,
        bdk_wallet::miniscript::descriptor::KeyMap,
        bdk_wallet::descriptor::ExtendedDescriptor,
        bdk_wallet::miniscript::descriptor::KeyMap,
    ),
    OnchainError,
> {
    let mnemonic =
        validate_mnemonic(mnemonic).map_err(|e| OnchainError::InvalidMnemonic(e.to_string()))?;
    let seed = mnemonic.to_seed(passphrase.unwrap_or(""));
    let xprv =
        Xpriv::new_master(network, &seed).map_err(|e| OnchainError::Bitcoin(e.to_string()))?;

    let network_kind = NetworkKind::from(network);
    let (descriptor, descriptor_keymap, _) = Bip84(xprv, KeychainKind::External)
        .build(network_kind)
        .map_err(|e| OnchainError::Bdk(e.to_string()))?;
    let (change_descriptor, change_keymap, _) = Bip84(xprv, KeychainKind::Internal)
        .build(network_kind)
        .map_err(|e| OnchainError::Bdk(e.to_string()))?;

    Ok((
        descriptor,
        descriptor_keymap,
        change_descriptor,
        change_keymap,
    ))
}

/// Persist any staged changes of an in-memory wallet to the SQLite store.
///
/// This should be called after operations that mutate the wallet's internal state
/// (address derivation, sync, transaction creation).
pub fn persist_wallet(
    wallet: &mut PersistedWallet<Connection>,
    db_path: &Path,
) -> Result<(), OnchainError> {
    if db_path.parent().is_some() && !db_path.parent().unwrap().exists() {
        std::fs::create_dir_all(db_path.parent().unwrap())?;
    }
    let mut conn = Connection::open(db_path).map_err(|e| OnchainError::Bdk(e.to_string()))?;
    // Initialize schema and load any existing changeset (ignored here).
    let _ = Connection::initialize(&mut conn).map_err(|e| OnchainError::Bdk(e.to_string()))?;
    if let Some(changeset) = wallet.take_staged() {
        Connection::persist(&mut conn, &changeset).map_err(|e| OnchainError::Bdk(e.to_string()))?;
    }
    Ok(())
}

/// Create or load a persisted BIP84 SegWit wallet from a BIP39 mnemonic.
///
/// If a SQLite database already exists at `db_path`, the wallet is loaded from it
/// so that address indexes and UTXOs survive application restarts.
pub fn create_wallet(
    mnemonic: &str,
    passphrase: Option<&str>,
    network: Network,
    db_path: &Path,
) -> Result<PersistedWallet<Connection>, OnchainError> {
    let (descriptor, descriptor_keymap, change_descriptor, change_keymap) =
        build_descriptors(mnemonic, passphrase, network)?;

    if db_path.parent().is_some() && !db_path.parent().unwrap().exists() {
        std::fs::create_dir_all(db_path.parent().unwrap())?;
    }
    let mut conn = Connection::open(db_path).map_err(|e| OnchainError::Bdk(e.to_string()))?;

    // Try to load an existing persisted wallet first.
    let loaded = Wallet::load()
        .descriptor(KeychainKind::External, Some(descriptor.to_string()))
        .descriptor(KeychainKind::Internal, Some(change_descriptor.to_string()))
        .extract_keys()
        .check_network(network)
        .load_wallet(&mut conn)
        .map_err(|e| OnchainError::Bdk(e.to_string()))?;

    if let Some(wallet) = loaded {
        return Ok(wallet);
    }

    // No existing wallet: create a fresh one and persist the initial changeset.
    let wallet = Wallet::create(descriptor, change_descriptor)
        .network(network)
        .keymap(KeychainKind::External, descriptor_keymap)
        .keymap(KeychainKind::Internal, change_keymap)
        .create_wallet(&mut conn)
        .map_err(|e| OnchainError::Bdk(e.to_string()))?;

    Ok(wallet)
}

/// Return the next *unused* receiving address and persist the index.
///
/// Uses `next_unused_address` rather than always revealing a fresh one: if the
/// current address has not yet received funds it is returned again, so rapid
/// double-clicks no longer burn through (and skip) BIP32 indexes. A new index is
/// only revealed once the previous address has been used on-chain.
pub async fn get_new_address(
    wallet: &SharedWallet,
    db_path: &Path,
) -> Result<String, OnchainError> {
    let mut wallet = wallet.lock().await;
    let address_info = wallet.next_unused_address(KeychainKind::External);
    persist_wallet(&mut wallet, db_path)?;
    Ok(address_info.address.to_string())
}

/// Get the wallet's current balance.
pub async fn get_balance(wallet: &SharedWallet) -> Result<bdk_wallet::Balance, OnchainError> {
    let wallet = wallet.lock().await;
    Ok(wallet.balance())
}

/// Ordered list of Esplora endpoints to try for a given network. The first that
/// responds is used; the rest act as fallbacks so a single provider outage does
/// not make the wallet inoperant.
pub fn esplora_endpoints(network: Network) -> Vec<&'static str> {
    match network {
        Network::Bitcoin => vec![
            "https://blockstream.info/api",
            "https://mempool.space/api",
        ],
        Network::Testnet => vec![
            "https://blockstream.info/testnet/api",
            "https://mempool.space/testnet/api",
        ],
        Network::Signet => vec![
            "https://mutinynet.com/api",
            "https://mempool.space/signet/api",
        ],
        Network::Regtest => vec!["http://localhost:3002"],
        _ => vec!["https://mutinynet.com/api"],
    }
}

/// Build an Esplora client for a specific endpoint URL.
pub fn esplora_client_for(url: &str) -> Result<esplora_client::AsyncClient, OnchainError> {
    esplora_client::Builder::new(url)
        .build_async()
        .map_err(|e| OnchainError::Esplora(e.to_string()))
}

/// Create an Esplora client for the given network (first/primary endpoint).
#[allow(dead_code)]
pub fn esplora_client(network: Network) -> Result<esplora_client::AsyncClient, OnchainError> {
    let url = esplora_endpoints(network)
        .into_iter()
        .next()
        .ok_or_else(|| OnchainError::Esplora("no esplora endpoint configured".into()))?;
    esplora_client_for(url)
}

/// Sync the wallet with Esplora and persist the resulting changes. Tries each
/// endpoint in turn so a single provider being down does not break syncing.
pub async fn sync_wallet(wallet: &SharedWallet, db_path: &Path) -> Result<(), OnchainError> {
    let network = {
        let wallet = wallet.lock().await;
        wallet.network()
    };

    let endpoints = esplora_endpoints(network);
    let mut last_err: Option<OnchainError> = None;

    for url in &endpoints {
        let client = match esplora_client_for(url) {
            Ok(c) => c,
            Err(e) => {
                last_err = Some(e);
                continue;
            }
        };

        // Rebuild the scan request per attempt (full_scan consumes it).
        let request = {
            let wallet = wallet.lock().await;
            wallet.start_full_scan()
        };

        match client.full_scan(request, 5, 1).await {
            Ok(response) => {
                let mut wallet = wallet.lock().await;
                wallet
                    .apply_update(response)
                    .map_err(|e| OnchainError::Bdk(e.to_string()))?;
                persist_wallet(&mut wallet, db_path)?;
                return Ok(());
            }
            Err(e) => {
                log::warn!("esplora sync via {url} failed: {e}");
                last_err = Some(OnchainError::Esplora(e.to_string()));
            }
        }
    }

    Err(last_err.unwrap_or_else(|| OnchainError::Esplora("no esplora endpoint available".into())))
}

/// Send on-chain sats to a Bitcoin address and persist the resulting changes.
pub async fn send_to_address(
    wallet: &SharedWallet,
    db_path: &Path,
    address: &str,
    amount_sats: u64,
    fee_rate: u64,
) -> Result<String, OnchainError> {
    let network = {
        let wallet = wallet.lock().await;
        wallet.network()
    };
    let address = Address::from_str(address)
        .map_err(|e| OnchainError::Bitcoin(e.to_string()))?
        .require_network(network)
        .map_err(|e| OnchainError::Bitcoin(e.to_string()))?;
    if amount_sats > Amount::MAX_MONEY.to_sat() {
        return Err(OnchainError::Bitcoin("amount exceeds maximum".into()));
    }
    let amount = Amount::from_sat(amount_sats);

    // Pre-flight balance check so the user gets a clear "insufficient funds"
    // message instead of a generic BDK coin-selection error. Fees are added on
    // top of `amount`, so this rejects the obvious case where the amount alone
    // already exceeds the spendable balance; build_tx still enforces amount+fee.
    {
        let wallet = wallet.lock().await;
        let available = wallet.balance().total();
        if amount > available {
            return Err(OnchainError::Bdk(format!(
                "insufficient funds: spendable {} sat is less than amount {} sat (plus fees)",
                available.to_sat(),
                amount_sats
            )));
        }
    }

    let mut psbt = {
        let mut wallet = wallet.lock().await;
        let mut builder = wallet.build_tx();
        let fee_rate = FeeRate::from_sat_per_vb(fee_rate)
            .ok_or_else(|| OnchainError::Bdk("invalid fee rate".into()))?;
        builder
            .add_recipient(address.script_pubkey(), amount)
            .fee_rate(fee_rate);
        builder
            .finish()
            .map_err(|e| OnchainError::Bdk(e.to_string()))?
    };

    {
        let wallet = wallet.lock().await;
        wallet
            .sign(&mut psbt, bdk_wallet::SignOptions::default())
            .map_err(|e| OnchainError::Bdk(e.to_string()))?;
    }

    let tx = psbt
        .extract_tx()
        .map_err(|e| OnchainError::Bdk(e.to_string()))?;
    let txid = tx.compute_txid().to_string();

    // Broadcast via the first endpoint that accepts the transaction.
    let mut broadcast_err: Option<String> = None;
    let mut broadcasted = false;
    for url in &esplora_endpoints(network) {
        let client = match esplora_client_for(url) {
            Ok(c) => c,
            Err(e) => {
                broadcast_err = Some(e.to_string());
                continue;
            }
        };
        match client.broadcast(&tx).await {
            Ok(_) => {
                broadcasted = true;
                break;
            }
            Err(e) => {
                log::warn!("esplora broadcast via {url} failed: {e}");
                broadcast_err = Some(e.to_string());
            }
        }
    }
    if !broadcasted {
        return Err(OnchainError::Esplora(
            broadcast_err.unwrap_or_else(|| "broadcast failed on all endpoints".into()),
        ));
    }

    {
        let mut wallet = wallet.lock().await;
        persist_wallet(&mut wallet, db_path)?;
    }

    Ok(txid)
}

/// Parse a Bitcoin address string.
#[allow(dead_code)]
pub fn parse_address(address: &str, network: Network) -> Result<Address, OnchainError> {
    Address::from_str(address)
        .map_err(|e| OnchainError::Bitcoin(e.to_string()))?
        .require_network(network)
        .map_err(|e| OnchainError::Bitcoin(e.to_string()))
}

/// List the wallet's on-chain transaction history.
pub async fn get_transaction_history(
    wallet: &SharedWallet,
) -> Result<Vec<OnchainTxSummary>, OnchainError> {
    let wallet = wallet.lock().await;
    let tip_height = wallet.local_chain().tip().height();

    let history: Vec<OnchainTxSummary> = wallet
        .transactions()
        .map(|tx| {
            let txid = tx.tx_node.compute_txid().to_string();

            let received: u64 = tx
                .tx_node
                .output
                .iter()
                .filter(|o| wallet.is_mine(o.script_pubkey.clone()))
                .map(|o| o.value.to_sat())
                .sum();

            let sent: u64 = tx
                .tx_node
                .input
                .iter()
                .filter_map(|i| {
                    wallet
                        .get_utxo(i.previous_output)
                        .map(|u| u.txout.value.to_sat())
                })
                .sum();

            let net = received as i64 - sent as i64;
            let kind = if net > 0 {
                "receive"
            } else if net < 0 {
                "send"
            } else {
                "self"
            };

            let (confirmations, timestamp) = match &tx.chain_position {
                ChainPosition::Confirmed { anchor, .. } => {
                    let confs = if tip_height >= anchor.block_id.height {
                        Some(tip_height - anchor.block_id.height + 1)
                    } else {
                        Some(0)
                    };
                    (confs, Some(anchor.confirmation_time))
                }
                ChainPosition::Unconfirmed { .. } => (Some(0), None),
            };

            OnchainTxSummary {
                txid,
                amount_sats: net,
                kind: kind.into(),
                confirmations,
                timestamp,
            }
        })
        .collect();

    Ok(history)
}

/// Validate an address belongs to the wallet's network.
#[allow(dead_code)]
pub fn validate_address(address: &str, network: Network) -> Result<bool, OnchainError> {
    match parse_address(address, network) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    const TEST_MNEMONIC: &str =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    fn tmp_db() -> PathBuf {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir()
            .join(format!("ark-onchain-test-{ts}"))
            .join("wallet.db")
    }

    #[test]
    fn test_create_wallet_persists_and_loads_address_index() {
        let db = tmp_db();

        // Create a fresh wallet and reveal the first receiving address.
        let mut wallet = create_wallet(TEST_MNEMONIC, None, Network::Signet, &db).unwrap();
        let first = wallet.reveal_next_address(KeychainKind::External);
        assert_eq!(first.index, 0);
        persist_wallet(&mut wallet, &db).unwrap();
        drop(wallet);

        // Re-open the same database: the previously revealed index must be restored.
        let mut wallet2 = create_wallet(TEST_MNEMONIC, None, Network::Signet, &db).unwrap();
        let next = wallet2.reveal_next_address(KeychainKind::External);
        assert_eq!(next.index, 1);

        // Cleanup.
        let _ = std::fs::remove_dir_all(db.parent().unwrap());
    }

    #[test]
    fn test_persist_wallet_idempotent_when_no_changes() {
        let db = tmp_db();
        let mut wallet = create_wallet(TEST_MNEMONIC, None, Network::Signet, &db).unwrap();
        persist_wallet(&mut wallet, &db).unwrap();
        persist_wallet(&mut wallet, &db).unwrap();
        let _ = std::fs::remove_dir_all(db.parent().unwrap());
    }
}
