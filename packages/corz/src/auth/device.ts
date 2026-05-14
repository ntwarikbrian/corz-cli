import os from "os"
import { createHash } from "crypto"

async function execOne(cmd: string[]) {
  try {
    const proc = Bun.spawn({
      cmd,
      stdout: "pipe",
      stderr: "ignore",
    })
    const out = await new Response(proc.stdout).text()
    const code = await proc.exited
    if (code !== 0) return ""
    return out.trim()
  } catch {
    return ""
  }
}

async function readFileIfExists(filepath: string) {
  try {
    return (await Bun.file(filepath).text()).trim()
  } catch {
    return ""
  }
}

async function readWindowsMachineGuid() {
  const output = await execOne([
    "powershell",
    "-NoProfile",
    "-Command",
    "(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid",
  ])
  return output.trim()
}

function extractPlatformUUID(text: string) {
  const match = text.match(/\"IOPlatformUUID\"\s*=\s*\"([^\"]+)\"/)
  return match?.[1]
}

export async function getDeviceId() {
  const parts: string[] = []
  const warnings: string[] = []
  const platform = process.platform

  if (platform === "win32") {
    const machineGuid = await readWindowsMachineGuid()
    const cpu = await execOne([
      "powershell",
      "-NoProfile",
      "-Command",
      "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty ProcessorId)",
    ])
    const board = await execOne([
      "powershell",
      "-NoProfile",
      "-Command",
      "(Get-CimInstance Win32_BaseBoard | Select-Object -First 1 -ExpandProperty SerialNumber)",
    ])
    if (machineGuid) parts.push(`machine:${machineGuid}`)
    if (cpu) parts.push(`cpu:${cpu}`)
    if (board) parts.push(`board:${board}`)
  }

  if (platform === "linux") {
    const machineId = await readFileIfExists("/etc/machine-id")
    const productUUID = await readFileIfExists("/sys/class/dmi/id/product_uuid")
    const boardSerial = await readFileIfExists("/sys/class/dmi/id/board_serial")
    if (machineId) parts.push(`machine:${machineId}`)
    if (productUUID) parts.push(`product:${productUUID}`)
    if (boardSerial) parts.push(`board:${boardSerial}`)
  }

  if (platform === "darwin") {
    const platformUUID = await execOne(["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"])
    const model = await execOne(["sysctl", "-n", "hw.model"])
    if (platformUUID) parts.push(`platform:${extractPlatformUUID(platformUUID) ?? platformUUID}`)
    if (model) parts.push(`model:${model}`)
  }

  if (parts.length === 0) {
    warnings.push("Hardware fingerprint fallback mode is active; no platform identifiers were available.")
    parts.push(`hostname:${os.hostname()}`)
    parts.push(`arch:${os.arch()}`)
  } else if (parts.length < 2) {
    warnings.push("Hardware fingerprint fallback mode is active; only partial identifiers were available.")
    parts.push(`arch:${os.arch()}`)
  }

  const normalized = parts
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|")

  const hash = createHash("sha256").update(normalized).digest("hex").toUpperCase()
  const short = `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`
  return { deviceId: short, warnings }
}

export * as LicenseDevice from "./device"
