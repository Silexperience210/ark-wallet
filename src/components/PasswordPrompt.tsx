import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";

interface PasswordPromptProps {
  open: boolean;
  title: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PasswordPrompt({ open, title, onSubmit, onCancel }: PasswordPromptProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    onSubmit(password);
    setPassword("");
  }

  function handleCancel() {
    setPassword("");
    onCancel();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={handleCancel}
      role="presentation"
    >
      <form
        style={{
          width: "100%",
          maxWidth: "420px",
          margin: "16px",
          padding: "24px",
          borderRadius: "16px",
          background: "var(--surface, #0b0f19)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
      >
        <h2 id="password-title" className="title-md" style={{ marginBottom: "16px" }}>
          {title}
        </h2>
        <input
          type="password"
          className="input"
          placeholder={t("passwordPrompt.placeholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{ marginBottom: "20px" }}
        />
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={handleCancel}>
            {t("confirmCancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!password}>
            {t("submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
