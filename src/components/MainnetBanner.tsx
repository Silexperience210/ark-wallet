import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "../i18n/I18nContext";

export function MainnetBanner({ network }: { network?: string }) {
  const { t } = useI18n();

  if (network !== "bitcoin") return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        padding: "14px",
        borderRadius: "12px",
        background: "rgba(255,68,68,0.12)",
        border: "1px solid var(--error)",
        color: "var(--error)",
        fontSize: "13px",
        marginBottom: "20px",
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
      <span>{t("ark.mainnetBanner")}</span>
    </motion.div>
  );
}
