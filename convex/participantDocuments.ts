import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type Documents = Pick<Doc<"participants">, "profilePhotoId" | "nationalIdImageId" | "studentIdImageId">;

export async function registrationsForStudent(ctx: QueryCtx, studentId: string) {
  const rows = await ctx.db.query("participants").withIndex("by_studentId", q => q.eq("studentId", studentId)).take(101);
  if (rows.length > 100) throw new ConvexError("Too many registrations for this Student ID. Please contact staff");
  return rows;
}

export function completeDocuments(documents: Documents) {
  return Boolean(documents.profilePhotoId && documents.nationalIdImageId && documents.studentIdImageId);
}

// Existing files remain referenced by each registration so removal's reference
// checks preserve them until the last registration using them is removed.
export async function existingDocuments(ctx: QueryCtx, studentId: string): Promise<Documents> {
  const rows = (await registrationsForStudent(ctx, studentId)).sort((a,b) => b.updatedAt - a.updatedAt);
  const documents: Documents = {};
  for (const key of ["profilePhotoId", "nationalIdImageId", "studentIdImageId"] as const) {
    const file = rows.find(row => row[key])?.[key];
    if (file) documents[key] = file;
  }
  return documents;
}

export async function linkDocuments(ctx: MutationCtx, participant: Doc<"participants">, uploaded: Documents, staff?: { userId: Doc<"users">["_id"]; booth?: boolean }) {
  const documents = { ...await existingDocuments(ctx, participant.studentId), ...uploaded };
  const rows = await registrationsForStudent(ctx, participant.studentId);
  for (const row of rows) {
    await ctx.db.patch("participants", row._id, {
      ...documents,
      // A document upload must not replace another sport's review decision.
      status: row.status === "verified" || row.status === "rejected" ? row.status
        : completeDocuments(documents) ? staff?.booth && row._id === participant._id ? "verified" : "pending" : "incomplete",
      updatedAt: Date.now(),
      ...(staff ? { updatedBy: staff.userId } : {}),
    });
  }
}
