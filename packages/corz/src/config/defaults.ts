export type LicenseConfig = {
  authUrl: string
  authTimeoutMs: number
  authMaxRetries: number
  retryDelayMs: number
  disableLicenseGate: boolean
  sharedSecret: string | undefined
}

export const defaults: LicenseConfig = {
  authUrl: "https://api.corz.ai/v1/activate",
  authTimeoutMs: 30000,
  authMaxRetries: 3,
  retryDelayMs: 1000,
  disableLicenseGate: false,
  sharedSecret: undefined,
}

export * as ConfigDefaults from "./defaults"
