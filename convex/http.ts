import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"

const http = httpRouter()

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v)
  return Response.json(data, { ...init, headers })
}

const adminMethods = ["POST", "OPTIONS"] as const

function adminRoute(path: string, handler: (ctx: any, request: Request) => Promise<Response>) {
  for (const method of adminMethods) {
    http.route({
      path,
      method,
      handler: httpAction(async (ctx, request) => {
        if (method === "OPTIONS") return new Response(null, { headers: corsHeaders })
        if (!authorized(request, process.env.CORZ_CONVEX_ADMIN_KEY)) {
          return json({ code: "unauthorized", message: "Unauthorized request" }, { status: 401 })
        }
        return handler(ctx, request)
      }),
    })
  }
}

http.route({
  path: "/activate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request, process.env.CORZ_CONVEX_SHARED_SECRET)) {
      return json({ code: "internal_error", message: "Unauthorized activation request" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const token = readString(body, "token")
    const deviceID = readString(body, "device_id")

    if (!token || !deviceID) {
      return json({ code: "invalid_request", message: "token and device_id are required" }, { status: 400 })
    }

    const activated = await ctx.runMutation(internal.licenses.activateToken, {
      token,
      deviceId: deviceID,
      now: Date.now(),
    })

    if (!activated.ok) {
      return json({ code: activated.code, message: activated.message }, { status: mapStatus(activated.code) })
    }

    const privateKey = process.env.CORZ_LICENSE_PRIVATE_KEY_PKCS8_BASE64
    if (!privateKey) {
      return json({ code: "internal_error", message: "License private key is not configured" }, { status: 500 })
    }

    const message = `${activated.token}\n${activated.user_id}\n${activated.device_id}\n${activated.expires_at}`
    const signature = await signLicense(message, privateKey).catch(() => "")
    if (!signature) {
      return json({ code: "internal_error", message: "Failed to sign license payload" }, { status: 500 })
    }

    return json({
      token: activated.token,
      user_id: activated.user_id,
      device_id: activated.device_id,
      expires_at: activated.expires_at,
      signature,
    })
  }),
})

adminRoute("/admin/create-token", async (ctx, request) => {
  const body = await request.json().catch(() => null)
  const fullName = readString(body, "fullName")
  const userID = readString(body, "userId")
  const expiresAt = readNumber(body, "expiresAt")
  const maxUses = readNumber(body, "maxUses")

  if (!fullName || !Number.isFinite(expiresAt)) {
    return json({ code: "invalid_request", message: "fullName and expiresAt are required" }, { status: 400 })
  }

  const maxUsesValue = Number.isFinite(maxUses) && maxUses > 0 ? maxUses : 1

  if (userID) {
    const result = await ctx.runMutation(internal.licenses.createToken, {
      fullName,
      userId: userID,
      expiresAt,
      maxUses: maxUsesValue,
      now: Date.now(),
    })
    return json({ ok: true, token: result.token })
  }

  const result = await ctx.runMutation(internal.licenses.createLicenseTokenInternal, {
    fullName,
    expiresAt,
    maxUses: maxUsesValue,
  })

  return json({ ok: true, token: result.token })
})

adminRoute("/admin/upsert-license", async (ctx, request) => {
  const body = await request.json().catch(() => null)
  const token = readString(body, "token")
  const fullName = readString(body, "fullName")
  const userID = readString(body, "userId")
  const status_ = readString(body, "status")
  const deviceID = readNullableString(body, "deviceId")
  const maxUses = readNumber(body, "maxUses")
  const usedCount = readNumber(body, "usedCount")
  const expiresAt = readNumber(body, "expiresAt")

  if (!token || !userID || !status_ || !Number.isFinite(expiresAt)) {
    return json({ code: "invalid_request", message: "token, userId, status and expiresAt are required" }, { status: 400 })
  }

  if (!["unused", "activated", "expired", "revoked"].includes(status_)) {
    return json({ code: "invalid_request", message: "status must be unused, activated, expired, or revoked" }, { status: 400 })
  }

  await ctx.runMutation(internal.licenses.upsertLicense, {
    token,
    fullName: fullName || "",
    userId: userID,
    status: status_ as "unused" | "activated" | "expired" | "revoked",
    deviceId: deviceID,
    maxUses: Number.isFinite(maxUses) ? maxUses : 1,
    usedCount: Number.isFinite(usedCount) ? usedCount : 0,
    expiresAt,
    now: Date.now(),
  })

  return json({ ok: true, token })
})

