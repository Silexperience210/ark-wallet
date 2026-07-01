import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { Lock, ArrowRight, AlertTriangle } from "lucide-react";
import { useI18n } from "../i18n/I18nContext";

interface UnlockWalletProps {
  onUnlocked: () => void;
  onReset: () => void;
}

interface ArkConfig {
  server_address: string;
  esplora_address?: string;
  server_access_token?: string;
  network: string;
}

export function UnlockWallet({ onUnlocked, onReset }: UnlockWalletProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMainnet, setIsMainnet] = useState(false);
  const [mainnetAck, setMainnetAck] = useState(false);

  useEffect(() => {
    invoke<ArkConfig>("load_ark_config_command")
      .then((cfg) => setIsMainnet(cfg.network === "bitcoin"))
      .catch(() => setIsMainnet(false));
  }, []);

  async function unlock() {
    setLoading(true);
    setError("");
    try {
      await invoke("unlock_wallet_command", { password });
      onUnlocked();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "360px",
          padding: "40px",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          style={{
            width: "64px",
            height: "64px",
            margin: "0 auto 20px",
            borderRadius: "20px",
            background: "rgba(0,240,255,0.1)",
            border: "1px solid rgba(0,240,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Lock size={28} color="#00f0ff" />
        </motion.div>

        <h2 className="title-lg" style={{ marginBottom: "8px" }}>
          {t("unlock.title")}
        </h2>
        <p className="text-secondary" style={{ marginBottom: "24px" }}>
          {t("unlock.subtitle")}
        </p>

        {isMainnet && (
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "rgba(255,68,68,0.12)",
              border: "1px solid var(--error)",
              color: "var(--error)",
              fontSize: "13px",
              marginBottom: "16px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={18} />
              <span>{t("unlock.mainnetTitle")}</span>
            </div>
            <div style={{ marginBottom: "10px" }}>{t("unlock.mainnetWarning")}</div>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                cursor: "pointer",
                fontSize: "12px",
                lineHeight: "1.4",
              }}
            >
              <input
                type="checkbox"
                checked={mainnetAck}
                onChange={(e) => setMainnetAck(e.target.checked)}
                style={{ marginTop: "2px" }}
              />
              <span>{t("unlock.mainnetConfirm")}</span>
            </label>
          </div>
        )}

        <input
          type="password"
          className="input"
          placeholder={t("backup.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && unlock()}
          style={{ marginBottom: "16px" }}
        />

        <button
          className="btn btn-primary"
          onClick={unlock}
          disabled={loading || !password || (isMainnet && !mainnetAck)}
          style={{ width: "100%", marginBottom: "12px" }}
        >
          {loading ? <span className="spinner" /> : <ArrowRight size={18} />}
          {t("unlock.title")}
        </button>

        <button className="btn btn-ghost" onClick={onReset} style={{ width: "100%" }}>
          {t("unlock.resetWallet")}
        </button>

        {error && <div className="error">{error}</div>}
      </motion.div>
    </div>
  );
}
