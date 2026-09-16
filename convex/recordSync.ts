import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireEditor } from "./access";
import { registrationsForStudent, completeDocuments, type Documents } from "./participantDocuments";
import { isValidSignature } from "../shared/signature";

const keys = ["profilePhotoId", "nationalIdImageId", "studentIdImageId"] as const;

export const batch = mutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ cursor: v.string(), done: v.boolean(), checked: v.number(), updated: v.number(), conflicts: v.array(v.string()) }),
  handler: async (ctx, { cursor }) => {
    const staff = await requireEditor(ctx);
    const page = await ctx.db.query("participants").order("asc").paginate({ cursor, numItems: 10 });
    let updated = 0;
    const conflicts: string[] = [];
    for (const studentId of new Set(page.page.map(row => row.studentId))) {
      const rows = await registrationsForStudent(ctx, studentId);
      if (rows.length < 2) continue;
      const documents: Documents = {};
      let conflict = rows.some(row => row.correctionRequests?.some(request => request.status === "requested" && (request.field === "signature" || keys.some(key => key === request.field))));
      for (const key of keys) {
        const files = [...new Set(rows.flatMap(row => row[key] ? [row[key]!] : []))];
        if (files.length > 1) conflict = true;
        if (files.length === 1) documents[key] = files[0];
      }
      const signed = rows.filter(row => isValidSignature(row.signature));
      const certifications = new Set(signed.map(row => JSON.stringify([row.signature, row.signedName, row.signedAt])));
      if (certifications.size > 1) conflict = true;
      const source = signed[0];
      // Only carry a signature with the same ID copies it originally certified.
      if (source && (!source.signedName || !source.signedAt || !source.nationalIdImageId || !source.studentIdImageId || source.nationalIdImageId !== documents.nationalIdImageId || source.studentIdImageId !== documents.studentIdImageId)) conflict = true;
      for (const file of Object.values(documents)) {
        if (!await ctx.db.system.get(file)) conflict = true;
      }
      if (conflict) { conflicts.push(studentId); continue; }
      for (const row of rows) {
        const copySignature = Boolean(source && !isValidSignature(row.signature));
        const changedFiles = keys.some(key => documents[key] && documents[key] !== row[key]);
        if (!copySignature && !changedFiles) continue;
        await ctx.db.patch("participants", row._id, {
          ...documents,
          ...(copySignature ? { signature: source!.signature, signedName: source!.signedName, signedAt: source!.signedAt } : {}),
          ...(row.status === "incomplete" && completeDocuments(documents) && row.fullNameThai.trim() && row.fullNameEnglish.trim() && row.faculty.trim() ? { status: "pending" as const } : {}),
          updatedAt: Date.now(), updatedBy: staff.userId,
        });
        await ctx.db.insert("auditEvents", { action: "participant_records_synced", participantId: row._id, staffUserId: staff.userId, ipAddress: "staff", attempts: 1, successful: true, createdAt: Date.now() });
        updated++;
      }
    }
    return { cursor: page.continueCursor, done: page.isDone, checked: page.page.length, updated, conflicts };
  },
});
