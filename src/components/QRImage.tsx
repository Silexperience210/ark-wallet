import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/**
 * Renders a scannable QR code from `value` onto a canvas.
 * Used for Taproot Asset receive addresses and asset Lightning invoices.
 */
export function QRImage({ value, size = 180 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !value) return;
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000ff", light: "#ffffffff" },
    }).catch(() => {});
  }, [value, size]);

  if (!value) return null;
  return (
    <div style={{ background: "#fff", padding: 10, borderRadius: 16, lineHeight: 0 }}>
      <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, display: "block" }} />
    </div>
  );
}
