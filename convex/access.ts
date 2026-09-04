import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type StaffRole = "admin" | "registrar" | "viewer";

export async function requireStaff(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Authentication required");
  const user = await ctx.db.get("users", userId);
  if (!user || user.active === false || !user.role) {
    throw new Error("Staff access is not active");
  }
  return { userId, user, role: user.role as StaffRole };
}

export async function requireEditor(ctx: QueryCtx | MutationCtx) {
  const staff = await requireStaff(ctx);
  if (staff.role === "viewer") throw new Error("Read-only access");
  return staff;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const staff = await requireStaff(ctx);
  if (staff.role !== "admin") throw new Error("Administrator access required");
  return staff;
}
