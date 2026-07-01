import { isAvailable, scan, write, textRecord } from "@tauri-apps/plugin-nfc";

export async function isNfcAvailable(): Promise<boolean> {
  try {
    return await isAvailable();
  } catch {
    return false;
  }
}

export async function writeTextRecord(text: string): Promise<void> {
  await write([textRecord(text)], { kind: { type: "ndef" } });
}

export async function scanTextRecord(): Promise<string> {
  const tag = await scan({ type: "ndef" }, { keepSessionAlive: false });
  const record = tag.records[0];
  if (!record) {
    throw new Error("Aucun enregistrement NFC trouvé.");
  }
  return decodeTextRecord(record.payload);
}

function decodeTextRecord(payload: number[]): string {
  if (payload.length === 0) {
    throw new Error("Enregistrement NFC vide.");
  }

  const status = payload[0];
  const langCodeLength = status & 0x1f;
  const isUtf16 = (status & 0x80) !== 0;
  const textStart = 1 + langCodeLength;

  if (textStart > payload.length) {
    throw new Error("Enregistrement NFC texte invalide.");
  }

  const textBytes = new Uint8Array(payload.slice(textStart));
  return isUtf16
    ? new TextDecoder("utf-16be").decode(textBytes)
    : new TextDecoder("utf-8").decode(textBytes);
}
