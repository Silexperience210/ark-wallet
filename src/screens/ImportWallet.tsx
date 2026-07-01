import { useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, QrCode, Nfc, FileText } from "lucide-react";
import { scanQrCode } from "../lib/scan";
import { isNfcAvailable, scanTextRecord } from "../lib/nfc";
import { useNotification } from "../contexts/NotificationContext";
import { useI18n } from "../i18n/I18nContext";
import { PasswordPrompt } from "../components/PasswordPrompt";

interface ImportWalletProps {
  onBack: () => void;
  onImported: () => void;
}

export function ImportWallet({ onBack, onImported }: ImportWalletProps) {
  const { t } = useI18n();
  const { notify } = useNotification();
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingBackup, setPendingBackup] = useState<{ ciphertext: string; source: string } | null>(null);

  function decryptBackupPrompt(ciphertext: string, source: string) {
    if (!ciphertext) {
      setError(`Aucune donnée trouvée dans le backup ${source}.`);
      return;
    }
    // Open the in-app password modal instead of the native window.prompt
    // (which is unstyled and unreliable inside the Android WebView).
    setError("");
    setPendingBackup({ ciphertext, source });
  }

  async function handleBackupPassword(password: string) {
    const backup = pendingBackup;
    setPendingBackup(null);
    if (!backup || !password) return;
    try {
      const plaintext = await invoke<string>("decrypt_backup", {
        ciphertext: backup.ciphertext,
        password,
      });
      setMnemonic(plaintext);
    } catch (e) {
      setError(String(e));
    }
  }

  async function readQr() {
    setError("");
    try {
      const text = await scanQrCode();
      if (!text) return;
      await decryptBackupPrompt(text, "QR");
    } catch (e) {
      setError(String(e));
    }
  }

  async function readNfc() {
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
      notify(t("nfc.readSuccess"), "success");
      await decryptBackupPrompt(ciphertext, "NFC");
    } catch (e) {
      setError(`${t("nfc.readError")}: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function pasteText() {
    setError("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setError("Presse-papiers vide.");
        return;
      }
      await decryptBackupPrompt(text, "texte");
    } catch (e) {
      setError(String(e));
    }
  }

  async function importWallet() {
    if (mnemonic.trim().split(/\s+/).length < 12) {
      setError("Veuillez entrer une phrase de récupération valide (12+ mots).");
      return;
    }
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
      const valid = await invoke<boolean>("validate_mnemonic_command", { mnemonic: mnemonic.trim() });
      if (!valid) {
        setError("Phrase de récupération invalide.");
        setLoading(false);
        return;
      }
      await invoke("import_wallet", { password, mnemonic: mnemonic.trim() });
      onImported();
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
          Importer un wallet
        </h2>
        <p className="text-secondary" style={{ marginBottom: "20px" }}>
          Restaurez votre wallet depuis votre phrase de récupération BIP39.
        </p>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <button className="btn btn-secondary" style={{ flex: 1, minWidth: "90px" }} onClick={readQr}>
            <QrCode size={18} /> QR
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, minWidth: "90px" }} onClick={readNfc}>
            <Nfc size={18} /> NFC
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, minWidth: "90px" }} onClick={pasteText}>
            <FileText size={18} /> Coller
          </button>
        </div>

        <textarea
          className="input"
          placeholder="Entrez vos 12 ou 24 mots..."
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          rows={4}
          style={{
            marginBottom: "12px",
            resize: "none",
            fontFamily: "var(--font-mono)",
          }}
        />

        <input
          type="password"
          className="input"
          placeholder="Nouveau mot de passe"
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
          onClick={importWallet}
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? <span className="spinner" /> : "Importer le wallet"}
        </button>
        {error && <div className="error">{error}</div>}
      </motion.div>

      <PasswordPrompt
        open={pendingBackup !== null}
        title={pendingBackup ? `Mot de passe du backup ${pendingBackup.source}` : ""}
        onSubmit={handleBackupPassword}
        onCancel={() => setPendingBackup(null)}
      />
    </div>
  );
}
