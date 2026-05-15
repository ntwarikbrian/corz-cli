import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { internalMutation } from "./_generated/server"

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
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

    return {
      success: true as const,
      email: admin.email,
      name: admin.name,
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
