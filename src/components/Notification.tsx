import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useNotification } from "../contexts/NotificationContext";

export function NotificationContainer() {
  const { toasts, removeToast } = useNotification();

  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              pointerEvents: "auto",
              minWidth: "260px",
              maxWidth: "360px",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "rgba(10, 10, 18, 0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <div style={{ marginTop: "2px" }}>
              {toast.type === "success" && <CheckCircle size={18} color="#22c55e" />}
              {toast.type === "error" && <XCircle size={18} color="#ef4444" />}
              {toast.type === "info" && <Info size={18} color="#00f0ff" />}
            </div>
            <span style={{ flex: 1, fontSize: "13px", lineHeight: 1.4 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="btn btn-ghost"
              style={{ padding: "4px", margin: "-4px -4px 0 0" }}
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
