import { verifyLicense } from "@/auth/verification"
import { load as loadLicenseConfig } from "@/config/loader"
import { read } from "@/auth/storage"
import type { LicensePayload } from "@/auth/types"

export type LicenseDiagnostics = {
  licensed: boolean
  license?: LicensePayload
  message?: string
}

export async function getDiagnostics(): Promise<LicenseDiagnostics> {
  const license = await verifyLicense()
  if (license.ok) {
    return { licensed: true, license: license.license }
  }
  return { licensed: false, message: license.message }
}

export async function printDiagnostics(): Promise<void> {
  const diag = await getDiagnostics()
  if (diag.licensed && diag.license) {
    const shortToken = diag.license.token.slice(0, 8)
    const expires = new Date(diag.license.expires_at).toLocaleDateString()
    process.stderr.write(`License: active (token: ${shortToken}..., expires: ${expires})\n`)
  } else {
    process.stderr.write(`License: ${diag.message}\n`)
  }
}

const DATE_UNITS = [
  { unit: "year", ms: 365.25 * 86400000 },
  { unit: "month", ms: 30 * 86400000 },
  { unit: "day", ms: 86400000 },
  { unit: "hour", ms: 3600000 },
] as const

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired"
  for (const { unit, ms: unitMs } of DATE_UNITS) {
    const count = Math.floor(ms / unitMs)
    if (count >= 1) return `${count} ${unit}${count > 1 ? "s" : ""}`
  }
  return "less than an hour"
}

export async function printStatus(): Promise<void> {
  const config = loadLicenseConfig()
  const license = await read()

  process.stderr.write("License status:\n")
  if (config.disableLicenseGate) {
    process.stderr.write("  Gate: disabled\n")
  }
  process.stderr.write(`  Auth URL: ${config.authUrl}\n`)

  if (!license) {
    process.stderr.write("  Status: no license file found\n")
    return
  }

  const expiresAt = Date.parse(license.expires_at)
  const remaining = expiresAt - Date.now()
  const remainingStr = formatRemaining(remaining)
  const status = remaining <= 0 ? "expired" : "active"

  process.stderr.write(`  Status: ${status}\n`)
  process.stderr.write(`  Token: ${license.token.slice(0, 8)}...\n`)
  process.stderr.write(`  Expires: ${new Date(license.expires_at).toLocaleString()} (${remainingStr} remaining)\n`)
  process.stderr.write(`  Device: ${license.device_id}\n`)
}

export function shouldBypass(args: string[]) {
  if (args.length === 0) return false
  if (args.includes("--help") || args.includes("-h")) return true
  if (args.includes("--version") || args.includes("-v")) return true
  const command = args.find((x) => !x.startsWith("-"))
  if (!command) return false
  return command === "activate"
}

export function gateMessage(code: string, message: string): string {
  switch (code) {
    case "missing":
      return `No license found. Run \`corz activate\` to activate this device.`
    case "expired":
      return `License expired. Run \`corz activate\` to activate with a new token.`
    case "device_mismatch":
      return `License is bound to a different device. Run \`corz activate\` to activate this device.`
    default:
      return `License check failed: ${message}\nRun \`corz activate\` to activate this device.`
  }
}

const LICENSE_CHECK_INTERVAL_MS = 60_000

export function startLicenseMonitor(): void {
  const config = loadLicenseConfig()
  if (config.disableLicenseGate) return

  setInterval(async () => {
    const result = await verifyLicense()
    if (!result.ok && result.code === "expired") {
      process.stderr.write("\n" + gateMessage("expired", "License has expired during this session") + "\n")
      process.exit(1)
    }
  }, LICENSE_CHECK_INTERVAL_MS).unref()
}

export async function check(): Promise<void> {
  const config = loadLicenseConfig()
  if (config.disableLicenseGate) return

  const license = await verifyLicense()
  if (!license.ok) {
    const err = new Error(gateMessage(license.code, license.message))
    err.name = "LicenseGateError"
    throw err
  }

  startLicenseMonitor()
}

export * as LicenseBootstrap from "./bootstrap"
