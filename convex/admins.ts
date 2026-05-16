import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { internalMutation } from "./_generated/server"

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
  if (parts.length !== 2) {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password))
    return bytesToHex(new Uint8Array(hashBuffer)) === stored
  }
  const salt = hexToBytes(parts[0])
  const hash = await hashWithSalt(password, salt)
  return hash === parts[1]
}

function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytesToHex(bytes)
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
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first()

    if (!admin) {
      return { success: false as const, error: "Invalid email or password" }
    }

    const isValid = await verifyPassword(args.password, admin.passwordHash)

    if (!isValid) {
      return { success: false as const, error: "Invalid email or password" }
    }

    const sessionToken = generateSessionToken()
    await ctx.db.insert("sessions", {
      admin_id: admin._id,
      token: sessionToken,
      created_at: Date.now(),
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
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first()

    if (!admin) {
      return null
    }

    return {
      email: admin.email,
      name: admin.name,
    }
  },
})

export const initDefaultAdmin = internalMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", "admin@corz.dev"))
      .first()

    if (existing) {
      return { success: false, message: "Default admin already exists" }
    }

    const passwordHash = await hashPassword("admin123")

    await ctx.db.insert("admins", {
      email: "admin@corz.dev",
      passwordHash,
      name: "Admin User",
      createdAt: Date.now(),
    })

    return { success: true, message: "Default admin created successfully" }
  },
})
