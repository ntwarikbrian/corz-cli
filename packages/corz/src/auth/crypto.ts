import type { LicensePayload } from "./types"

export const EMBEDDED_PUBLIC_KEY_BASE64 = "0GlpjZvvC9M9yUtn+mnxPCFfOMvc2iu0pXEAcFWFiGM="

function getPublicKey() {
  if (process.env.NODE_ENV === "test" && process.env.CORZ_AUTH_PUBLIC_KEY) {
    return process.env.CORZ_AUTH_PUBLIC_KEY
  }
  return EMBEDDED_PUBLIC_KEY_BASE64
}

function decodeBase64(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"))
}

export function canonicalMessage(input: Pick<LicensePayload, "token" | "user_id" | "device_id" | "expires_at">) {
  return `${input.token}\n${input.user_id}\n${input.device_id}\n${input.expires_at}`
}

export async function verifySignature(license: LicensePayload, publicKeyBase64 = getPublicKey()) {
  if (!publicKeyBase64) return false
  const keyBytes = decodeBase64(publicKeyBase64)
  const sigBytes = decodeBase64(license.signature)
  const message = new TextEncoder().encode(
    canonicalMessage({
      token: license.token,
      user_id: license.user_id,
      device_id: license.device_id,
      expires_at: license.expires_at,
    }),
  )

  try {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "Ed25519" }, false, ["verify"])
    return await crypto.subtle.verify({ name: "Ed25519" }, key, sigBytes, message)
  } catch {
    return false
  }
}

export * as LicenseCrypto from "./crypto"
