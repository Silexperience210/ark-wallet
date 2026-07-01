# État du projet — OZark Wallet

Dernière mise à jour : 2026-06-18
Dernière release publiée : **v0.2.4**
URL : https://github.com/Silexperience210/ark-wallet/releases/tag/v0.2.4

---

## ✅ Ce qui fonctionne (v0.2.1 + corrections post-audit)

- Release desktop Windows (MSI + NSIS setup EXE).
- Release Android APK universel signé (arm64 / armv7 / x86 / x86_64).
- Mainnet Bitcoin via l'ASP public **Second** (`https://ark.second.tech`).
- Choix du réseau : Bitcoin mainnet par défaut (Signet/Testnet retirés de l'UI).
- Avertissements mainnet à l'unlock et dans l'écran ARK.
- Wallet on-chain Bitcoin (BIP39 + BDK) adapté au réseau sélectionné, **persisté en SQLite**.
- Stockage seed chiffré Stronghold + Argon2id.
- Changement de mot de passe avec écriture atomique du snapshot et **conservation des secrets ASP/tapd**.
- Token d'accès ASP et macaroon tapd **chiffrés dans Stronghold**, jamais en JSON clair.
- ARK layer-2 via `bark-wallet`.
- Taproot Assets via connexion à un `tapd` externe.
- Deep-links `lightning:`.
- Protection anti-screenshot Android (`FLAG_SECURE`).
- 25 tests Rust passent (backup, seed, commandes, persistence on-chain).

---

## ❌ Points de vigilance identifiés par l'audit v0.2.1

Voir `AUDIT.md` à la racine pour le détail complet.

### Critiques / hautes priorités restants

1. **Plateformes mobiles**
   - iOS non généré / non testé (`src-tauri/gen/ios` absent).
2. **Tests**
   - Aucun test unitaire sur le vault Stronghold (nécessite un `AppHandle` de test).
   - CI ne couvre que Linux ; pas de build desktop Windows/macOS/iOS.
3. **Sécurité avancée**
   - Pas de confirmation mainnet côté backend.
   - Vérification TLS/SNI personnalisée pour tapd (domaine extrait de l'URL du nœud).
   - Secrets en mémoire non zeroizés systématiquement.
4. **Documentation / i18n**
   - README/USER-GUIDE doivent refléter le statut iOS et les hypothèses de confiance.
   - i18n incomplète : de nombreuses chaînes restent en dur en français.

### Prochaine action recommandée

Générer le projet iOS, élargir la CI à Windows/macOS/iOS, ajouter des tests sur le vault Stronghold, et renforcer la confirmation mainnet côté backend avant toute campagne mainnet publique.
