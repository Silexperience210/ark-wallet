pub mod seed;
pub mod vault;

pub use seed::{generate_mnemonic, validate_mnemonic};
pub use vault::{
    change_password, create_wallet, delete_wallet, generate_wallet, get_mnemonic, has_wallet,
    load_secret, store_secret, unlock_and_get_mnemonic, VaultError,
};
