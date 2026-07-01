# Plan de test — Sortie unilatérale Ark

Ce document décrit comment tester manuellement la sortie unilatérale Ark (forfeit) depuis le wallet OZark Wallet.

## Prérequis

- Wallet OZark Wallet déverrouillé sur le réseau **Signet** (configurable manuellement) ou **Bitcoin mainnet**.
- Solde Ark non nul (des VTXOs existants).
- Une adresse on-chain de réception sous contrôle de l’utilisateur.
- Connexion à un Esplora et à un ASP fonctionnels (par défaut mainnet : `https://ark.second.tech`).

## Étapes de test

### 1. Vérifier le solde Ark

- Ouvrir l’écran **ARK**.
- Appuyer sur **Synchroniser**.
- S’assurer que le solde Ark est > 0.

### 2. Lancer la sortie unilatérale

- Dans l’écran **ARK**, section **Sortie unilatérale**, appuyer sur **Démarrer**.
- Cela appelle `start_ark_exit_command` et crée les claims on-chain pour tous les VTXOs.
- Noter le temps de bloc Signet (~10 min) et la période de forfeit définie par l’ASP (généralement quelques heures).

### 3. Actualiser l’état des exits

- Appuyer sur **Actualiser** (`sync_ark_exits_command`).
- Vérifier via **Voir l’état** (`get_ark_exit_status_command`) que les exits passent de `pending` à `claimable`.

### 4. Réclamer les fonds

- Entrer une adresse on-chain dans le champ **Adresse de réception on-chain**.
- Appuyer sur **Claim** (`drain_ark_exits_command`).
- Attendre la confirmation de la transaction on-chain.

### 5. Vérifications finales

- Le solde Ark doit être proche de 0.
- La transaction de claim doit être visible dans l’**Historique** (filtre On-chain).
- Les frais on-chain doivent être déduits des fonds récupérés.

## Scénarios d’erreur à tester

| Scénario | Comportement attendu |
|----------|----------------------|
| Solde Ark = 0 | `start_exit` retourne une erreur explicite |
| Adresse de claim invalide | `drain_exits` retourne une erreur de parsing d’adresse |
| Exit lancé deux fois | Le second appel ne crée pas de doublon ; les claims existants sont mis à jour |
| Changement d’ASP entre `start_exit` et `drain_exits` | Les claims restent valides car ils sont on-chain et indépendants de l’ASP |

## Critères de succès

- [ ] Les VTXOs sont convertis en UTXOs on-chain.
- [ ] L’utilisateur récupère ses fonds sans coopération de l’ASP.
- [ ] Les transactions apparaissent dans l’historique.
- [ ] Aucune perte de fonds (hors frais on-chain).

## Notes

- Ce test est à exécuter sur Signet. Ne jamais tester une sortie unilatérale sur mainnet sans audit préalable.
- La durée totale dépend de la période de forfeit de l’ASP. Prévoir plusieurs heures.
