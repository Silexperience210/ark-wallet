import { useI18n } from "../i18n/I18nContext";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useI18n();

  if (!open) return null;

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
      onClick={onCancel}
      role="presentation"
    >
      <div
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <h2 id="confirm-title" className="title-md" style={{ marginBottom: "12px" }}>
          {title}
        </h2>
        <p id="confirm-message" className="text-muted" style={{ marginBottom: "24px", lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t("confirmCancel")}
          </button>
          <button
            type="button"
            className={confirmVariant === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
          >
            {confirmText || t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
