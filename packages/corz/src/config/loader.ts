import { defaults, type LicenseConfig } from "./defaults"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function number(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function load(): LicenseConfig {
  return {
    authUrl: process.env.CORZ_AUTH_URL ?? defaults.authUrl,
    authTimeoutMs: number("CORZ_AUTH_TIMEOUT_MS") ?? defaults.authTimeoutMs,
    authMaxRetries: number("CORZ_AUTH_MAX_RETRIES") ?? defaults.authMaxRetries,
    retryDelayMs: number("CORZ_AUTH_RETRY_DELAY_MS") ?? defaults.retryDelayMs,
    disableLicenseGate: truthy("CORZ_DISABLE_LICENSE_GATE") || defaults.disableLicenseGate,
    sharedSecret: process.env.CORZ_CONVEX_SHARED_SECRET ?? defaults.sharedSecret,
  }
}

export * as ConfigLoader from "./loader"
