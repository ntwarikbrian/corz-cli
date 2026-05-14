import nodePath from "path"
import fs from "fs/promises"
import { Path } from "@corz-ai/core/global"
import type { LicensePayload } from "./types"

const LICENSE_FILE = nodePath.join(Path.data, "license.lic")

export function licensePath() {
  return LICENSE_FILE
}

export async function read() {
  try {
    const text = await Bun.file(LICENSE_FILE).text()
    const parsed = JSON.parse(text)
    return parsed as LicensePayload
  } catch {
    return undefined
  }
}

export async function write(value: LicensePayload) {
  await fs.mkdir(Path.data, { recursive: true }).catch((error: any) => {
    if (error?.code === "EEXIST") return
    throw error
  })
  await Bun.write(LICENSE_FILE, JSON.stringify(value, null, 2))
}

export * as LicenseStorage from "./storage"
