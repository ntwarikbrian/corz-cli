import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

const licenseStatus = v.union(v.literal("unused"), v.literal("activated"), v.literal("expired"), v.literal("revoked"))

export default defineSchema({
  licenses: defineTable({
    token: v.string(),
    fullName: v.optional(v.string()),
    userId: v.string(),
    status: licenseStatus,
    deviceId: v.union(v.string(), v.null()),
    maxUses: v.optional(v.number()),
    usedCount: v.optional(v.number()),
    expiresAt: v.number(),
    activatedAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_status", ["status"]),

  admins: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),
})
