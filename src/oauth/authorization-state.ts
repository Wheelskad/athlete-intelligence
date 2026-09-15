const textEncoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function stateEncryptionKey(secret: string): Promise<CryptoKey> {
  const keyBytes = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function sealAuthorizationState(
  purpose: string,
  value: unknown,
  secret: string,
  ttlSeconds = 10 * 60,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(
    JSON.stringify({ expiresAt: Date.now() + ttlSeconds * 1_000, value }),
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: textEncoder.encode(purpose) },
    await stateEncryptionKey(secret),
    plaintext,
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function openAuthorizationState<T>(
  purpose: string,
  state: string,
  secret: string,
): Promise<T | undefined> {
  const separator = state.indexOf(".");
  if (separator < 1) return undefined;
  try {
    const iv = base64UrlToBytes(state.slice(0, separator));
    const ciphertext = base64UrlToBytes(state.slice(separator + 1));
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Uint8Array.from(iv),
        additionalData: textEncoder.encode(purpose),
      },
      await stateEncryptionKey(secret),
      Uint8Array.from(ciphertext),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as {
      expiresAt?: unknown;
      value?: T;
    };
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) return undefined;
    return parsed.value;
  } catch {
    return undefined;
  }
}
