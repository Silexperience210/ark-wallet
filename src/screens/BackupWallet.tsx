import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Lock,
  Copy,
  Check,
  Download,
  QrCode,
  FileText,
  Nfc,
  Eye,
  Upload,
} from "lucide-react";
import QRCode from "qrcode";
import { scanQrCode } from "../lib/scan";
import {
  isNfcAvailable,
  writeTextRecord,
  scanTextRecord,
} from "../lib/nfc";
import { useNotification } from "../contexts/NotificationContext";
import { useI18n } from "../i18n/I18nContext";

interface BackupWalletProps {
  onBack: () => void;
}

type Mode = "export" | "import";

export function BackupWallet({ onBack }: BackupWalletProps) {
  const { t } = useI18n();
  const { notify } = useNotification();
  const [mode, setMode] = useState<Mode>("export");

  // Export state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [qrData, setQrData] = useState("");
  const [encryptedText, setEncryptedText] = useState("");

  // Import state
  const [importText, setImportText] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [recoveredSeed, setRecoveredSeed] = useState("");

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [writingNfc, setWritingNfc] = useState(false);

  async function generateBackup() {
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const mnemonic = await invoke<string>("reveal_mnemonic", { password });
      const encrypted = await invoke<string>("encrypt_backup", {
        plaintext: mnemonic,
        password,
      });
      const qr = await QRCode.toDataURL(encrypted, {
        width: 320,
        margin: 2,
        color: {
          dark: "#00f0ff",
          light: "#050508",
        },
      });
      setQrData(qr);
      setEncryptedText(encrypted);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function copyQrText() {
    if (!encryptedText) return;
    try {
      await navigator.clipboard.writeText(encryptedText);
      notify("Backup copié", "success");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossible de copier le texte chiffré.");
    }
  }

  function downloadQr() {
    if (!qrData) return;
    const link = document.createElement("a");
    link.href = qrData;
    link.download = "ozark-wallet-backup.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function writeNfc() {
    if (!encryptedText || writingNfc) return;
    setError("");
    setWritingNfc(true);
    try {
      const available = await isNfcAvailable();
      if (!available) {
        setError(t("nfc.notAvailable"));
        return;
      }
      await writeTextRecord(encryptedText);
      notify(t("nfc.writeSuccess"), "success");
    } catch (e) {
      setError(`${t("nfc.writeError")}: ${e}`);
    } finally {
      setWritingNfc(false);
    }
  }

  async function decryptImport(ciphertext: string, source: string) {
    if (!ciphertext) {
      setError(`Aucune donnée trouvée dans le backup ${source}.`);
      return;
    }
    if (!importPassword) {
      setError("Veuillez saisir le mot de passe du backup.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const plaintext = await invoke<string>("decrypt_backup", {
        ciphertext,
        password: importPassword,
      });
      setRecoveredSeed(plaintext);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function importFromQr() {
    setError("");
    try {
      const text = await scanQrCode();
      if (!text) return;
      setImportText(text);
      await decryptImport(text, "QR");
    } catch (e) {
      setError(String(e));
    }
  }

  async function importFromNfc() {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const available = await isNfcAvailable();
      if (!available) {
        setError(t("nfc.notAvailable"));
        return;
      }
      const ciphertext = await scanTextRecord();
      setImportText(ciphertext);
      notify(t("nfc.readSuccess"), "success");
      await decryptImport(ciphertext, "NFC");
    } catch (e) {
      setError(`${t("nfc.readError")}: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function pasteImport() {
    setError("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setError("Presse-papiers vide.");
        return;
      }
      setImportText(text);
    } catch (e) {
      setError(String(e));
    }
  }

  function copySeed() {
    if (!recoveredSeed) return;
    navigator.clipboard.writeText(recoveredSeed);
    notify("Seed copiée", "success");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    setError("");
  }, [mode]);

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
        overflow: "auto",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "32px",
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={onBack}
          style={{ padding: "8px", marginBottom: "16px" }}
        >
          <ArrowLeft size={18} /> Retour
        </button>

        <h2 className="title-lg" style={{ marginBottom: "8px" }}>
          Backup
        </h2>
        <p className="text-secondary" style={{ marginBottom: "20px" }}>
          Chiffrez ou restaurez votre seed depuis QR, NFC ou texte.
        </p>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "20px",
            background: "rgba(0,0,0,0.2)",
            padding: "4px",
            borderRadius: "12px",
          }}
        >
          <button
            className="btn"
            onClick={() => setMode("export")}
            style={{
              flex: 1,
              background: mode === "export" ? "var(--accent-cyan)" : "transparent",
              color: mode === "export" ? "#000" : "var(--text-secondary)",
            }}
          >
            Exporter
          </button>
          <button
            className="btn"
            onClick={() => setMode("import")}
            style={{
              flex: 1,
              background: mode === "import" ? "var(--accent-cyan)" : "transparent",
              color: mode === "import" ? "#000" : "var(--text-secondary)",
            }}
          >
            Importer
          </button>
        </div>

        {mode === "export" && (
          <>
            {!qrData ? (
              <>
                <input
                  type="password"
                  className="input"
                  placeholder="Mot de passe du wallet"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ marginBottom: "12px" }}
                />
                <input
                  type="password"
                  className="input"
                  placeholder="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ marginBottom: "16px" }}
                />
                <button
                  className="btn btn-primary"
                  onClick={generateBackup}
                  disabled={loading}
                  style={{ width: "100%" }}
                >
                  {loading ? <span className="spinner" /> : <Lock size={18} />}
                  Générer le QR
                </button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: "center" }}
              >
                <div
                  style={{
                    padding: "16px",
                    background: "rgba(0,0,0,0.4)",
                    borderRadius: "16px",
                    border: "1px solid var(--border)",
                    marginBottom: "16px",
                    display: "inline-block",
                  }}
                >
                  <img src={qrData} alt="Backup QR" style={{ width: "100%", maxWidth: "280px" }} />
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button className="btn btn-secondary" onClick={copyQrText} style={{ flex: 1 }}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copié" : "Copier"}
                  </button>
                  <button className="btn btn-secondary" onClick={downloadQr} style={{ flex: 1 }}>
                    <Download size={16} /> Télécharger
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={writeNfc}
                    disabled={writingNfc}
                    style={{ flex: 1 }}
                  >
                    {writingNfc ? <span className="spinner" /> : <Nfc size={16} />}
                    {writingNfc ? t("loading") : "NFC"}
                  </button>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setQrData("");
                    setPassword("");
                    setConfirmPassword("");
                    setEncryptedText("");
                  }}
                  style={{ width: "100%", marginTop: "12px" }}
                >
                  Générer un autre
                </button>
              </motion.div>
            )}
          </>
        )}

        {mode === "import" && (
          <>
            {!recoveredSeed ? (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, minWidth: "90px" }}
                    onClick={importFromQr}
                    disabled={loading}
                  >
                    <QrCode size={18} /> QR
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, minWidth: "90px" }}
                    onClick={importFromNfc}
                    disabled={loading}
                  >
                    <Nfc size={18} /> NFC
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, minWidth: "90px" }}
                    onClick={pasteImport}
                    disabled={loading}
                  >
                    <FileText size={18} /> Coller
                  </button>
                </div>
                <textarea
                  className="input"
                  placeholder="Backup chiffré (texte)"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={3}
                  style={{
                    marginBottom: "12px",
                    resize: "none",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                  }}
                />
                <input
                  type="password"
                  className="input"
                  placeholder="Mot de passe du backup"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  style={{ marginBottom: "16px" }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => decryptImport(importText, "texte")}
                  disabled={loading || !importText || !importPassword}
                  style={{ width: "100%" }}
                >
                  {loading ? <span className="spinner" /> : <Eye size={18} />}
                  Décrypter
                </button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <p className="text-secondary" style={{ marginBottom: "12px", fontSize: "13px" }}>
                  <Upload size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                  Seed récupérée :
                </p>
                <div className="mnemonic-grid" style={{ marginBottom: "16px" }}>
                  {recoveredSeed.split(" ").map((word, i) => (
                    <div key={i} className="mnemonic-word">
                      <span className="index">{(i + 1).toString().padStart(2, "0")}</span>
                      <span>{word}</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary" onClick={copySeed} style={{ width: "100%" }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copiée" : "Copier la seed"}
                </button>
                <p className="text-muted" style={{ marginTop: "12px", fontSize: "11px" }}>
                  Pour restaurer ce wallet, notez la seed, supprimez le wallet actuel, puis utilisez l'écran d'import.
                </p>
              </motion.div>
            )}
          </>
        )}

        {error && <div className="error">{error}</div>}
      </motion.div>
    </div>
  );
}
