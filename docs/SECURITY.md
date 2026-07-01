# Audit sécurité — OZark Wallet

> Ce document est une analyse des mécanismes de sécurité actuels du wallet. La section mainnet a été activée avec des avertissements renforcés ; les points de vigilance restent valides pour un usage à grande échelle.

## 1. Ce qui est stocké localement

Le wallet stocke deux fichiers dans le répertoire `app_local_data_dir` de l’appareil :

| Fichier | Contenu | Protection |
|---------|---------|------------|
| `ozark-wallet.stronghold` | Snapshot Stronghold chiffré contenant la phrase mnémonique BIP39 | Chiffrement AES via clé dérivée du mot de passe utilisateur + sel |
| `ozark-wallet.salt` | Sel aléatoire de 16 octets | Non chiffré (stocké à côté du snapshot) |

La seed n’est jamais stockée en clair. Elle n’est déchiffrée qu’en mémoire, à l’unlock, et transmise aux services on-chain/Ark/Taproot.

## 2. Dérivation de clé

La clé de déverrouillage du snapshot est dérivée avec **Argon2id** :

- `variant` : Argon2id
- `version` : 1.3
- `mem_cost` : 65 536 KiB (64 Mo)
- `time_cost` : 3 itérations
- `lanes` : 4
- `hash_length` : 32 octets

Ces paramètres sont raisonnables pour une application mobile/desktop grand public. Ils ralentissent les attaques par brute-force tout en restant utilisables sur du matériel modeste.

## 3. Backup chiffré (QR / NFC)

Le backup est généré par `src-tauri/src/backup/crypto.rs` :

- Dérivation de clé identique au vault (Argon2id, même configuration).
- Chiffrement **AES-256-GCM**.
- Sel aléatoire de 16 octets + nonce de 12 octets + texte chiffré.
- Encodage final en **base64**.

Le résultat (QR ou NFC) contient donc tout ce qui est nécessaire pour déchiffrer, à l’exception du mot de passe. Un attaquant disposant du backup peut tenter une attaque hors ligne sur le mot de passe.

## 4. Modèle de menaces

| Menace | Impact | Mitigation actuelle | Recommandation |
|--------|--------|---------------------|----------------|
| Mot de passe faible | Déchiffrement offline du backup ou du snapshot | Argon2id ralentit l’attaque | Imposer une longueur minimale (déjà 8 caractères) ; encourager 12+ caractères |
| Appareil compromis (keylogger, root/jailbreak) | Vol du mot de passe et donc de la seed | Aucune contre-mesure matérielle | Éviter les appareils rootés ; utiliser la biométrie si elle est activée plus tard |
| Backup intercepté (QR photo, NFC sniff) | Ciphertext accessible | Chiffrement AES-GCM | Ne pas partager le backup ; utiliser un mot de passe fort unique |
| Perte du mot de passe | Seed irrécupérable | Aucune backdoor | Sauvegarder le mot de passe hors ligne, séparément du backup |
| Fuite du snapshot + sel | Ciphertext du snapshot accessible | Clé dérivée du mot de passe | Chiffrer le disque de l’appareil ; ne pas copier le snapshot ailleurs |
| ASP malveillant | Blocage ou vol des fonds Ark | Choix de l’ASP par config | Documenter la confiance requise en l’ASP ; permettre un ASP personnalisé |
| Mainnet non préparé | Perte de fonds réels | Avertissements visibles à l’unlock et dans l’écran Ark ; ASP mainnet par défaut documenté (Second) | Conserver le mode test par défaut ; obliger l’utilisateur à acquiescer au risque avant l’unlock |

## 5. Avertissements mainnet intégrés

- L’écran de déverrouillage affiche un bandeau rouge **MAINNET — Vrais bitcoins** lorsque le wallet est configuré pour `bitcoin`.
- L’utilisateur doit cocher une case confirmant qu’il comprend les risques avant de pouvoir déverrouiller.
- L’écran **ARK** affiche un avertissement permanent en haut de page et un second avertissement dans la section config lorsque le mainnet est sélectionné.
- L’ASP mainnet par défaut est documenté et facilement vérifiable (`https://ark.second.tech`).

## 6. Points de vigilance avant mainnet

- [ ] Passer en revue les paramètres Argon2id avec un audit externe.
- [ ] S’assurer que `ozark-wallet.salt` n’est pas synchronisé vers le cloud par l’OS (Android/iOS backup).
- [ ] Implémenter un verrou biométrique optionnel (le plugin est déjà présent mais non utilisé).
- [ ] Empêcher les captures d’écran sur les écrans de seed / mot de passe.
- [ ] Effacer la seed de la mémoire dès qu’elle n’est plus utilisée (zeroize déjà utilisé pour les clés BDK).
- [ ] Valider la gestion des erreurs de mot de passe (pas de timing leak, pas de message trop précis).
- [ ] Auditer l’intégration `bark-wallet` et la communication avec l’ASP.
- [ ] Tester la restauration complète depuis backup sur un second appareil.
- [ ] Publier une politique de divulgation responsable.

## 7. Bonnes pratiques utilisateur

1. Choisissez un mot de passe long et unique (min. 12 caractères, mélange de mots).
2. Ne stockez jamais le mot de passe à côté du backup chiffré.
3. Préférez le backup papier QR dans un lieu sûr au stockage numérique.
4. Testez la restauration avant de déposer des fonds importants.
5. Sur mobile, activez le chiffrement du disque et un code PIN fort.

## 8. Limitations connues

- Le sel n’est pas chiffré ; il est stocké à côté du snapshot. Cela est acceptable car le sel n’a pas besoin d’être secret.
- Aucune protection anti-screenshot n’est activée actuellement.
- Le plugin biométrique est enregistré mais non exploité.
- Les transactions Taproot Assets dépendent d’un nœud `tapd` externe et de sa confiance.
