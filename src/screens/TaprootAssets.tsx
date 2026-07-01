import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { useNotification } from "../contexts/NotificationContext";
import { useI18n } from "../i18n/I18nContext";
import { PasswordPrompt } from "../components/PasswordPrompt";
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Send,
  QrCode,
  Copy,
  Check,
  Link,
  Download,
  ShieldCheck,
} from "lucide-react";

interface TaprootAssetsProps {
  onBack: () => void;
}

interface AssetSummary {
  asset_id: string;
  name: string;
  amount: number;
  asset_type: string;
  decimal_display: number;
}

interface ProofBackup {
  asset_id: string;
  name: string;
  amount: number;
  proof_base64: string;
}

interface AssetBalance {
  asset_id: string;
  name: string;
  balance: number;
}

interface Transfer {
  timestamp: number;
  anchor_txid: string;
  height_hint: number;
  inputs: number;
  outputs: number;
  total_out: number;
}

interface Batch {
  batch_key: string;
  batch_txid: string;
  state: string;
  assets: number;
}

interface Burn {
  asset_id: string;
  amount: number;
  anchor_txid: string;
}

interface AddrReceive {
  timestamp: number;
  addr: string;
  status: string;
  outpoint: string;
  utxo_amt_sat: number;
}

interface NodeInfo {
  version: string;
  lnd_version: string;
  network: string;
  lnd_pubkey: string;
}

interface DecodedAddr {
  encoded: string;
  asset_id: string;
  asset_type: string;
  amount: number;
}

interface AssetMeta {
  data: string;
  meta_type: string;
  meta_hash: string;
  decimal_display: number;
}

interface UniverseStats {
  runtime_id: number;
  num_assets: number;
  num_groups: number;
  num_syncs: number;
  num_proofs: number;
}

interface UniverseRoot {
  asset_id: string;
  asset_name: string;
}

interface DecodedAssetInvoice {
  asset_amount: number;
  sat_amount: number;
  description: string;
  destination: string;
}

interface RfqQuotes {
  buy_quotes: number;
  sell_quotes: number;
}

interface TaskState {
  state: "idle" | "pending" | "ready" | "failed";
  error?: string;
}

interface BackgroundInit {
  ark: TaskState;
  tapd: TaskState;
}

