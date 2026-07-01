# Roadmap — OZark Wallet

## ✅ Phase 1 — Fondations et sécurité

- [x] Initialisation Tauri 2.0 (mobile + desktop)
- [x] Génération BIP39 (12/24 mots)
- [x] Validation de phrase de récupération
- [x] Stockage chiffré Stronghold + Argon2id
- [x] Écrans onboarding : création, import, déverrouillage
- [x] UI futuriste sombre (glassmorphism, animations Framer Motion)
- [x] Révélation seed protégée par mot de passe

## ✅ Phase 2 — Wallet on-chain Bitcoin

- [x] Intégration BDK 3.x
- [x] Descripteur BIP84 SegWit depuis seed
- [x] Génération d'adresses de réception
- [x] Sync via Esplora (Signet / Testnet)
- [x] Affichage du solde on-chain
- [x] Dashboard multi-actifs

## ✅ Phase 3 — Intégration ARK (Bark)

- [x] Dépendance `bark-wallet` intégrée (`bark` crate)
- [x] Module Ark structuré
- [x] Démarrage correct `open`/`create` selon l'état de la DB
- [x] Config ASP persistante (server_address, esplora_address, access_token)
- [x] Fonction de création/ouverture de wallet Bark
- [x] Recevoir/envoyer des VTXOs
- [x] Onboarding/offboarding Ark ↔ on-chain (board funding + offboard/send_onchain)
- [x] Refresh des VTXOs
- [x] Sortie unilatérale on-chain (start, sync, claim/drain)

## ✅ Phase 6 — Backup NFC / QR chiffré (partiel)

- [x] Chiffrement seed avec AES-256-GCM + Argon2id
- [x] Génération QR de backup
- [x] Écran backup avec téléchargement/copie
- [x] Écriture/lecture NFC (mobile)
- [x] Import multi-formats (NFC / QR / texte)

## ✅ Phase 4 — Lightning

- [x] Payer une invoice BOLT11 depuis solde Ark
- [x] Recevoir Lightning en VTXO
- [x] Scan / génération invoice
- [x] Deep-links `lightning:`

## ✅ Phase 5 — Taproot Assets

- [x] Client gRPC `tapd`
- [x] Balances et adresses Taproot Assets
- [x] Envoi/réception d'assets
- [x] Mint simple d'assets
- [x] Backup des proofs

## ✅ Phase 7 — UI/UX futuriste et finitions

- [x] Animations avancées (Framer Motion)
- [x] Micro-interactions
- [x] Thème néon sobre finalisé
- [x] Notifications transactionnelles
- [x] Historique des transactions
- [x] Localisation FR/EN

## ✅ Phase 8 — Tests, audit et mainnet

- [x] Tests Rust complémentaires (seed 24 mots, parse outpoint, format backup)
- [~] Tests E2E iOS/Android (plan de tests manuels, CI frontend + Rust)
- [x] Audit sécurité seed + chiffrement
- [x] Tests de sortie unilatérale Ark (plan de test manuel)
- [x] Documentation utilisateur
- [x] Activation mainnet progressive (sélection Signet/Testnet/Mainnet + avertissements)
