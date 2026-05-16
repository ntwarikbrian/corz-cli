import { mutation, query, internalMutation } from "./_generated/server"
import { v } from "convex/values"

export const verify = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      email: v.string(),
      name: v.string(),
    }),
    v.object({
      valid: v.literal(false),
    })
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!session) {
      return { valid: false as const }
    }

    const admin = await ctx.db.get(session.admin_id)
    if (!admin) {
      return { valid: false as const }
    }

    return {
      valid: true as const,
      email: admin.email,
      name: admin.name,
    }
  },
})

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (session) {
      await ctx.db.delete(session._id)
    }
  },
})

export const remove = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (session) {
      await ctx.db.delete(session._id)
    }
  },
})
