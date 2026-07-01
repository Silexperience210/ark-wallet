import { motion } from "framer-motion";
import { Wallet, Shield, Zap, Layers } from "lucide-react";

interface WelcomeProps {
  onCreate: () => void;
  onImport: () => void;
}

export function Welcome({ onCreate, onImport }: WelcomeProps) {
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
        transition={{ duration: 0.6 }}
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{
            width: "80px",
            height: "80px",
            margin: "0 auto 24px",
            borderRadius: "24px",
            background: "linear-gradient(135deg, rgba(0,240,255,0.2), rgba(168,85,247,0.2))",
            border: "1px solid rgba(0,240,255,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 40px rgba(0,240,255,0.2)",
          }}
        >
          <Wallet size={36} color="#00f0ff" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="title-xl"
          style={{ marginBottom: "12px" }}
        >
          OZark Wallet
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-secondary"
          style={{ marginBottom: "32px" }}
        >
          Wallet Bitcoin natif sur ARK Layer 2. On-chain, Lightning, Taproot Assets — en self-custody.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <Feature icon={<Shield size={18} />} label="Self-custody" />
          <Feature icon={<Zap size={18} />} label="Lightning" />
          <Feature icon={<Layers size={18} />} label="Taproot Assets" />
          <Feature icon={<Wallet size={18} />} label="ARK L2" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <button className="btn btn-primary" onClick={onCreate} style={{ width: "100%" }}>
            Créer un wallet
          </button>
          <button className="btn btn-secondary" onClick={onImport} style={{ width: "100%" }}>
            Importer un wallet
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "12px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        fontSize: "13px",
        color: "var(--text-secondary)",
      }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
