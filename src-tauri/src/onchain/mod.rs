pub mod wallet;

pub use wallet::{
    create_wallet, get_balance, get_new_address, get_transaction_history, send_to_address,
    sync_wallet, OnchainTxSummary, SharedWallet,
};
