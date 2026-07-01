use bip39::{Language, Mnemonic};

#[derive(Debug, thiserror::Error)]
pub enum SeedError {
    #[error("invalid mnemonic: {0}")]
    InvalidMnemonic(String),
    #[error("invalid word count: {0}")]
    InvalidWordCount(usize),
}

/// Generate a new BIP39 mnemonic with the given word count (12 or 24).
pub fn generate_mnemonic(word_count: usize) -> Result<Mnemonic, SeedError> {
    if word_count != 12 && word_count != 24 {
        return Err(SeedError::InvalidWordCount(word_count));
    }

    Mnemonic::generate_in(Language::English, word_count)
        .map_err(|e| SeedError::InvalidMnemonic(e.to_string()))
}

/// Validate a BIP39 mnemonic phrase.
pub fn validate_mnemonic(phrase: &str) -> Result<Mnemonic, SeedError> {
    Mnemonic::parse_normalized(phrase).map_err(|e| SeedError::InvalidMnemonic(e.to_string()))
}

/// Extract seed bytes (64 bytes) from a mnemonic and optional passphrase.
/// The returned bytes are zeroized on drop.
#[allow(dead_code)]
pub fn mnemonic_to_seed(
    mnemonic: &Mnemonic,
    passphrase: Option<&str>,
) -> zeroize::Zeroizing<Vec<u8>> {
    let passphrase = passphrase.unwrap_or("");
    let seed = mnemonic.to_seed(passphrase);
    zeroize::Zeroizing::new(seed.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_validate() {
        let mnemonic = generate_mnemonic(12).unwrap();
        let phrase = mnemonic.to_string();
        let validated = validate_mnemonic(&phrase).unwrap();
        assert_eq!(phrase, validated.to_string());
    }

    #[test]
    fn test_invalid_word_count() {
        assert!(generate_mnemonic(15).is_err());
    }

    #[test]
    fn test_invalid_phrase() {
        assert!(validate_mnemonic("this is not a valid seed phrase").is_err());
    }

    #[test]
    fn test_generate_24_words() {
        let mnemonic = generate_mnemonic(24).unwrap();
        assert_eq!(mnemonic.words().count(), 24);
    }

    #[test]
    fn test_mnemonic_to_seed_with_passphrase() {
        let phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mnemonic = validate_mnemonic(phrase).unwrap();
        let seed = mnemonic_to_seed(&mnemonic, Some("secret"));
        assert_eq!(seed.len(), 64);

        let seed_no_pass = mnemonic_to_seed(&mnemonic, None);
        assert_ne!(seed.as_slice(), seed_no_pass.as_slice());
    }

    #[test]
    fn test_invalid_checksum() {
        // Valid words but last word changed to break checksum.
        let phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon zebra";
        assert!(matches!(
            validate_mnemonic(phrase),
            Err(SeedError::InvalidMnemonic(_))
        ));
    }
}
