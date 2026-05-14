import { getDeviceId } from "./device"
import { verifySignature, EMBEDDED_PUBLIC_KEY_BASE64 } from "./crypto"
import { read } from "./storage"
import type { LicensePayload, VerifyResult } from "./types"

export async function verifyLicense(): Promise<VerifyResult> {
  const license = await read()
  if (!license) {
    return {
      ok: false,
      code: "missing",
      message: `No license found`,
    }
  }
  return verifyPayload(license)
}

export async function verifyPayload(license: LicensePayload, expectedDeviceId?: string): Promise<VerifyResult> {
  const publicKey = EMBEDDED_PUBLIC_KEY_BASE64
  if (!publicKey) {
    return {
      ok: false,
      code: "config_error",
      message: "Missing embedded license public key.",
    }
  }

  if (!license || typeof license !== "object") {
    return { ok: false, code: "malformed", message: "License payload is malformed" }
  }

  for (const key of ["token", "user_id", "device_id", "expires_at", "signature"] as const) {
    if (!license[key] || typeof license[key] !== "string") {
      return { ok: false, code: "malformed", message: `License field '${key}' is missing or invalid` }
    }
  }

  const deviceId = expectedDeviceId ?? (await getDeviceId()).deviceId
  if (license.device_id !== deviceId) {
    return { ok: false, code: "device_mismatch", message: "License is bound to a different device" }
  }

  const expiresAt = Date.parse(license.expires_at)
  if (!Number.isFinite(expiresAt)) {
    return { ok: false, code: "malformed", message: "License expiry is invalid" }
  }
  if (Date.now() >= expiresAt) {
    return { ok: false, code: "expired", message: "License is expired" }
  }

  const validSignature = await verifySignature(license, publicKey)
  if (!validSignature) {
    return { ok: false, code: "invalid_signature", message: "License signature verification failed" }
  }

  return { ok: true, license }
}

export * as LicenseVerification from "./verification"
