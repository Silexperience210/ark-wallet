//! Arkade-format Ark address encoder/decoder.
//!
//! Arkade uses address version 0: a bech32m string encoding
//! `version || server_xonly_pubkey || p2tr_output_key`.
//! This is different from `bark-wallet`'s native policy address (version 1),
//! which carries an ArkId, VTXO policy and delivery information.

use bitcoin::bech32::{self, Bech32m, Hrp};

const HRP_MAINNET: &str = "ark";
const HRP_TESTNET: &str = "tark";
const VERSION: u8 = 0;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[allow(dead_code)]
pub enum ArkadeAddressError {
    #[error("bech32 encoding error: {0}")]
    Encode(#[from] bech32::EncodeError),
    #[error("bech32 decoding error: {0}")]
    Decode(#[from] bech32::DecodeError),
    #[error("invalid human-readable part: {0}")]
    InvalidHrp(String),
    #[error("invalid address version: expected {VERSION}, got {got}")]
    InvalidVersion { got: u8 },
    #[error("invalid address payload length: expected {expected}, got {got}")]
    InvalidLength { expected: usize, got: usize },
}

/// Encode an Arkade-format Ark address (version 0).
pub fn encode_arkade_address(
    testnet: bool,
    server_xonly: [u8; 32],
    output_key: [u8; 32],
) -> Result<String, ArkadeAddressError> {
    let hrp = if testnet { HRP_TESTNET } else { HRP_MAINNET };
    let hrp = Hrp::parse_unchecked(hrp);

    let mut data = Vec::with_capacity(1 + 32 + 32);
    data.push(VERSION);
    data.extend_from_slice(&server_xonly);
    data.extend_from_slice(&output_key);

    Ok(bech32::encode::<Bech32m>(hrp, &data)?)
}

/// Decode an Arkade-format Ark address (version 0).
#[allow(dead_code)]
pub fn decode_arkade_address(
    address: &str,
) -> Result<(bool, [u8; 32], [u8; 32]), ArkadeAddressError> {
    let (hrp, data) = bech32::decode(address)?;

    let testnet = if hrp.as_str() == HRP_MAINNET {
        false
    } else if hrp.as_str() == HRP_TESTNET {
        true
    } else {
        return Err(ArkadeAddressError::InvalidHrp(hrp.to_string()));
    };

    if data.is_empty() {
        return Err(ArkadeAddressError::InvalidLength {
            expected: 65,
            got: 0,
        });
    }

    if data[0] != VERSION {
        return Err(ArkadeAddressError::InvalidVersion { got: data[0] });
    }

    if data.len() != 65 {
        return Err(ArkadeAddressError::InvalidLength {
            expected: 65,
            got: data.len(),
        });
    }

    let mut server_xonly = [0u8; 32];
    let mut output_key = [0u8; 32];
    server_xonly.copy_from_slice(&data[1..33]);
    output_key.copy_from_slice(&data[33..65]);

    Ok((testnet, server_xonly, output_key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let server = [0x33u8; 32];
        let output = [0x44u8; 32];

        let mainnet = encode_arkade_address(false, server, output).unwrap();
        assert!(mainnet.starts_with("ark1q"));

        let (testnet_decoded, server_decoded, output_decoded) =
            decode_arkade_address(&mainnet).unwrap();
        assert!(!testnet_decoded);
        assert_eq!(server_decoded, server);
        assert_eq!(output_decoded, output);

        let testnet = encode_arkade_address(true, server, output).unwrap();
        assert!(testnet.starts_with("tark1q"));

        let (testnet_decoded, server_decoded, output_decoded) =
            decode_arkade_address(&testnet).unwrap();
        assert!(testnet_decoded);
        assert_eq!(server_decoded, server);
        assert_eq!(output_decoded, output);
    }

    #[test]
    fn matches_arkade_docs_example() {
        // Example from https://docs.arkadeos.com/wallets/getting-started/arkade-addresses
        let server_bytes =
            hex::decode("33ffb3dee353b1a9ebe4ced64b946238d0a4ac364f275d771da6ad2445d07ae0")
                .unwrap();
        let output_bytes =
            hex::decode("25a43cecfa0e1b1a4f72d64ad15f4cfa7a84d0723e8511c969aa543638ea9967")
                .unwrap();
        let mut server = [0u8; 32];
        let mut output = [0u8; 32];
        server.copy_from_slice(&server_bytes);
        output.copy_from_slice(&output_bytes);
        let expected = "ark1qqellv77udfmr20tun8dvju5vgudpf9vxe8jwhthrkn26fz96pawqfdy8nk05rsmrf8h94j26905e7n6sng8y059z8ykn2j5xcuw4xt8ngt9rw";
        assert_eq!(
            encode_arkade_address(false, server, output).unwrap(),
            expected
        );
    }
}
