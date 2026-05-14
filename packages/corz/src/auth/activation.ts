import { getDeviceId } from "./device"
import { verifyPayload } from "./verification"
import { write } from "./storage"
import type { ActivationResult, ProgressCallback, LicensePayload } from "./types"

const DEFAULT_ACTIVATE_URL = "https://api.corz.ai/v1/activate"

const DEFAULT_TIMEOUT = 30000
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function attemptActivation(
  url: string,
  headers: Record<string, string>,
  body: { token: string; device_id: string },
  timeout: number,
  onProgress?: ProgressCallback,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  onProgress?.(`Connecting to activation server...`)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return response
  } catch (error) {
    clearTimeout(timer)
    throw error
  }
}

export async function activateLicense(token: string, onProgress?: ProgressCallback): Promise<ActivationResult> {
  const device = await getDeviceId()
  const url = process.env.CORZ_AUTH_URL ?? DEFAULT_ACTIVATE_URL
  const timeout = Number(process.env.CORZ_AUTH_TIMEOUT_MS) || DEFAULT_TIMEOUT
  const maxRetries = Number(process.env.CORZ_AUTH_MAX_RETRIES) || MAX_RETRIES
  const retryDelay = Number(process.env.CORZ_AUTH_RETRY_DELAY_MS) || RETRY_DELAY_BASE
  const sharedSecret = process.env.CORZ_CONVEX_SHARED_SECRET

  const headers: Record<string, string> = { "content-type": "application/json" }
  if (sharedSecret) {
    headers["authorization"] = `Bearer ${sharedSecret}`
  }

  const body = { token, device_id: device.deviceId }
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const isRetry = attempt > 0
    const adaptiveTimeout = Math.min(timeout * Math.pow(1.5, attempt), 60000)

    if (isRetry) {
      const delay = retryDelay * attempt
      onProgress?.(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`)
      await sleep(delay)
    } else {
      onProgress?.(`Attempting activation (1/${maxRetries})...`)
    }

    try {
      onProgress?.(`Sending request (timeout: ${Math.round(adaptiveTimeout / 1000)}s)...`)
      const response = await attemptActivation(url, headers, body, adaptiveTimeout, onProgress)

      if (!response.ok) {
        const details = await response
          .json()
          .catch(async () => ({ message: await response.text().catch(() => "") }))
        const message = details?.message ? ` - ${details.message}` : ""

        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Activation failed: server returned ${response.status}${message}`)
        }

        throw new Error(`Server error ${response.status}${message}`)
      }

      onProgress?.("Response received, verifying license...")
      const json = (await response.json()) as LicensePayload
      const verification = await verifyPayload(json, device.deviceId)

      if (!verification.ok) {
        throw new Error(`Activation rejected: ${verification.message}`)
      }

      await write(json)
      return { ok: true, license: json, device }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      const isNetworkError =
        lastError.message.includes("unable to reach") ||
        lastError.message.includes("abort") ||
        lastError.message.includes("fetch failed") ||
        lastError.message.includes("ECONNREFUSED") ||
        lastError.message.includes("ETIMEDOUT")

      const isServerError = lastError.message.includes("Server error")

      if (!isNetworkError && !isServerError) {
        return { ok: false, error: lastError.message }
      }

      if (attempt === maxRetries - 1) {
        return { ok: false, error: `Activation failed after ${maxRetries} attempts. ${lastError.message}` }
      }

      onProgress?.(`Attempt ${attempt + 1} failed: ${isNetworkError ? "Network error" : "Server error"}`)
    }
  }

  return { ok: false, error: lastError?.message ?? "Activation failed: unknown error" }
}

export * as LicenseActivation from "./activation"
