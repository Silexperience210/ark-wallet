# Audit OZark Wallet v0.2.1

**Date :** 2026-06-18
**Repo :** `https://github.com/Silexperience210/ark-wallet`
**Version auditée :** v0.2.1
**Méthode :** revue statique du backend Rust, du frontend React, des workflows CI/GitHub Actions, de la configuration Tauri/Android et de la documentation.

Ce document regroupe les anomalies découvertes, leur sévérité, et les corrections appliquées lors de la session d'audit.

---

## Résumé exécutif

| Domaine | État |
|---|---|
| Rust backend | Corrections critiques appliquées (atomicité password, validation montants, nettoyage état, CSP, etc.). |
| Frontend React | ErrorBoundary, bannière mainnet partagée, modales de confirmation, validation basique ajoutées. |
| Sécurité Tauri/Android | CSP strict, `allowBackup="false"`, permission `CAMERA`, intent-filter `lightning:` ajoutés. |
| CI/GitHub Actions | `PROTOC`, NDK pin, rust-cache, clippy/fmt/tsc ajoutés. |
| Tests | 25 tests Rust passent ; clippy/fmt passent ; build frontend OK. |

**Risques résiduels importants :**

- Token ASP et macaroon tapd sont désormais chiffrés dans Stronghold (voir §7).
- Protection anti-screenshot (`FLAG_SECURE`) ajoutée sur Android.
- Wallet BDK désormais persisté en SQLite (adresses et UTXOs conservés au redémarrage).
- Couverture de tests enrichie (backup, seed, commandes, persistence on-chain) ; les tests vault restent à ajouter.
- Projet iOS / CI desktop & mobile restent à implémenter.

---

## 1. Backend Rust

### 1.1 Correction — `change_password` destructeur (CRITIQUE)

**Fichier :** `src-tauri/src/wallet/vault.rs`

**Problème :** `change_password` déchiffrait la seed avec l'ancien mot de passe, puis appelait `create_wallet`, qui supprimait l'ancien snapshot *avant* d'écrire le nouveau. En cas d'erreur pendant l'écriture, le wallet était définitivement perdu.

**Correctif :** introduction de `write_wallet_atomic` :
- écrit le nouveau snapshot/salt dans des fichiers `.tmp` ;
- `Stronghold::save()` réussi → backup des anciens fichiers en `.bak` → remplacement atomique ;
- en cas d'erreur après backup, restauration automatique depuis `.bak` ;
- `create_wallet` et `change_password` utilisent ce helper.

### 1.2 Correction — état en mémoire non nettoyé lors du delete (CRITIQUE)

**Fichier :** `src-tauri/src/commands.rs`

**Problème :** `delete_wallet_command` supprimait les fichiers mais laissait `state.onchain`, `state.ark` et `state.taproot` actifs. L'utilisateur pouvait continuer à dépenser depuis un wallet "supprimé".

**Correctif :** la commande est devenue `async`, efface les trois champs de `WalletState` et drop l'`ArkService` (ce qui arrête le thread Bark).

### 1.3 Correction — `get_wallet_status` mentait sur l'état unlock (HAUT)

**Fichier :** `src-tauri/src/commands.rs`

**Problème :** `unlocked` était hardcodé à `false`.

**Correctif :** la commande vérifie désormais si `onchain`, `ark` ou `taproot` sont présents.

### 1.4 Correction — paniques sur montants utilisateur (HAUT)

**Fichiers :** `src-tauri/src/onchain/wallet.rs`, `src-tauri/src/ark/service.rs`

**Problème :** `Amount::from_sat(amount_sats)` était utilisé sans validation. Sur rust-bitcoin 0.32 le constructeur ne panique pas directement, mais des montants supérieurs à `MAX_MONEY` peuvent provoquer des erreurs/paniques en aval dans BDK/Bark.

**Correctif :** validation explicite contre `Amount::MAX_MONEY.to_sat()` avant conversion. Appliqué aux envois on-chain, ARK, Lightning, off-board et board.

### 1.5 Correction — `std::sync::Mutex` tenu à travers des `.await` (MOYEN)

**Fichier :** `src-tauri/src/ark/service.rs`

**Problème :** le wallet Bark était protégé par un `std::sync::Mutex` verrouillé dans des requêtes asynchrones. Risque de deadlock si le runtime évolue.

**Correctif :** remplacement par `tokio::sync::Mutex`.

### 1.6 Validation des URLs ASP (MOYEN)

**Fichier :** `src-tauri/src/commands.rs`

**Problème :** `save_ark_config_command` acceptait n'importe quelle chaîne comme `server_address`/`esplora_address`.

**Correctif :** parsing via `url::Url`, obligation de `https` pour le mainnet, message d'erreur explicite.

