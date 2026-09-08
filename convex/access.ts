import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type StaffRole = "admin" | "registrar" | "viewer" | "co-sport";

export async function requireStaff(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Authentication required");
  const user = await ctx.db.get("users", userId);
  if (!user || user.active === false || !user.role) {
    throw new ConvexError("Staff access is not active");
  }
  return { userId, user, role: user.role as StaffRole };
}

export async function requireEditor(ctx: QueryCtx | MutationCtx) {
  const staff = await requireStaff(ctx);
  if (staff.role !== "admin" && staff.role !== "registrar") throw new ConvexError("Read-only access");
  return staff;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const staff = await requireStaff(ctx);
  if (staff.role !== "admin") throw new ConvexError("Administrator access required");
  return staff;
}

export async function requireRecordsAccess(ctx: QueryCtx | MutationCtx) {
  const staff = await requireStaff(ctx);
  if (staff.role === "co-sport") throw new ConvexError("Contact directory access only");
  return staff;
}
