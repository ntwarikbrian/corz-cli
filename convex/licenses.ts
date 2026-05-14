import { internalMutation, query, mutation } from "./_generated/server"
import { v } from "convex/values"

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const segments = []
  for (let s = 0; s < 3; s++) {
    let segment = ""
    for (let i = 0; i < 4; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)]
    }
    segments.push(segment)
  }
  return segments.join("-")
}

const statusValidator = v.union(v.literal("unused"), v.literal("activated"), v.literal("expired"), v.literal("revoked"))

const activationErrorCode = v.union(
  v.literal("token_not_found"),
  v.literal("token_revoked"),
  v.literal("token_expired"),
  v.literal("token_exhausted"),
  v.literal("internal_error"),
)

const activationError = v.object({
  ok: v.literal(false),
  code: activationErrorCode,
  message: v.string(),
})

const activationSuccess = v.object({
  ok: v.literal(true),
  token: v.string(),
  user_id: v.string(),
  device_id: v.string(),
  expires_at: v.string(),
})

export const activateToken = internalMutation({
  args: {
    token: v.string(),
    deviceId: v.string(),
    now: v.number(),
  },
  returns: v.union(activationSuccess, activationError),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("licenses")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .take(2)

    if (matches.length === 0) {
      return {
        ok: false as const,
        code: "token_not_found" as const,
        message: "Token not found",
      }
    }

    if (matches.length > 1) {
      return {
        ok: false as const,
        code: "internal_error" as const,
        message: "Duplicate token records detected",
      }
    }

    const record = matches[0]!

    if (record.status === "revoked") {
      return {
        ok: false as const,
        code: "token_revoked" as const,
        message: "Token is revoked",
      }
    }

    if (args.now > record.expiresAt) {
      if (record.status !== "expired") {
        await ctx.db.patch(record._id, {
          status: "expired",
        })
      }
      return {
        ok: false as const,
        code: "token_expired" as const,
        message: "Token is expired",
      }
    }

    let deviceID = record.deviceId

    const usedCount = record.usedCount ?? 0
    const maxUses = record.maxUses ?? 1

    if (record.status === "unused") {
      if (usedCount >= maxUses) {
        return {
          ok: false as const,
          code: "token_exhausted" as const,
          message: "Token has reached maximum activation limit",
        }
      }
      deviceID = args.deviceId
      await ctx.db.patch(record._id, {
        status: "activated",
        deviceId: args.deviceId,
        activatedAt: args.now,
        usedCount: usedCount + 1,
      })
    } else if (record.status === "activated") {
      if (usedCount >= maxUses) {
        return {
          ok: false as const,
          code: "token_exhausted" as const,
          message: "Token has reached maximum activation limit",
        }
      }

      deviceID = args.deviceId
      await ctx.db.patch(record._id, {
        deviceId: args.deviceId,
        usedCount: usedCount + 1,
      })
    } else if (record.status === "expired") {
      return {
        ok: false as const,
        code: "token_expired" as const,
        message: "Token is expired",
      }
    }

    if (!deviceID) {
      return {
        ok: false as const,
        code: "internal_error" as const,
        message: "Token is missing a bound device",
      }
    }

    return {
      ok: true as const,
      token: record.token,
      user_id: record.userId,
      device_id: deviceID,
      expires_at: new Date(record.expiresAt).toISOString(),
    }
  },
})

export const createToken = internalMutation({
  args: {
    fullName: v.string(),
    userId: v.string(),
    expiresAt: v.number(),
    maxUses: v.number(),
    now: v.number(),
  },
  returns: v.object({
    ok: v.literal(true),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const token = generateToken()

    await ctx.db.insert("licenses", {
      token,
      fullName: args.fullName,
      userId: args.userId,
      status: "unused",
      deviceId: null,
      maxUses: args.maxUses,
      usedCount: 0,
      expiresAt: args.expiresAt,
      activatedAt: null,
      createdAt: args.now,
    })

    return { ok: true as const, token }
  },
})

export const upsertLicense = internalMutation({
  args: {
    token: v.string(),
    fullName: v.string(),
    userId: v.string(),
    status: statusValidator,
    deviceId: v.union(v.string(), v.null()),
    maxUses: v.number(),
    usedCount: v.number(),
    expiresAt: v.number(),
    now: v.number(),
  },
  returns: v.object({
    ok: v.literal(true),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("licenses")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    const activatedAt =
      args.status === "activated"
        ? (args.deviceId ? args.now : null)
        : args.status === "unused"
          ? null
          : null

    if (existing) {
      await ctx.db.patch(existing._id, {
        fullName: args.fullName,
        userId: args.userId,
        status: args.status,
        deviceId: args.deviceId,
        maxUses: args.maxUses,
        usedCount: args.usedCount,
        expiresAt: args.expiresAt,
        activatedAt: args.status === "activated" ? (existing.activatedAt ?? activatedAt) : activatedAt,
      })
      return { ok: true as const, token: args.token }
    }

    await ctx.db.insert("licenses", {
      token: args.token,
      fullName: args.fullName,
      userId: args.userId,
      status: args.status,
      deviceId: args.deviceId,
      maxUses: args.maxUses,
      usedCount: args.usedCount,
      expiresAt: args.expiresAt,
      activatedAt,
      createdAt: args.now,
    })

    return { ok: true as const, token: args.token }
  },
})

export const getAllLicenses = query({
  handler: async (ctx) => {
    return await ctx.db.query("licenses").order("desc").take(100)
  },
})

function generateUserId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = "user_"
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export const createLicenseToken = mutation({
  args: {
    fullName: v.optional(v.string()),
    expiresAt: v.number(),
    maxUses: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    token: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const token = generateToken()
    const userId = generateUserId()

    await ctx.db.insert("licenses", {
      token,
      fullName: args.fullName,
      userId,
      status: "unused",
      deviceId: null,
      maxUses: args.maxUses ?? 1,
      usedCount: 0,
      expiresAt: args.expiresAt,
      activatedAt: null,
      createdAt: Date.now(),
    })

    return { success: true, token }
  },
})