### 1.7 Nettoyage des warnings & plugins inutiles (BAS)

**Fichiers :** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/src/wallet/mod.rs`, `src-tauri/src/taproot/client.rs`

- Suppression de `tauri-plugin-opener` et `tauri-plugin-biometric` (non utilisés).
- Suppression de l'export inutilisé `unlock_wallet`.
- `#[allow(clippy::all, dead_code)]` sur les modules protobuf générés.

---

## 2. Configuration Tauri / Android

### 2.1 CSP strict (CRITIQUE)

**Fichier :** `src-tauri/tauri.conf.json`

Ancien : `"csp": null`.
Nouveau :

```json
"csp": "default-src 'self'; connect-src 'self' https:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none';"
```

### 2.2 AndroidManifest durci (HAUT)

**Fichier :** `src-tauri/gen/android/app/src/main/AndroidManifest.xml`

- `android:allowBackup="false"`
- `android:fullBackupContent="false"`
- Permission `CAMERA` déclarée explicitement.
- `uses-feature` pour `camera` (non requise).
- Intent-filter `lightning:` pour les deep-links.

### 2.3 Capabilities allégées

**Fichier :** `src-tauri/capabilities/default.json`

- Retrait de `opener:default` (plugin supprimé).

---

## 3. CI / GitHub Actions

### 3.1 `ci.yml`

- Définition de `PROTOC`.
- Ajout de `cargo fmt --check`.
- Ajout de `cargo clippy --lib -- -D warnings`.
- Ajout de `npx tsc --noEmit`.
- `Swatinem/rust-cache@v2`.
- `concurrency` pour annuler les runs redondants.

### 3.2 `android-release.yml`

- Utilisation de `nttld/setup-ndk@v1` avec version pinnée `r27b`.
- Utilisation de `${{ steps.setup-ndk.outputs.ndk-path }}` au lieu d'un `ls -d` fragile.
- Ajout d'une étape de signature optionnelle (secrets Android).

### 3.3 `android.yml`

- `concurrency` et `rust-cache` ajoutés.

---

## 4. Frontend React

### 4.1 ErrorBoundary global (CRITIQUE)

**Fichiers :** `src/components/ErrorBoundary.tsx`, `src/main.tsx`

L'application est désormais protégée contre les white-screens.

### 4.2 Bannière mainnet partagée (CRITIQUE)

**Fichiers :** `src/components/MainnetBanner.tsx`, `src/screens/Dashboard.tsx`, `src/screens/Lightning.tsx`

La bannière mainnet s'affiche maintenant sur le Dashboard et l'écran Lightning en plus de l'écran Ark.

### 4.3 Modales de confirmation (HAUT)

**Fichiers :** `src/components/ConfirmModal.tsx`, `src/App.tsx`, `src/screens/Ark.tsx`

- Remplacement de `window.confirm` pour la suppression du wallet.
- Ajout d'une confirmation avant off-board, sortie unilatérale et claim des exits.

### 4.4 Prompt mot de passe in-app (HAUT)

**Fichiers :** `src/components/PasswordPrompt.tsx`, `src/screens/Dashboard.tsx`

- Le reveal de seed utilise une modale in-app au lieu de `window.prompt`/`alert`.

### 4.5 Corrections diverses

- `NotificationContext` : nettoyage des `setTimeout` au démontage + limite à 5 toasts.
- `I18nContext` : `try/catch` autour du `localStorage`.
- Quelques chaînes durcies remplacées par des clés i18n.
- Écritures clipboard avec `try/await` et notification d'erreur.

---

## 5. Secrets et hygiène du repo

### 5.1 `.env` déplacé hors du working tree (CRITIQUE)

Le fichier `.env` contenant le mot de passe du keystore a été déplacé vers :

```
C:\Users\Silex\.silex-keystore\.env
```

Un `.env.example` sans vraies valeurs a été ajouté au repo.

### 5.2 `.gitignore`

- `.env.local`, `*.keystore`, `*.jks`, et les dossiers `tools/protoc/`, `tools/android-openssl/` ignorés.

### 5.3 `AGENTS.md`

Ajout d'un guide agent avec les commandes de vérification, les règles de sécurité et les notes de build.

---

## 6. Vérifications effectuées

```bash
npm run build                 # OK
npx tsc --noEmit              # OK
cd src-tauri
cargo fmt --check             # OK
cargo clippy --lib -- -D warnings  # OK
cargo check                   # OK
cargo test --lib              # 25 passed
```

---

## 7. Corrections des risques résiduels

### 7.1 Chiffrement du token ASP

**Fichier :** `src-tauri/src/commands.rs`

