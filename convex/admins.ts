import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { internalMutation } from "./_generated/server"

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

async function hashWithSalt(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder()
  const salted = new Uint8Array([...salt, ...encoder.encode(password)])
  const hashBuffer = await crypto.subtle.digest('SHA-256', salted)
  return bytesToHex(new Uint8Array(hashBuffer))
}

async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt()
  const hash = await hashWithSalt(password, salt)
  return `${bytesToHex(salt)}:${hash}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":")
  if (parts.length !== 2) return false
  const salt = hexToBytes(parts[0])
  const hash = await hashWithSalt(password, salt)
  return hash === parts[1]
}

function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytesToHex(bytes)
}

async function checkLoginRateLimit(ctx: any, email: string): Promise<void> {
  const window = Date.now() - LOGIN_LOCKOUT_MS
  const attempts = await ctx.db
    .query("login_attempts")
    .withIndex("by_email_attempted_at", (q) =>
      q.eq("email", email).gte("attempted_at", window)
    )
    .collect()

  if (attempts.length >= MAX_LOGIN_ATTEMPTS) {
    throw new Error("Too many login attempts. Try again in 15 minutes.")
  }
}

async function recordFailedAttempt(ctx: any, email: string): Promise<void> {
  await ctx.db.insert("login_attempts", {
    email,
    attempted_at: Date.now(),
  })
}

async function clearFailedAttempts(ctx: any, email: string): Promise<void> {
  const all = await ctx.db
    .query("login_attempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect()

  for (const a of all) {
    await ctx.db.delete(a._id)
  }
}

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      email: v.string(),
      name: v.string(),
      sessionToken: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const now = Date.now()

    try {
      await checkLoginRateLimit(ctx, args.email)
    } catch {
      return { success: false as const, error: "Too many login attempts. Try again in 15 minutes." }
    }

    const admin = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first()

    if (!admin) {
      await recordFailedAttempt(ctx, args.email)
      return { success: false as const, error: "Invalid email or password" }
    }

    const isValid = await verifyPassword(args.password, admin.passwordHash)

    if (!isValid) {
      await recordFailedAttempt(ctx, args.email)
      return { success: false as const, error: "Invalid email or password" }
    }

    await clearFailedAttempts(ctx, args.email)

    const sessionToken = generateSessionToken()
    await ctx.db.insert("sessions", {
      admin_id: admin._id,
      token: sessionToken,
      created_at: now,
      expires_at: now + SESSION_DURATION_MS,
    })

    return {
      success: true as const,
      email: admin.email,
      name: admin.name,
      sessionToken,
    }
  },
})

export const createAdmin = internalMutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    email: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first()

    if (existing) {
      return { success: false, error: "Admin already exists" }
    }

    const passwordHash = await hashPassword(args.password)

    await ctx.db.insert("admins", {
      email: args.email,
      passwordHash,
      name: args.name,
      createdAt: Date.now(),
    })

    return { success: true, email: args.email }
  },
})

export const getAdminByEmail = query({
  args: {
    sessionToken: v.string(),
    email: v.string(),
  },
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first()

    if (!session) return null
    if (Date.now() > session.expires_at) {
      await ctx.db.delete(session._id)
      return null
    }

    const admin = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first()

    if (!admin) return null

    return {
      email: admin.email,
      name: admin.name,
    }
  },
})

export const initDefaultAdmin = internalMutation({
  args: {
    password: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const adminEmail = args.email || "admin@corz.dev"
    const adminName = args.name || "Admin User"

    const existing = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", adminEmail))
      .first()

    if (existing) {
      return { success: false, message: "Admin already exists" }
    }

    const passwordHash = await hashPassword(args.password)

    await ctx.db.insert("admins", {
      email: adminEmail,
      passwordHash,
      name: adminName,
      createdAt: Date.now(),
    })

    return { success: true, message: "Admin created successfully" }
  },
})
