import { getDeviceId } from "./device"
import { verifyPayload } from "./verification"
import { write } from "./storage"
import { load as loadConfig } from "@/config/loader"
import type { ActivationResult, ProgressCallback, LicensePayload } from "./types"

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
  const config = loadConfig()

  const headers: Record<string, string> = { "content-type": "application/json" }
  if (config.sharedSecret) {
    headers["authorization"] = `Bearer ${config.sharedSecret}`
  }

  const body = { token, device_id: device.deviceId }
  let lastError: Error | undefined

  for (let attempt = 0; attempt < config.authMaxRetries; attempt++) {
    const isRetry = attempt > 0
    const adaptiveTimeout = Math.min(config.authTimeoutMs * Math.pow(1.5, attempt), 60000)

    if (isRetry) {
      const delay = config.retryDelayMs * attempt
      onProgress?.(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${config.authMaxRetries})`)
      await sleep(delay)
    } else {
      onProgress?.(`Attempting activation (1/${config.authMaxRetries})...`)
    }

    try {
      onProgress?.(`Sending request (timeout: ${Math.round(adaptiveTimeout / 1000)}s)...`)
      const response = await attemptActivation(config.authUrl, headers, body, adaptiveTimeout, onProgress)

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

      if (attempt === config.authMaxRetries - 1) {
        return { ok: false, error: `Activation failed after ${config.authMaxRetries} attempts. ${lastError.message}` }
      }

      onProgress?.(`Attempt ${attempt + 1} failed: ${isNetworkError ? "Network error" : "Server error"}`)
    }
  }

  return { ok: false, error: lastError?.message ?? "Activation failed: unknown error" }
}

export * as LicenseActivation from "./activation"
