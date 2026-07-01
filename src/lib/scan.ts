import { checkPermissions, requestPermissions, scan, cancel, Format } from "@tauri-apps/plugin-barcode-scanner";

/** Default time before a stuck scan is aborted (ms). */
const SCAN_TIMEOUT_MS = 60_000;

export async function scanQrCode(timeoutMs: number = SCAN_TIMEOUT_MS): Promise<string | null> {
  try {
    let perm = await checkPermissions();
    if (perm !== "granted") {
      perm = await requestPermissions();
    }
    if (perm !== "granted") {
      alert("Permission caméra refusée.");
      return null;
    }

    // Race the scan against a timeout so a camera that never returns a code
    // (e.g. user walks away) cannot block the UI forever. On timeout we cancel
    // the native scan session to release the camera.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        cancel().catch(() => undefined);
        resolve(null);
      }, timeoutMs);
    });

    const scanning = scan({ formats: [Format.QRCode], cameraDirection: "back" }).then(
      (result) => result.content,
    );

    const content = await Promise.race([scanning, timeout]);
    if (timer) clearTimeout(timer);
    return content;
  } catch (e) {
    console.error("Scan error:", e);
    return null;
  }
}
