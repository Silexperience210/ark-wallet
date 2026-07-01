# Connecter OZark Wallet à tapd sur Umbrel (Lightning Terminal)

Ce guide explique comment exposer le RPC `tapd` intégré à Lightning Terminal sur un Umbrel local, afin qu'OZark Wallet puisse s'y connecter.

> **Sécurité** : ne jamais exposer le RPC tapd directement sur Internet. Préférez l'accès local, un VPN, ou un service `.onion` via Tor.

## 1. Vérifier que tapd est actif

Se connecter en SSH à l'Umbrel :

```bash
ssh umbrel@umbrel.local
```

Vérifier la présence des données tapd :

```bash
ls /home/umbrel/umbrel/app-data/lightning-terminal/data/.tapd/data/mainnet/
```

On doit y voir `admin.macaroon`.

## 2. Exposer le port RPC tapd

Par défaut, `tapd` écoute sur le port **10029** à l'intérieur du conteneur Lightning Terminal, mais ce port n'est pas mappé vers l'hôte.

### 2.1 Modifier le docker-compose

Éditer le fichier :

```bash
nano /home/umbrel/umbrel/app-data/lightning-terminal/docker-compose.yml
```

Dans la section `services.web`, ajouter :

```yaml
    ports:
      - "10029:10029"
```

Et ajouter l'argument d'écoute pour tapd dans `command` :

```yaml
      - '--taproot-assets.rpclisten=0.0.0.0:10029'
```

Le fichier ressemblera à ceci :

```yaml
version: '3.7'
services:
  app_proxy:
    environment:
      APP_HOST: lightning-terminal_web_1
      APP_PORT: 3004
    container_name: lightning-terminal_app_proxy_1
  web:
    image: >-
      lightninglabs/lightning-terminal:v0.16.1-alpha@sha256:7f8e16d940ee350ff38b2d8e71bda0c512a89822fa62a60097ac7ecc71d660ae
    user: '1000:1000'
    restart: on-failure
    stop_grace_period: 1m
    ports:
      - "10029:10029"
    volumes:
      - ${APP_DATA_DIR}/data:/data
      - ${APP_LIGHTNING_NODE_DATA_DIR}:/lnd:ro
    environment:
      HOME: /data
      APP_PASSWORD: $APP_PASSWORD
    command:
      - '--uipassword_env=APP_PASSWORD'
      - '--insecure-httplisten=0.0.0.0:3004'
      - '--network="$APP_BITCOIN_NETWORK"'
      - '--lnd-mode="remote"'
      - >-
        --remote.lnd.rpcserver=$APP_LIGHTNING_NODE_IP:$APP_LIGHTNING_NODE_GRPC_PORT
      - >-
        --remote.lnd.macaroonpath="/lnd/data/chain/bitcoin/$APP_BITCOIN_NETWORK/admin.macaroon"
      - '--remote.lnd.tlscertpath="/lnd/tls.cert"'
      - '--taproot-assets.rpclisten=0.0.0.0:10029'
    container_name: lightning-terminal_web_1
```

### 2.2 Redémarrer Lightning Terminal

```bash
cd /home/umbrel/umbrel/app-data/lightning-terminal
/usr/bin/docker compose up -d
```

Vérifier que le port est ouvert :

```bash
sudo ss -tlnp | grep 10029
```

## 3. Récupérer les informations de connexion

### Certificat TLS

```bash
cat /home/umbrel/umbrel/app-data/lightning-terminal/data/.lit/tls.cert
```

### Macaroon admin

```bash
xxd -p -c 10000 /home/umbrel/umbrel/app-data/lightning-terminal/data/.tapd/data/mainnet/admin.macaroon
```

### Host

Si l'appareil exécutant OZark Wallet est sur le même réseau local :

```
https://umbrel.local:10029
```

## 4. Renseigner OZark Wallet

Copier le fichier modèle :

```bash
cp tapd-defaults.example.json tapd-defaults.json
```

Puis remplir `tapd-defaults.json` avec le host, le certificat PEM et le macaroon hex.

Ce fichier est gitignoré : il ne sera jamais commité. Les valeurs sont embarquées dans le binaire au build suivant via `build.rs`.

## 5. Tester la connexion

Lancer OZark Wallet, aller dans l'écran **Taproot Assets**, activer **Tor** si besoin, puis cliquer sur **Utiliser le nœud par défaut**. Le statut de connexion doit passer à "connecté".

## Notes

- Si Lightning Terminal est mis à jour par Umbrel, le `docker-compose.yml` peut être réécrit. Conservez une copie de vos modifications pour les réappliquer.
- Pour un accès distant sécurisé, envisagez d'exposer tapd via un service `.onion` Tor ou un tunnel VPN, plutôt qu'un port ouvert sur Internet.
