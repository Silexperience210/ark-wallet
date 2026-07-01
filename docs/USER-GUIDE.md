# Guide utilisateur — OZark Wallet

## Créer un wallet

1. Au lancement, choisissez **Créer un wallet**.
2. Sélectionnez 12 ou 24 mots.
3. Choisissez un mot de passe fort (min. 8 caractères, 12+ recommandé).
4. **Écrivez la phrase de récupération sur papier** avant de continuer.
5. Le wallet est prêt.

## Restaurer un wallet

1. Sur l’écran de bienvenue, choisissez **Importer**.
2. Entrez la phrase mnémonique, ou :
   - scannez un **QR** de backup,
   - approchez une **tag NFC** contenant le backup,
   - collez le texte chiffré.
3. Saisissez le mot de passe du backup pour le déchiffrer.
4. Définissez un nouveau mot de passe pour le wallet restauré.

## Sauvegarder le wallet

1. Sur le **Dashboard**, appuyez sur **Backup**.
2. Entrez votre mot de passe et confirmez.
3. Le backup chiffré apparaît sous forme de QR.
4. Vous pouvez :
   - **Copier** le texte chiffré,
   - **Télécharger** l’image QR,
   - **Écrire** le backup sur une tag NFC (mobile).

> Le backup est chiffré avec AES-256-GCM + Argon2id. Gardez le mot de passe à l’abri, séparément du backup.

## Recevoir des bitcoins

### On-chain

- Sur le **Dashboard**, copiez l’adresse on-chain et envoyez des sats vers cette adresse.

### Ark

- Ouvrez l’écran **ARK**.
- Appuyez sur **Nouvelle adresse** pour obtenir une adresse Ark.
- Envoyez des fonds via une transaction Ark ou utilisez **Board** pour transférer depuis votre solde on-chain.

## Envoyer des paiements

### On-chain

- Sur le **Dashboard**, appuyez sur **Envoyer on-chain**.
- Renseignez l’adresse, le montant en sats et les frais.

### Ark

- Dans l’écran **ARK**, section **Envoyer ARK**, entrez l’adresse Ark et le montant.

### Lightning

- Ouvrez l’écran **Lightning**.
- Collez une invoice BOLT11 ou scannez-la.
- Le paiement est déduit de votre solde Ark.

## Taproot Assets

1. Ouvrez l’écran **Taproot**.
2. Connectez-vous à votre nœud `tapd` (hôte, certificat TLS, macaroon).
3. Listez vos actifs, mintez-en de nouveaux, générez des adresses ou envoyez des assets.
4. Depuis la section **Backup des proofs**, exportez les proofs de vos assets en JSON ou vérifiez un proof collé.

## Historique

- L’écran **Historique** regroupe les transactions on-chain et Ark.
- Filtrez par type : Tout, On-chain, ARK.

## Configuration

- **Config ASP** (écran ARK) : modifiez l’URL du serveur Ark, l’URL Esplora et le token d’accès.
- **Réseau** : Signet par défaut. Le mainnet peut être sélectionné via la config ASP (avec avertissement).

## Passer en mainnet Bitcoin

> **Avertissement** : le mainnet utilise de vrais bitcoins. Ark est une technologie encore jeune ; ne déposez que ce que vous pouvez vous permettre de perdre.

1. Ouvrez l’écran **ARK**.
2. Dans **Config ASP**, sélectionnez le réseau **Bitcoin mainnet**.
   - L’ASP public par défaut est celui de **Second** : `https://ark.second.tech`.
   - L’Esplora par défaut est `https://mempool.second.tech/api`.
3. Vérifiez l’URL du serveur et ne modifiez l’ASP que si vous savez ce que vous faites.
4. Sauvegardez la config.
5. Verrouillez puis déverrouillez le wallet : un avertissement mainnet très visible apparaît avant l’unlock.
6. Effectuez d’abord un test avec un petit montant (board, envoi Ark/Lightning, off-board).

### ASP alternatifs

- **Arkade** (`https://arkade.computer`) propose aussi un serveur Ark mainnet public. OZark Wallet est bâti sur `bark-wallet` (implémentation Second) ; la compatibilité avec Arkade n’est pas garantie. Utilisez-la uniquement à des fins de test et après avoir vérifié que votre version de `bark-wallet` supporte cet ASP.

## Sécurité

- Ne perdez pas votre mot de passe : la seed ne peut pas être récupérée sans lui.
- Ne prenez pas de screenshot de votre seed.
- Testez la restauration avant d’envoyer des fonds importants.
- Consultez [SECURITY.md](./SECURITY.md) pour l’audit détaillé.

## Support

Pour les problèmes ou suggestions, ouvrez une issue sur GitHub.
