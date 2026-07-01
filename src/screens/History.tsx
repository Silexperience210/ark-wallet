import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Zap,
  Copy,
  Check,
  Filter,
} from "lucide-react";
import { useNotification } from "../contexts/NotificationContext";

interface HistoryProps {
  onBack: () => void;
}

interface OnchainTx {
  txid: string;
  amount_sats: number;
  kind: string;
  confirmations?: number;
  timestamp?: number;
}

interface ArkMovement {
  id: number;
  subsystem: string;
  kind: string;
  status: string;
  amount_sats: number;
  fee_sats: number;
  created_at: number;
  completed_at?: number;
  description: string;
}

type HistoryItem =
  | { type: "onchain"; data: OnchainTx }
  | { type: "ark"; data: ArkMovement };

type FilterKind = "all" | "onchain" | "ark";

export function History({ onBack }: HistoryProps) {
  const { notify } = useNotification();
  const [onchainTxs, setOnchainTxs] = useState<OnchainTx[]>([]);
  const [arkMovements, setArkMovements] = useState<ArkMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function fetchHistory() {
    setLoading(true);
    setError("");
    try {
      const [onchain, ark] = await Promise.all([
        invoke<OnchainTx[]>("get_onchain_history_command"),
        invoke<ArkMovement[]>("get_ark_history_command"),
      ]);
      setOnchainTxs(onchain);
      setArkMovements(ark);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  const items = useMemo<HistoryItem[]>(() => {
    const combined: HistoryItem[] = [
      ...onchainTxs.map((t) => ({ type: "onchain" as const, data: t })),
      ...arkMovements.map((m) => ({ type: "ark" as const, data: m })),
    ];
    return combined.sort((a, b) => {
      const ta = a.type === "onchain" ? a.data.timestamp : a.data.created_at;
      const tb = b.type === "onchain" ? b.data.timestamp : b.data.created_at;
      return (tb ?? 0) - (ta ?? 0);
    });
  }, [onchainTxs, arkMovements]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  function copyTxid(txid: string) {
    navigator.clipboard.writeText(txid);
    notify("TXID copié", "success");
    setCopiedTxid(txid);
    setTimeout(() => setCopiedTxid(null), 2000);
  }

  function formatDate(ts?: number): string {
    if (!ts) return "Date inconnue";
    return new Date(ts * 1000).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatSats(sats: number): string {
    return `${sats.toLocaleString()} sats`;
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
          <h1 className="title-lg">Historique</h1>
          <p className="text-muted">Transactions on-chain et Ark</p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> Retour
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card"
        style={{
          padding: "12px",
          marginBottom: "20px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Filter size={16} className="text-muted" />
        {(["all", "onchain", "ark"] as FilterKind[]).map((f) => (
          <button
            key={f}
            className="btn"
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: filter === f ? "var(--accent-cyan)" : "rgba(0,0,0,0.2)",
              color: filter === f ? "#000" : "var(--text-secondary)",
            }}
          >
            {f === "all" ? "Tout" : f === "onchain" ? "On-chain" : "ARK"}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={fetchHistory} disabled={loading} style={{ marginLeft: "auto" }}>
          {loading ? <span className="spinner" /> : <RefreshCw size={16} />}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        {filteredItems.length === 0 && !loading && (
          <div className="glass-card" style={{ padding: "32px", textAlign: "center" }}>
            <p className="text-muted">Aucune transaction trouvée.</p>
          </div>
        )}

        {filteredItems.map((item, idx) => {
          if (item.type === "onchain") {
            const tx = item.data;
            const isSend = tx.kind === "send";
            const isSelf = tx.kind === "self";
            return (
              <div
                key={`on-${tx.txid}-${idx}`}
                className="glass-card"
                style={{
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isSend ? "#ef4444" : isSelf ? "#a855f7" : "#22c55e",
                  }}
                >
                  {isSend ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600 }}>
                      {isSend ? "Envoi on-chain" : isSelf ? "Self-transfer" : "Réception on-chain"}
                    </span>
                    <span style={{ fontWeight: 600, color: isSend ? "#ef4444" : isSelf ? "#a855f7" : "#22c55e" }}>
                      {isSend ? "-" : "+"}{formatSats(Math.abs(tx.amount_sats))}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: "12px", marginBottom: "4px" }}>
                    {formatDate(tx.timestamp)}
                    {tx.confirmations !== undefined && (
                      <span style={{ marginLeft: "8px" }}>
                        · {tx.confirmations === 0 ? "non confirmé" : `${tx.confirmations} confirmation${tx.confirmations > 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      className="text-muted"
                      style={{ fontFamily: "var(--font-mono)", fontSize: "11px", wordBreak: "break-all" }}
                    >
                      {tx.txid}
                    </span>
                    <button className="btn btn-ghost" onClick={() => copyTxid(tx.txid)} style={{ padding: "4px" }}>
                      {copiedTxid === tx.txid ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          const m = item.data;
          const isSend = m.amount_sats < 0;
          return (
            <div
              key={`ark-${m.id}-${idx}`}
              className="glass-card"
              style={{
                padding: "16px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isSend ? "#f97316" : "#00f0ff",
                }}
              >
                <Zap size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600 }}>
                    {m.subsystem} · {m.kind}
                  </span>
                  <span style={{ fontWeight: 600, color: isSend ? "#f97316" : "#00f0ff" }}>
                    {isSend ? "-" : "+"}{formatSats(Math.abs(m.amount_sats))}
                  </span>
                </div>
                <div className="text-muted" style={{ fontSize: "12px", marginBottom: "4px" }}>
                  {formatDate(m.created_at)}
                  <span style={{ marginLeft: "8px" }}>· {m.status}</span>
                  {m.fee_sats > 0 && <span style={{ marginLeft: "8px" }}>· fee {m.fee_sats.toLocaleString()} sats</span>}
                </div>
                {m.description && (
                  <div className="text-muted" style={{ fontSize: "11px", wordBreak: "break-all" }}>
                    {m.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      {error && <div className="error" style={{ marginTop: "12px" }}>{error}</div>}
    </div>
  );
}
