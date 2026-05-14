export type LicensePayload = {
  token: string
  user_id: string
  device_id: string
  expires_at: string
  signature: string
}

export type VerifyResult =
  | { ok: true; license: LicensePayload }
  | {
      ok: false
      code: "missing" | "malformed" | "invalid_signature" | "device_mismatch" | "expired" | "config_error"
      message: string
    }

export type ActivationResult =
  | { ok: true; license: LicensePayload; device: DeviceResult }
  | { ok: false; error: string }

export type DeviceResult = {
  deviceId: string
  warnings: string[]
}

export type ProgressCallback = (message: string) => void

export * as LicenseTypes from "./types"
