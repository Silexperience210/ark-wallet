# Agent Guide — OZark Wallet

## Project

- Tauri 2 desktop/mobile wallet with a React 19 + Vite frontend and a Rust backend.
- Default network: Bitcoin mainnet.
- Mainnet ASP preset: `https://ark.second.tech` + Esplora `https://mempool.second.tech/api`.

## Safe commands

Run these from the repo root (`C:\Users\Silex\ark-wallet`) before committing:

```bash
# Frontend
npm ci
npx tsc --noEmit
npm run build

# Rust (from src-tauri/)
cd src-tauri
cargo fmt -- --check
cargo clippy --lib -- -D warnings
cargo check --lib
cargo test --lib
```

## Secrets

- **Never commit** `.env`, keystores (`.keystore`, `.jks`), macaroons, seeds, or ASP access tokens.
- The Android signing keystore lives at `C:\Users\Silex\.ozark-keystore\ozark-wallet.keystore`.
- The corresponding environment file lives at `C:\Users\Silex\.ozark-keystore\.env`. Use `.env.example` as a template.
- CI expects these secrets for signed release APKs:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

## Build notes

- `PROTOC` must point to a working `protoc` binary. On Windows a local copy can be used; on CI it is installed from `protobuf-compiler`.
- Android builds need the Android SDK + NDK r27b. The CI installs them automatically.
- OpenSSL for Android is currently vendored via `openssl-sys` (`vendored` feature) to avoid system-lib dependencies.
- Prebuilt toolchains in `tools/protoc/` and `tools/android-openssl/` should not be committed to Git; fetch them in CI or store them outside the repo.

## Security rules

- Keep `src-tauri/tauri.conf.json` CSP strict. Do not set `csp: null`.
- AndroidManifest.xml must keep `android:allowBackup="false"` and `android:fullBackupContent="false"`.
- Do not store ASP access tokens or tapd macaroons in plaintext JSON. Encrypt them or keep them in Stronghold / OS keychain.
- All user-provided Bitcoin amounts must be validated with `Amount::from_sat_checked` before conversion.
- Vault password changes must use atomic writes (`write_wallet_atomic`) so an interrupted write cannot destroy the wallet.

## Tor / Taproot Assets

- The app embeds an `arti-client` Tor client for `.onion` tapd hosts and optional Tor-routed clearnet hosts.
- Default tapd connection values are embedded at compile time from `tapd-defaults.json` (gitignored). Use `tapd-defaults.example.json` as a template.
- If `tapd-defaults.json` is absent, the build still succeeds with empty defaults.
- See `docs/tapd-umbrel-setup.md` for exposing the tapd RPC port bundled with Umbrel's Lightning Terminal app.

## i18n

- Translations live in `src/i18n/strings.ts`. Add keys to both `fr` and `en`.
- Prefer `useI18n()` over hardcoded strings in new UI code.
