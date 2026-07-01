import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Copy, Check, RefreshCw } from "lucide-react";

interface CreateWalletProps {
  onBack: () => void;
  onCreated: () => void;
}

export function CreateWallet({ onBack, onCreated }: CreateWalletProps) {
  const [step, setStep] = useState<"generate" | "backup" | "password">("generate");
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const words = await invoke<string>("generate_seed", { wordCount: 12 });
      setMnemonic(words);
      setStep("backup");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createWallet() {
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
      await invoke("create_new_wallet", { password, wordCount: 12 });
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyMnemonic() {
    navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const words = mnemonic.split(" ");

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

        <AnimatePresence mode="wait">
          {step === "generate" && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ textAlign: "center" }}
            >
              <h2 className="title-lg" style={{ marginBottom: "12px" }}>
                Nouveau wallet
              </h2>
              <p className="text-secondary" style={{ marginBottom: "24px" }}>
                Générez une seed BIP39 de 12 mots sécurisée localement par Stronghold.
              </p>
              <button
                className="btn btn-primary"
                onClick={generate}
                disabled={loading}
                style={{ width: "100%" }}
              >
                {loading ? <span className="spinner" /> : <RefreshCw size={18} />}
                Générer la seed
              </button>
              {error && <div className="error">{error}</div>}
            </motion.div>
          )}

          {step === "backup" && (
            <motion.div
              key="backup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="title-lg" style={{ marginBottom: "8px" }}>
                Sauvegardez votre seed
              </h2>
              <p className="text-secondary" style={{ marginBottom: "16px" }}>
                Ces mots sont la clé de vos fonds. Ne les partagez jamais.
              </p>

              <div className="mnemonic-grid">
                {words.map((word, i) => (
                  <div key={i} className="mnemonic-word">
                    <span className="index">{(i + 1).toString().padStart(2, "0")}</span>
                    <span>{word}</span>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-secondary"
                onClick={copyMnemonic}
                style={{ width: "100%", marginBottom: "16px" }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Copié" : "Copier la seed"}
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setStep("password")}
                style={{ width: "100%" }}
              >
                J'ai sauvegardé — continuer
              </button>
            </motion.div>
          )}

          {step === "password" && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="title-lg" style={{ marginBottom: "8px" }}>
                Définir le mot de passe
              </h2>
              <p className="text-secondary" style={{ marginBottom: "20px" }}>
                Ce mot de passe chiffre votre wallet sur cet appareil.
              </p>

              <input
                type="password"
                className="input"
                placeholder="Mot de passe"
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
                onClick={createWallet}
                disabled={loading}
                style={{ width: "100%" }}
              >
                {loading ? <span className="spinner" /> : "Créer le wallet"}
              </button>
              {error && <div className="error">{error}</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