adminRoute("/admin/update-license", async (ctx, request) => {
  const body = await request.json().catch(() => null)
  const id = readString(body, "id")
  const fullName = readString(body, "fullName")
  const status_ = readString(body, "status")
  const maxUses = readNumber(body, "maxUses")
  const expiresAt = readNumber(body, "expiresAt")

  if (!id) {
    return json({ code: "invalid_request", message: "id is required" }, { status: 400 })
  }

  if (status_ && !["unused", "activated", "expired", "revoked"].includes(status_)) {
    return json({ code: "invalid_request", message: "status must be unused, activated, expired, or revoked" }, { status: 400 })
  }

  const args: Record<string, unknown> = { id }
  if (fullName) args.fullName = fullName
  if (status_) args.status = status_
  if (Number.isFinite(maxUses)) args.maxUses = maxUses
  if (Number.isFinite(expiresAt)) args.expiresAt = expiresAt

  const result = await ctx.runMutation(internal.licenses.updateLicenseInternal, args as any)

  if (!result.success) {
    return json({ code: "internal_error", message: result.error || "Failed to update license" }, { status: 500 })
  }

  return json({ ok: true })
})

adminRoute("/admin/delete-license", async (ctx, request) => {
  const body = await request.json().catch(() => null)
  const id = readString(body, "id")

  if (!id) {
    return json({ code: "invalid_request", message: "id is required" }, { status: 400 })
  }

  const result = await ctx.runMutation(internal.licenses.deleteLicenseInternal, { id })

  if (!result.success) {
    return json({ code: "internal_error", message: result.error || "Failed to delete license" }, { status: 500 })
  }

  return json({ ok: true })
})

adminRoute("/admin/init-default-admin", async (ctx, _request) => {
  const result = await ctx.runMutation(internal.admins.initDefaultAdmin)
  return json(result)
})

http.route({
  path: "/api/getAllLicenses",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request, process.env.CORZ_CONVEX_ADMIN_KEY)) {
      return json({ code: "unauthorized", message: "Unauthorized request" }, { status: 401 })
    }

    const licenses = await ctx.runQuery(internal.licenses.getAllLicenses)
    return json(licenses)
  }),
})

http.route({
  path: "/api/getAllLicenses",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { headers: corsHeaders })),
})

export default http

function authorized(request: Request, secret?: string) {
  if (!secret) return false
  const header = request.headers.get("authorization")
  if (!header) return false
  return header === `Bearer ${secret}`
}

function mapStatus(code: string) {
  switch (code) {
    case "invalid_request":
      return 400
    case "token_not_found":
      return 404
    case "token_revoked":
      return 403
    case "token_expired":
      return 410
    case "token_exhausted":
      return 403
    case "internal_error":
    default:
      return 500
  }
}

function readString(body: unknown, key: string) {
  if (!body || typeof body !== "object") return ""
  const value = (body as Record<string, unknown>)[key]
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return trimmed
}

function readNullableString(body: unknown, key: string) {
  if (!body || typeof body !== "object") return null
  const value = (body as Record<string, unknown>)[key]
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function readNumber(body: unknown, key: string) {
  if (!body || typeof body !== "object") return NaN
  const value = (body as Record<string, unknown>)[key]
  return typeof value === "number" ? value : NaN
}

async function signLicense(message: string, pkcs8Base64: string) {
  const keyData = base64ToBytes(pkcs8Base64)
  const key = await crypto.subtle.importKey("pkcs8", keyData, { name: "Ed25519" }, false, ["sign"])
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(message))
  return bytesToBase64(new Uint8Array(signature))
}

function base64ToBytes(base64: string) {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (const value of bytes) binary += String.fromCharCode(value)
  return btoa(binary)
}