- `save_ark_config_command` persiste `server_address`, `esplora_address` et `network` dans `ark-config.json` **sans** le token.
- Le `server_access_token` est chiffré dans le snapshot Stronghold via `wallet::store_secret`/`load_secret` sous la clé `ark_server_access_token`.
- `load_ark_config_command` retourne un `ArkConfigDto` avec `server_access_token: None` pour ne jamais exposer le secret au frontend.
- `initialize_wallet_state` recharge le token depuis Stronghold au déverrouillage.

### 7.2 Chiffrement du macaroon tapd

**Fichier :** `src-tauri/src/taproot/client.rs`, `src-tauri/src/commands.rs`

- `TapdConfig` est toujours sauvegardé sur disque, mais `macaroon_hex` est vide.
- `connect_tapd` chiffre le macaroon dans Stronghold sous `tapd_macaroon`.
- `reconnect_tapd` relit le macaroon chiffré avec le mot de passe utilisateur.

### 7.3 Conservation des secrets lors du changement de mot de passe

**Fichier :** `src-tauri/src/commands.rs`

- `change_wallet_password` relit le token ASP et le macaroon tapd avec l'ancien mot de passe, effectue la rotation du snapshot seed, puis rechiffre les deux secrets avec le nouveau mot de passe.
- Cela évite la perte des credentials ASP/tapd après un `change_password`.

### 7.4 Persistance du wallet on-chain BDK

**Fichier :** `src-tauri/src/onchain/wallet.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`

- `create_wallet` stocke désormais le wallet dans une base SQLite (`bdk-wallet.db`) via `bdk_wallet::rusqlite::Connection`.
- Au déverrouillage suivant, le wallet est rechargé depuis la base : index d'adresses, UTXOs et historique sont conservés.
- `get_new_address` utilise `reveal_next_address` pour ne jamais réutiliser une adresse.
- `sync_wallet` et `send_to_address` persistent les changements après mutation.
- `delete_wallet_command` supprime aussi la base SQLite et ses fichiers WAL/journal.

### 7.5 Tests Rust complémentaires

**Fichiers :** `src-tauri/src/onchain/wallet.rs`, `src-tauri/src/backup/crypto.rs`, `src-tauri/src/wallet/seed.rs`, `src-tauri/src/commands.rs`

- 25 tests Rust passent (contre 14 initialement).
- Tests on-chain : création/rechargement depuis SQLite, idempotence de `persist_wallet`.
- Tests backup : chiffrement/déchiffrement, nonce/ciphertext altérés, plaintext vide, base64 invalide.
- Tests seed : comptes de mots BIP39, passphrase, checksum invalide.
- Tests commandes : `parse_network`, validation HTTPS mainnet pour la config Ark.

## 8. Risques résiduels à traiter

| Sévérité | Sujet | Fichier(s) concerné(s) |
|---|---|---|
| HAUT | CI uniquement Linux ; pas de build desktop Windows/macOS ni iOS. | `.github/workflows/` |
| HAUT | Pas de projet iOS généré (`src-tauri/gen/ios`). | Tauri mobile |
| HAUT | Aucun test unitaire sur le vault Stronghold (nécessite un `AppHandle` de test). | `src-tauri/src/wallet/vault.rs` |
| MOYEN | Pas de confirmation mainnet côté backend (peut être contournée par un frontend malveillant). | `src-tauri/src/commands.rs` |
| MOYEN | Pas de vérification TLS/SNI personnalisé pour tapd (`domain_name("localhost")`). | `src-tauri/src/taproot/client.rs` |
| MOYEN | Les secrets en mémoire (seed, mots de passe, clés dérivées) ne sont pas zeroizés systématiquement. | `src-tauri/src/wallet/vault.rs`, `src-tauri/src/backup/crypto.rs` |
| MOYEN | i18n incomplète : de nombreuses chaînes restent en dur en français. | `src/screens/*.tsx` |
| BAS | `build-android.sh` contient des chemins Windows locaux. | `build-android.sh` |
| BAS | `tools/protoc/` et `tools/android-openssl/` restent tracked dans Git. | `.gitignore` (ajouté mais pas de `git rm --cached`) |

---

## 9. Recommandations prioritaires

1. **Élargir la matrice CI** à Windows, macOS et iOS.
2. **Générer le projet iOS** (`tauri ios init`) et durcir la config ATS + data-protection.
3. **Ajouter des tests Rust sur le vault Stronghold** (mock `AppHandle` ou test d'intégration).
4. **Ajouter une confirmation mainnet côté backend** pour les opérations à haut risque.
5. **Zeroizer les secrets en mémoire** (passphrase, clés dérivées) avec `zeroize`.
6. **Terminer l'i18n** et remplacer les chaînes hardcodées restantes.
7. **Vérifier le TLS/SNI pour tapd** (ne pas forcer `localhost` si l'utilisateur fournit un vrai FQDN).