function fmtAmount(amount: number, decimals: number): string {
  if (!decimals) return amount.toLocaleString();
  return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function TaprootAssets({ onBack }: TaprootAssetsProps) {
  const { t } = useI18n();
  const { notify } = useNotification();
  const [host, setHost] = useState("https://localhost:10029");
  const [cert, setCert] = useState("");
  const [macaroon, setMacaroon] = useState("");
  const [useTor, setUseTor] = useState(false);
  const [forceTor, setForceTor] = useState(false);
  const [torStatus, setTorStatus] = useState("Stopped");
  const [connected, setConnected] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(true);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasDefaults, setHasDefaults] = useState(false);
  const [connectStatus, setConnectStatus] = useState<string>("");

  const [mintName, setMintName] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [mintMeta, setMintMeta] = useState("");

  const [addrAssetId, setAddrAssetId] = useState("");
  const [addrAmount, setAddrAmount] = useState("");
  const [address, setAddress] = useState("");

  const [sendAddress, setSendAddress] = useState("");
  const [sendTxid, setSendTxid] = useState("");

  const [copied, setCopied] = useState(false);

  const [proofs, setProofs] = useState<ProofBackup[]>([]);
  const [proofText, setProofText] = useState("");
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);

  // Advanced mint + fees + send preview
  const [mintCollectible, setMintCollectible] = useState(false);
  const [mintNewGroup, setMintNewGroup] = useState(false);
  const [mintFee, setMintFee] = useState("");
  const [sendFee, setSendFee] = useState("");
  const [decoded, setDecoded] = useState<DecodedAddr | null>(null);

  // Extra tapd data
  const [balances, setBalances] = useState<AssetBalance[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [burns, setBurns] = useState<Burn[]>([]);
  const [receives, setReceives] = useState<AddrReceive[]>([]);
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [burnId, setBurnId] = useState("");
  const [burnAmt, setBurnAmt] = useState("");
  const [metas, setMetas] = useState<Record<string, AssetMeta>>({});
  const [universeStats, setUniverseStats] = useState<UniverseStats | null>(null);
  const [universeRoots, setUniverseRoots] = useState<UniverseRoot[]>([]);
  const [syncHost, setSyncHost] = useState("");

  // Lightning assets (litd)
  const [rfqQuotes, setRfqQuotes] = useState<RfqQuotes | null>(null);
  const [lnPayReq, setLnPayReq] = useState("");
  const [lnAssetId, setLnAssetId] = useState("");
  const [lnPeer, setLnPeer] = useState("");
  const [lnDecoded, setLnDecoded] = useState<DecodedAssetInvoice | null>(null);
  const [lnRecvAmount, setLnRecvAmount] = useState("");
  const [lnMemo, setLnMemo] = useState("");
  const [lnBolt11, setLnBolt11] = useState("");
  const [chanAmount, setChanAmount] = useState("");
  const [chanFee, setChanFee] = useState("");

  const decimalById: Record<string, number> = {};
  assets.forEach((a) => {
    decimalById[a.asset_id] = a.decimal_display;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadTorConfig();
      // Check if defaults are configured
      try {
        const defaults = await invoke<{
          host: string;
          cert_pem: string;
          macaroon_hex: string;
        }>("get_tapd_defaults");
        setHasDefaults(
          defaults.host.trim().length > 0 &&
            defaults.macaroon_hex.trim().length > 0
        );
      } catch {
        setHasDefaults(false);
      }
      // Poll the background init status for rich feedback instead of a blind
      // boolean. The backend auto-connects tapd on unlock (saved node or default).
      for (let i = 0; i < 40 && !cancelled; i++) {
        try {
          const status = await invoke<BackgroundInit>("get_background_init_status");
          const tapd = status.tapd;

          if (tapd.state === "ready") {
            if (cancelled) return;
            setConnected(true);
            setAutoConnecting(false);
            refreshTorStatus();
            await fetchAssets();
            return;
          }

          if (tapd.state === "failed") {
            if (cancelled) return;
            setAutoConnecting(false);
            refreshTorStatus();
            setError(
              tapd.error ||
                "La connexion au nœud tapd a échoué. Veuillez vérifier l'adresse, le certificat et le macaroon, puis réessayer."
            );
            return;
          }

          if (tapd.state === "idle") {
            // No saved config and no defaults — user must connect manually
            if (cancelled) return;
            setAutoConnecting(false);
            refreshTorStatus();
            return;
          }

          // Pending — show live status
          if (tapd.state === "pending") {
            setConnectStatus(
              i < 5
                ? "Démarrage de la connexion au nœud tapd..."
                : `Connexion via Tor en cours... (${i * 2}s — peut prendre 30-60s au premier démarrage)`
            );
          }
        } catch {
          // keep polling
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      // Timeout after ~80s
      if (!cancelled) {
        setAutoConnecting(false);
        refreshTorStatus();
        setError(
          "Délai de connexion dépassé (80s). Veuillez entrer les informations de votre nœud tapd manuellement, ou utiliser le bouton \"Nœud par défaut\" si configuré."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live updates: tapd streams receive/send/mint events; refresh quietly on each.
  useEffect(() => {
    const un = listen("tapd-event", () => {
      invoke<AssetSummary[]>("list_taproot_assets").then(setAssets).catch(() => {});
      fetchExtras();
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  async function loadTorConfig() {
    try {
      const cfg = await invoke<{ enabled: boolean; force_tor: boolean }>("load_tor_config");
      setUseTor(cfg.enabled);
      setForceTor(cfg.force_tor);
    } catch (e) {
      console.error("load tor config error:", e);
    }
    refreshTorStatus();
  }

  async function refreshTorStatus() {
    try {
      const status = await invoke<string>("get_tor_status");
      setTorStatus(status);
    } catch (e) {
      setTorStatus("Unknown");
    }
  }

  async function applyTorDefaults() {
    try {
      await invoke("save_tor_config", { config: { enabled: useTor, force_tor: forceTor } });
    } catch (e) {
      console.error("save tor config error:", e);
    }
  }

  // Connect to the embedded default node directly, no password required.
  async function connectDefaultNode() {
    setLoading(true);
    setError("");
    try {
      await invoke("connect_default_tapd");
      setConnected(true);
      setAutoConnecting(false);
      notify(t("taproot.connected"), "success");
      await fetchAssets();
    } catch (e) {
      const msg = String(e);
      if (msg.includes("no default tapd node is configured")) {
        setError(
          "Aucun nœud par défaut n'est configuré. Le wallet doit être compilé avec les variables d'environnement OZARK_DEFAULT_TAPD_HOST, OZARK_DEFAULT_TAPD_CERT et OZARK_DEFAULT_TAPD_MACAROON, ou avec un fichier tapd-defaults.json. Veuillez vous connecter manuellement avec l'adresse de votre nœud."
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      refreshTorStatus();
    }
  }

  // Disconnect so the user can connect to a different (e.g. their own) tapd node.
  async function changeNode() {
    try {
      await invoke("disconnect_tapd");
    } catch (e) {
      console.error("disconnect tapd error:", e);
    }
    setAssets([]);
    setError("");
    setConnected(false);
    setAutoConnecting(false);
  }

  function connect() {
    setError("");
    setPasswordPromptOpen(true);
  }

  async function doConnect(password: string) {
    setLoading(true);
    setError("");
    try {
      await applyTorDefaults();
      await invoke("connect_tapd", {
        password,
        host,
        certPem: cert,
        macaroonHex: macaroon,
        useTor,
      });
      setConnected(true);
      notify(t("taproot.connected"), "success");
      setMacaroon("");
      await fetchAssets();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      refreshTorStatus();
    }
  }

  async function fetchAssets() {
    setLoading(true);
    setError("");
    try {
      const list = await invoke<AssetSummary[]>("list_taproot_assets");
      setAssets(list);
      fetchExtras();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function mint() {
    if (!mintName || !mintAmount) return;
    setLoading(true);
    setError("");
    try {
      const batch = await invoke<string>("mint_taproot_asset", {
        name: mintName,
        amount: Number(mintAmount),
        metadata: mintMeta,
        collectible: mintCollectible,
        newGroup: mintNewGroup,
        feeRateSatVb: Number(mintFee) || 0,
      });
      notify(`Batch finalisé: ${batch}`, "success");
      setMintName("");
      setMintAmount("");
      setMintMeta("");
      await fetchAssets();
      await fetchBatches();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function newAddress() {
    if (!addrAssetId || !addrAmount) return;
    setLoading(true);
    setError("");
    try {
      const addr = await invoke<string>("new_taproot_address", {
        assetId: addrAssetId,
        amount: Number(addrAmount),
      });
      setAddress(addr);
      notify(t("notifications.addressCopied"), "success");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!sendAddress) return;
    setLoading(true);
    setError("");
    try {
      const txid = await invoke<string>("send_taproot_asset", {
        address: sendAddress,
        feeRateSatVb: Number(sendFee) || 0,
      });
      setSendTxid(txid);
      notify(t("notifications.paymentSent"), "success");
      setSendAddress("");
      setDecoded(null);
      await fetchAssets();
      await fetchTransfers();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    notify(t("notifications.addressCopied"), "success");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function fetchExtras() {
    try { setBalances(await invoke<AssetBalance[]>("list_taproot_balances")); } catch {}
    try { setTransfers(await invoke<Transfer[]>("list_taproot_transfers")); } catch {}
    try { setBatches(await invoke<Batch[]>("list_taproot_batches")); } catch {}
    try { setBurns(await invoke<Burn[]>("list_taproot_burns")); } catch {}
    try { setReceives(await invoke<AddrReceive[]>("taproot_addr_receives")); } catch {}
    try { setNodeInfo(await invoke<NodeInfo>("get_taproot_info")); } catch {}
    try { setUniverseStats(await invoke<UniverseStats>("get_universe_stats")); } catch {}
    try { setUniverseRoots(await invoke<UniverseRoot[]>("list_universe_roots")); } catch {}
    try { setRfqQuotes(await invoke<RfqQuotes>("list_rfq_quotes")); } catch {}
  }

  async function decodeLnInvoice() {
    if (!lnPayReq || !lnAssetId) return;
    setError("");
    setLnDecoded(null);
    try {
      setLnDecoded(
        await invoke<DecodedAssetInvoice>("decode_asset_invoice", {
          payReq: lnPayReq,
          assetId: lnAssetId,
        })
      );
    } catch (e) {
      setError(String(e));
    }
  }

  async function payLnInvoice() {
    if (!lnPayReq || !lnAssetId) return;
    setLoading(true);
    setError("");
    try {
      const status = await invoke<string>("pay_asset_invoice", {
        payReq: lnPayReq,
        assetId: lnAssetId,
        peerPubkey: lnPeer,
      });
      notify(`Paiement: ${status}`, status === "Succeeded" ? "success" : "error");
      await fetchAssets();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createLnInvoice() {
    if (!lnAssetId || !lnRecvAmount || !lnPeer) return;
    setLoading(true);
    setError("");
    setLnBolt11("");
    try {
      const b = await invoke<string>("create_asset_invoice", {
        assetId: lnAssetId,
        assetAmount: Number(lnRecvAmount),
        peerPubkey: lnPeer,
        memo: lnMemo,
      });
      setLnBolt11(b);
      notify("Invoice asset créée", "success");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function fundChannel() {
    if (!lnAssetId || !chanAmount || !lnPeer) return;
    setLoading(true);
    setError("");
    try {
      const out = await invoke<string>("fund_asset_channel", {
        assetId: lnAssetId,
        assetAmount: Number(chanAmount),
        peerPubkey: lnPeer,
        feeRateSatVb: Number(chanFee) || 1,
      });
      notify(`Canal en ouverture: ${out}`, "success");
      await fetchAssets();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function doSyncUniverse() {
    if (!syncHost) return;
    setLoading(true);
    setError("");
    try {
      const n = await invoke<number>("sync_universe", { host: syncHost });
      notify(`Universe sync : ${n} univers`, "success");
      await fetchExtras();
      await fetchAssets();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchBatches() {
    try {
      setBatches(await invoke<Batch[]>("list_taproot_batches"));
    } catch (e) {
      setError(String(e));
    }
  }

  async function fetchTransfers() {
    try {
      setTransfers(await invoke<Transfer[]>("list_taproot_transfers"));
    } catch (e) {
      setError(String(e));
    }
  }

  async function cancelBatch() {
    setLoading(true);
    setError("");
    try {
      await invoke("cancel_taproot_batch");
      notify("Batch en attente annulé", "success");
      await fetchBatches();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function decodeAddrForSend() {
    if (!sendAddress) return;
    setError("");
    setDecoded(null);
    try {
      setDecoded(await invoke<DecodedAddr>("decode_taproot_addr", { address: sendAddress }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function showMeta(assetId: string) {
    try {
      const m = await invoke<AssetMeta>("fetch_taproot_asset_meta", { assetId });
      setMetas((prev) => ({ ...prev, [assetId]: m }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function burnAsset(assetId: string, amount: number) {
    setLoading(true);
    setError("");
    try {
      const txid = await invoke<string>("burn_taproot_asset", { assetId, amount });
      notify(`Burn diffusé: ${txid.slice(0, 16)}…`, "success");
      await fetchAssets();
      await fetchExtras();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function exportProofs() {
    setProofLoading(true);
    setError("");
    try {
      const list = await invoke<ProofBackup[]>("export_taproot_proofs");
      setProofs(list);
      notify(t("backup.saved"), "success");
    } catch (e) {
      setError(String(e));
    } finally {
      setProofLoading(false);
    }
  }

  function downloadProofs() {
    if (!proofs.length) return;
    const payload = {
      created_at: new Date().toISOString(),
      proofs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taproot-proofs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(t("backup.download"), "success");
  }

  async function verifyProof() {
    if (!proofText) return;
    setProofLoading(true);
    setError("");
    setVerifyResult(null);
    try {
      const ok = await invoke<boolean>("verify_taproot_proof", {
        proofBase64: proofText.trim(),
      });
      setVerifyResult(ok);
      notify(ok ? t("taproot.proofValid") : t("taproot.proofInvalid"), ok ? "success" : "error");
    } catch (e) {
      setError(String(e));
    } finally {
      setProofLoading(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "24px",
        overflow: "auto",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 className="title-lg">{t("taproot.title")}</h1>
          <p className="text-muted">{t("taproot.subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {connected && (
            <button className="btn btn-ghost" onClick={changeNode}>
              Changer de nœud
            </button>
          )}
          <button className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={18} /> {t("back")}
          </button>
        </div>
      </motion.div>

      {!connected ? (
        autoConnecting ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card"
            style={{ padding: "32px", marginBottom: "20px", textAlign: "center" }}
          >
            <span className="spinner" />
            <div className="text-secondary" style={{ marginTop: "14px" }}>
              {connectStatus || "Connexion au nœud tapd..."}
            </div>
            <div className="text-muted" style={{ fontSize: "12px", marginTop: "6px" }}>
              Premier démarrage de Tor : 30–60 s possibles.
            </div>
            <div className="text-muted" style={{ fontSize: "12px", marginTop: "4px" }}>
              {t("taproot.torStatus")}: {torStatus}
            </div>
          </motion.div>
        ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card"
          style={{ padding: "24px", marginBottom: "20px" }}
        >
          <div className="text-secondary" style={{ marginBottom: "16px" }}>
            <Link size={16} style={{ marginRight: "8px", verticalAlign: "middle" }} />
            {t("taproot.connect")}
          </div>
          <input
            className="input"
            placeholder={t("taproot.host")}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            style={{ marginBottom: "12px" }}
          />
          <textarea
            className="input"
            placeholder={t("taproot.cert")}
            value={cert}
            onChange={(e) => setCert(e.target.value)}
            rows={4}
            style={{ marginBottom: "12px" }}
          />
          <input
            className="input"
            placeholder={t("taproot.macaroon")}
            value={macaroon}
            onChange={(e) => setMacaroon(e.target.value)}
            style={{ marginBottom: "12px" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={useTor}
                onChange={(e) => setUseTor(e.target.checked)}
              />
              {t("taproot.useTor")}
            </label>
            <span className="text-muted" style={{ fontSize: "12px" }}>
              {t("taproot.torStatus")}: {torStatus}
            </span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={forceTor}
              onChange={(e) => setForceTor(e.target.checked)}
            />
            {t("taproot.forceTor")}
          </label>
          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                borderRadius: "10px",
                background: "rgba(255,68,68,0.1)",
                border: "1px solid var(--error)",
                color: "var(--error)",
                fontSize: "13px",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            {hasDefaults && (
              <button className="btn btn-ghost" onClick={connectDefaultNode} disabled={loading}>
                {t("taproot.defaultNode")}
              </button>
            )}
          </div>
          <button className="btn btn-primary" onClick={connect} disabled={loading}>
            {loading ? <span className="spinner" /> : <Link size={18} />}
            {loading ? t("loading") : t("taproot.connect")}
          </button>
        </motion.div>
        )
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card"
            style={{ padding: "20px", marginBottom: "20px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <span className="text-secondary">
                {t("taproot.assets")} ({assets.length})
              </span>
              <button className="btn btn-ghost" onClick={fetchAssets} disabled={loading}>
                <RefreshCw size={16} /> {t("refresh")}
              </button>
            </div>
            {assets.length === 0 ? (
              <div className="text-muted">{t("taproot.noAssets")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {assets.map((a) => (
                  <div
                    key={a.asset_id}
                    style={{
                      padding: "12px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div className="text-muted" style={{ fontSize: "12px" }}>
                      {fmtAmount(a.amount, a.decimal_display)} {t("taproot.units")} · {a.asset_type}
                    </div>
                    <div
                      className="text-muted"
                      style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}
                    >
                      {a.asset_id}
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button className="btn btn-ghost" onClick={() => showMeta(a.asset_id)}>
                        Meta
                      </button>
                      <button className="btn btn-ghost" onClick={() => burnAsset(a.asset_id, a.amount)} disabled={loading}>
                        Burn
                      </button>
                    </div>
                    {metas[a.asset_id] && (
                      <div className="text-muted" style={{ fontSize: "11px", marginTop: "6px", wordBreak: "break-all" }}>
                        {metas[a.asset_id].meta_type}: {metas[a.asset_id].data || "(vide)"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="glass-card"
            style={{ padding: "20px", marginBottom: "20px" }}
          >
            <div className="text-secondary" style={{ marginBottom: "12px" }}>
              <Plus size={16} style={{ marginRight: "8px", verticalAlign: "middle" }} />
              {t("taproot.mint")}
            </div>
            <input
              className="input"
              placeholder={t("taproot.mintName")}
              value={mintName}
              onChange={(e) => setMintName(e.target.value)}
              style={{ marginBottom: "10px" }}
            />
            <input
              className="input"
              placeholder={t("taproot.mintSupply")}
              type="number"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              style={{ marginBottom: "10px" }}
            />
            <input
              className="input"
              placeholder={t("taproot.mintMetadata")}
              value={mintMeta}
              onChange={(e) => setMintMeta(e.target.value)}
              style={{ marginBottom: "12px" }}
            />
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={mintCollectible}
                  onChange={(e) => setMintCollectible(e.target.checked)}
                />
                Collectible (NFT)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={mintNewGroup}
                  onChange={(e) => setMintNewGroup(e.target.checked)}
                />
                Nouveau groupe
              </label>
            </div>
            <input
              className="input"
              placeholder="Frais sat/vB (0 = auto)"
              type="number"
              value={mintFee}
              onChange={(e) => setMintFee(e.target.value)}
              style={{ marginBottom: "12px" }}
            />
            <button
              className="btn btn-primary"
              onClick={mint}
              disabled={loading || !mintName || (!mintCollectible && !mintAmount)}
            >
              <Plus size={16} /> {t("taproot.mint")}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="glass-card"
            style={{ padding: "20px", marginBottom: "20px" }}
          >
            <div className="text-secondary" style={{ marginBottom: "12px" }}>
              <QrCode size={16} style={{ marginRight: "8px", verticalAlign: "middle" }} />
              {t("taproot.newAddress")}
            </div>
            <input
              className="input"
              placeholder={t("taproot.assetId")}
              value={addrAssetId}
              onChange={(e) => setAddrAssetId(e.target.value)}
              style={{ marginBottom: "10px" }}
            />
            <input
              className="input"
              placeholder={t("taproot.amount")}
              type="number"
              value={addrAmount}
              onChange={(e) => setAddrAmount(e.target.value)}
              style={{ marginBottom: "12px" }}
            />
            <button
              className="btn btn-secondary"
              onClick={newAddress}
              disabled={loading || !addrAssetId || !addrAmount}
            >
              <QrCode size={16} /> {t("taproot.newAddress")}
            </button>
            {address && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  wordBreak: "break-all",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", flex: 1 }}>{address}</span>
                <button className="btn btn-ghost" onClick={copyAddress}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="glass-card"
            style={{ padding: "20px", marginBottom: "20px" }}
          >
            <div className="text-secondary" style={{ marginBottom: "12px" }}>
              <Send size={16} style={{ marginRight: "8px", verticalAlign: "middle" }} />
              {t("taproot.send")}
            </div>
            <input
              className="input"
              placeholder="Taproot Asset address"
              value={sendAddress}
              onChange={(e) => {
                setSendAddress(e.target.value);
                setDecoded(null);
              }}
              style={{ marginBottom: "12px" }}
            />
            <input
              className="input"
              placeholder="Frais sat/vB (0 = auto)"
              type="number"
              value={sendFee}
              onChange={(e) => setSendFee(e.target.value)}
              style={{ marginBottom: "12px" }}
            />
            {decoded && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "12px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "10px",
                  fontSize: "12px",
                }}
              >
                <div style={{ wordBreak: "break-all", fontFamily: "var(--font-mono)" }}>
                  {decoded.asset_id}
                </div>
                <div className="text-muted">
                  {decoded.amount.toLocaleString()} · {decoded.asset_type}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn btn-ghost" onClick={decodeAddrForSend} disabled={loading || !sendAddress}>
                Décoder
              </button>
              <button className="btn btn-primary" onClick={send} disabled={loading || !sendAddress}>
                <Send size={16} /> {t("taproot.send")}
              </button>
            </div>
            {sendTxid && (
              <div className="text-muted" style={{ marginTop: "12px", fontSize: "12px", wordBreak: "break-all" }}>
                TX: {sendTxid}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="glass-card"
            style={{ padding: "20px", marginBottom: "20px" }}
          >
            <div className="text-secondary" style={{ marginBottom: "12px" }}>
              <Download size={16} style={{ marginRight: "8px", verticalAlign: "middle" }} />
              {t("taproot.proofBackup")}
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <button
                className="btn btn-secondary"
                onClick={exportProofs}
                disabled={proofLoading}
              >
                {proofLoading ? <span className="spinner" /> : <Download size={16} />}
                {t("taproot.exportProofs")}
              </button>
              {proofs.length > 0 && (
                <button className="btn btn-ghost" onClick={downloadProofs}>
                  <Download size={16} /> {t("backup.download")}
                </button>
              )}
            </div>
            {proofs.length === 0 ? (
              <div className="text-muted">{t("taproot.noProofs")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {proofs.map((p) => (
                  <div
                    key={p.asset_id}
                    style={{
                      padding: "12px",
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="text-muted" style={{ fontSize: "12px" }}>
                      {p.amount.toLocaleString()} {t("taproot.units")}
                    </div>
                    <div
                      className="text-muted"
                      style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}
                    >
                      {p.asset_id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass-card"
            style={{ padding: "20px", marginBottom: "20px" }}
          >
            <div className="text-secondary" style={{ marginBottom: "12px" }}>
              <ShieldCheck size={16} style={{ marginRight: "8px", verticalAlign: "middle" }} />
              {t("taproot.verifyProof")}
            </div>
            <textarea
              className="input"
              placeholder={t("taproot.proofPlaceholder")}
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              rows={4}
              style={{ marginBottom: "12px" }}
            />
            <button
              className="btn btn-secondary"
              onClick={verifyProof}
              disabled={proofLoading || !proofText}
            >
              {proofLoading ? <span className="spinner" /> : <ShieldCheck size={16} />}
              {t("taproot.verify")}
            </button>
            {verifyResult !== null && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: verifyResult ? "rgba(0,255,136,0.1)" : "rgba(255,68,68,0.1)",
                  border: `1px solid ${verifyResult ? "var(--success)" : "var(--error)"}`,
                  color: verifyResult ? "var(--success)" : "var(--error)",
                }}
              >
                {verifyResult ? t("taproot.proofValid") : t("taproot.proofInvalid")}
              </div>
            )}
          </motion.div>

          {/* Soldes */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span className="text-secondary">Soldes ({balances.length})</span>
              <button className="btn btn-ghost" onClick={fetchExtras} disabled={loading}>
                <RefreshCw size={16} /> {t("refresh")}
              </button>
            </div>
            {balances.length === 0 ? (
              <div className="text-muted">Aucun solde</div>
            ) : (
              balances.map((b) => (
                <div key={b.asset_id} style={{ padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600 }}>{(b.name || "(sans nom)") + " — " + fmtAmount(b.balance, decimalById[b.asset_id] || 0)}</div>
                  <div className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{b.asset_id}</div>
                </div>
              ))
            )}
          </motion.div>

          {/* Mints en attente */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span className="text-secondary">Mints / batches ({batches.length})</span>
              <button className="btn btn-ghost" onClick={fetchBatches} disabled={loading}>
                <RefreshCw size={16} /> {t("refresh")}
              </button>
            </div>
            {batches.length === 0 ? (
              <div className="text-muted">Aucun batch</div>
            ) : (
              batches.map((b) => (
                <div key={b.batch_key} style={{ padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600 }}>{b.state} · {b.assets} asset(s)</div>
                  {b.batch_txid && (
                    <div className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>tx: {b.batch_txid}</div>
                  )}
                  <div className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{b.batch_key}</div>
                </div>
              ))
            )}
            <button className="btn btn-ghost" onClick={cancelBatch} disabled={loading} style={{ marginTop: "8px" }}>
              Annuler le batch en attente
            </button>
          </motion.div>

          {/* Historique des transferts */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span className="text-secondary">Historique transferts ({transfers.length})</span>
              <button className="btn btn-ghost" onClick={fetchTransfers} disabled={loading}>
                <RefreshCw size={16} /> {t("refresh")}
              </button>
            </div>
            {transfers.length === 0 ? (
              <div className="text-muted">Aucun transfert</div>
            ) : (
              transfers.map((tr) => (
                <div key={tr.anchor_txid + tr.timestamp} style={{ padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600 }}>{tr.total_out.toLocaleString()} · {tr.inputs}→{tr.outputs}</div>
                  <div className="text-muted" style={{ fontSize: "11px" }}>{new Date(tr.timestamp * 1000).toLocaleString()} · bloc ~{tr.height_hint}</div>
                  <div className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{tr.anchor_txid}</div>
                </div>
              ))
            )}
          </motion.div>

          {/* Réceptions entrantes */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
            <div className="text-secondary" style={{ marginBottom: "12px" }}>Réceptions ({receives.length})</div>
            {receives.length === 0 ? (
              <div className="text-muted">Aucune réception</div>
            ) : (
              receives.map((r, i) => (
                <div key={r.outpoint + i} style={{ padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600 }}>{r.status}</div>
                  <div className="text-muted" style={{ fontSize: "11px" }}>{new Date(r.timestamp * 1000).toLocaleString()} · {r.utxo_amt_sat.toLocaleString()} sat</div>
                  <div className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{r.outpoint}</div>
                </div>
              ))
            )}
          </motion.div>

          {/* Burn */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
            <div className="text-secondary" style={{ marginBottom: "12px" }}>Détruire (burn) — {burns.length} burn(s)</div>
            <input className="input" placeholder="Asset ID" value={burnId} onChange={(e) => setBurnId(e.target.value)} style={{ marginBottom: "10px" }} />
            <input className="input" placeholder="Montant à brûler" type="number" value={burnAmt} onChange={(e) => setBurnAmt(e.target.value)} style={{ marginBottom: "12px" }} />
            <button
              className="btn btn-secondary"
              onClick={() => burnAsset(burnId, Number(burnAmt))}
              disabled={loading || !burnId || !burnAmt}
            >
              Brûler définitivement
            </button>
            {burns.length > 0 && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {burns.map((b, i) => (
                  <div key={b.anchor_txid + i} className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>
                    -{b.amount} · {b.asset_id}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Infos nœud */}
          {nodeInfo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
              <div className="text-secondary" style={{ marginBottom: "12px" }}>Nœud tapd</div>
              <div className="text-muted" style={{ fontSize: "12px" }}>Réseau : {nodeInfo.network}</div>
              <div className="text-muted" style={{ fontSize: "12px" }}>tapd : {nodeInfo.version}</div>
              <div className="text-muted" style={{ fontSize: "12px" }}>lnd : {nodeInfo.lnd_version}</div>
              <div className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{nodeInfo.lnd_pubkey}</div>
            </motion.div>
          )}

          {/* Universe */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span className="text-secondary">Universe</span>
              <button className="btn btn-ghost" onClick={fetchExtras} disabled={loading}>
                <RefreshCw size={16} /> {t("refresh")}
              </button>
            </div>
            {universeStats && (
              <div className="text-muted" style={{ fontSize: "12px", marginBottom: "10px" }}>
                {universeStats.num_assets} assets · {universeStats.num_groups} groupes · {universeStats.num_syncs} syncs · {universeStats.num_proofs} preuves
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <input
                className="input"
                placeholder="Universe host (ex: universe.lightning.finance:10029)"
                value={syncHost}
                onChange={(e) => setSyncHost(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={doSyncUniverse} disabled={loading || !syncHost}>
                Sync
              </button>
            </div>
            {universeRoots.length === 0 ? (
              <div className="text-muted">Aucune racine connue</div>
            ) : (
              universeRoots.map((r) => (
                <div key={r.asset_id} style={{ padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600 }}>{r.asset_name || "(sans nom)"}</div>
                  <div className="text-muted" style={{ fontSize: "11px", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>{r.asset_id}</div>
                </div>
              ))
            )}
          </motion.div>

          {/* Lightning Assets (litd) */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span className="text-secondary">⚡ Lightning Assets</span>
              <button className="btn btn-ghost" onClick={fetchExtras} disabled={loading}>
                <RefreshCw size={16} /> {t("refresh")}
              </button>
            </div>
            {rfqQuotes && (
              <div className="text-muted" style={{ fontSize: "12px", marginBottom: "12px" }}>
                Quotes RFQ : {rfqQuotes.buy_quotes} achat · {rfqQuotes.sell_quotes} vente
              </div>
            )}
            <input className="input" placeholder="Asset ID (pour LN)" value={lnAssetId} onChange={(e) => setLnAssetId(e.target.value)} style={{ marginBottom: "10px" }} />
            <input className="input" placeholder="Peer pubkey (hex)" value={lnPeer} onChange={(e) => setLnPeer(e.target.value)} style={{ marginBottom: "14px" }} />

            <div className="text-secondary" style={{ fontSize: "13px", marginBottom: "8px" }}>Payer une invoice (en assets)</div>
            <input className="input" placeholder="Invoice BOLT11" value={lnPayReq} onChange={(e) => { setLnPayReq(e.target.value); setLnDecoded(null); }} style={{ marginBottom: "10px" }} />
            {lnDecoded && (
              <div className="text-muted" style={{ fontSize: "12px", marginBottom: "10px" }}>
                {lnDecoded.asset_amount} assets ≈ {lnDecoded.sat_amount} sat · {lnDecoded.description || "(sans description)"}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button className="btn btn-ghost" onClick={decodeLnInvoice} disabled={loading || !lnPayReq || !lnAssetId}>Décoder</button>
              <button className="btn btn-primary" onClick={payLnInvoice} disabled={loading || !lnPayReq || !lnAssetId}>
                <Send size={16} /> Payer
              </button>
            </div>

            <div className="text-secondary" style={{ fontSize: "13px", marginBottom: "8px" }}>Recevoir (créer une invoice asset)</div>
            <input className="input" placeholder="Montant en assets" type="number" value={lnRecvAmount} onChange={(e) => setLnRecvAmount(e.target.value)} style={{ marginBottom: "10px" }} />
            <input className="input" placeholder="Mémo (optionnel)" value={lnMemo} onChange={(e) => setLnMemo(e.target.value)} style={{ marginBottom: "10px" }} />
            <button className="btn btn-secondary" onClick={createLnInvoice} disabled={loading || !lnAssetId || !lnRecvAmount || !lnPeer}>
              Créer invoice
            </button>
            {lnBolt11 && (
              <div style={{ marginTop: "10px", padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "10px", display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", flex: 1, wordBreak: "break-all" }}>{lnBolt11}</span>
                <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(lnBolt11); notify(t("notifications.addressCopied"), "success"); }}>
                  <Copy size={16} />
                </button>
              </div>
            )}

            <div className="text-secondary" style={{ fontSize: "13px", margin: "16px 0 8px" }}>Ouvrir un canal d'assets</div>
            <input className="input" placeholder="Montant d'assets à engager" type="number" value={chanAmount} onChange={(e) => setChanAmount(e.target.value)} style={{ marginBottom: "10px" }} />
            <input className="input" placeholder="Frais sat/vB" type="number" value={chanFee} onChange={(e) => setChanFee(e.target.value)} style={{ marginBottom: "12px" }} />
            <button className="btn btn-secondary" onClick={fundChannel} disabled={loading || !lnAssetId || !chanAmount || !lnPeer}>
              Ouvrir le canal
            </button>
          </motion.div>
        </>
      )}

      {error && <div className="error">{error}</div>}

      <PasswordPrompt
        open={passwordPromptOpen}
        title={t("passwordPrompt.title")}
        onSubmit={(password) => {
          setPasswordPromptOpen(false);
          doConnect(password);
        }}
        onCancel={() => setPasswordPromptOpen(false)}
      />
    </div>
  );
}
