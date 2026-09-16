import { activeCorrections } from "../shared/corrections";
import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireEditor } from "./access";
import { registrationsForStudent } from "./participantDocuments";
import { certifySignature, signatureValidator } from "./signatures";

const unavailable = "This signature link has expired, was used, or the record changed. Please ask staff for a new link.";

async function currentRequest(ctx: MutationCtx, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ConvexError(unavailable);
  const request = await ctx.db.query("signatureRequests").withIndex("by_token", q => q.eq("token", token)).unique();
  if (!request || request.used || request.expiresAt <= Date.now()) throw new ConvexError(unavailable);
  const rows = await registrationsForStudent(ctx, request.studentId);
  if (rows.length !== request.versions.length || rows.some(row => !request.versions.some(version => version.participantId === row._id && version.updatedAt === row.updatedAt && version.signedAt === row.signedAt))) throw new ConvexError(unavailable);
  return { request, rows };
}

export const create = mutation({
  args: { participantId: v.id("participants"), token: v.string() },
  returns: v.object({ expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const staff = await requireEditor(ctx);
    if (!/^[a-f0-9]{64}$/.test(args.token)) throw new ConvexError("Invalid link token");
    if (await ctx.db.query("signatureRequests").withIndex("by_token", q => q.eq("token", args.token)).unique()) throw new ConvexError("Please create a new link");
    const person = await ctx.db.get("participants", args.participantId);
    if (!person) throw new ConvexError("Participant not found");
    const rows = await registrationsForStudent(ctx, person.studentId);
    if (rows.some(row => !row.fullNameThai.trim() || !row.studentIdImageId || !row.nationalIdImageId)) throw new ConvexError("Complete the participant name and both ID images before requesting a signature.");
    const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
    const value = { ...args, studentId: person.studentId, versions: rows.map(row => ({ participantId: row._id, updatedAt: row.updatedAt, signedAt: row.signedAt })), expiresAt, used: false, createdBy: staff.userId };
    const previous = await ctx.db.query("signatureRequests").withIndex("by_participantId", q => q.eq("participantId", args.participantId)).unique();
    if (previous) await ctx.db.replace("signatureRequests", previous._id, value);
    else await ctx.db.insert("signatureRequests", value);
    await ctx.db.insert("auditEvents", { action: "signature_requested", participantId: person._id, staffUserId: staff.userId, ipAddress: "staff", attempts: 0, createdAt: Date.now(), successful: true });
    return { expiresAt };
  },
});

// A mutation checks server time on every open; public callers cannot forge an expiry time.
export const open = mutation({
  args: { token: v.string() },
  returns: v.object({ expiresAt: v.number(), studentId: v.string(), records: v.array(v.object({
    name: v.string(), signatureNotes: v.array(v.string()), details: v.array(v.object({ label: v.string(), value: v.string() })),
    studentIdImageUrl: v.string(), nationalIdImageUrl: v.string(),
  })) }),
  handler: async (ctx, args) => {
    const { request, rows } = await currentRequest(ctx, args.token);
    const records = await Promise.all(rows.map(async row => {
      const studentIdImageUrl = row.studentIdImageId ? await ctx.storage.getUrl(row.studentIdImageId) : null;
      const nationalIdImageUrl = row.nationalIdImageId ? await ctx.storage.getUrl(row.nationalIdImageId) : null;
      if (!studentIdImageUrl || !nationalIdImageUrl) throw new ConvexError("ID images are missing. Please contact staff.");
      const fields = [
        ["English name", row.fullNameEnglish], ["คณะ / Faculty", row.faculty], ["กีฬา / Sport", row.sport],
        ["ประเภท / Category", row.categories?.join(" / ") || row.category], ["เบอร์เสื้อ / Jersey", row.jerseyNumber],
        ["วันเกิด / Birth date", row.birthDate], ["เพศ / Sex", row.sex], ["เลขบัตรประชาชน / National ID", row.nationalIdNumber],
        ["ผู้ติดต่อฉุกเฉิน / Emergency contact", row.emergencyContactName], ["ความสัมพันธ์ / Relationship", row.emergencyContactRelationship],
        ["โทรผู้ปกครอง / Guardian phone", row.guardianPhone], ["โรคประจำตัว / Medical conditions", row.medicalConditions],
        ["แพ้ยา / Drug allergies", row.drugAllergies], ["แพ้อาหาร / Food allergies", row.foodAllergies], ["ข้อมูลการแพ้เดิม / Other allergies", row.allergies],
        ["ประวัติการรักษา / Hospitalization history", row.hospitalizationHistory],
      ];
      return { name: row.fullNameThai, signatureNotes: activeCorrections(row.correctionRequests).filter(item => item.field === "signature").map(item => item.note || "กรุณาลงลายมือชื่ออีกครั้ง / Please sign again."), details: fields.map(([label, value]) => ({ label: label!, value: value || "—" })), studentIdImageUrl, nationalIdImageUrl };
    }));
    return { expiresAt: request.expiresAt, studentId: request.studentId, records };
  },
});

export const submit = mutation({
  args: { token: v.string(), signature: signatureValidator, confirmed: v.literal(true) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request, rows } = await currentRequest(ctx, args.token);
    for (const row of rows) {
      if (!row.studentIdImageId || !row.nationalIdImageId || !await ctx.db.system.get("_storage", row.studentIdImageId) || !await ctx.db.system.get("_storage", row.nationalIdImageId)) throw new ConvexError("ID images are missing. Please contact staff.");
      const signatureRequested = activeCorrections(row.correctionRequests).some(item => item.field === "signature");
      if (signatureRequested && JSON.stringify(args.signature) === JSON.stringify(row.signature)) throw new ConvexError("Please draw a new signature to address the correction request.");
      const corrections = row.correctionRequests?.map(item => item.field === "signature" && item.status === "requested" ? { ...item, status: "submitted" as const } : item);
      await ctx.db.patch("participants", row._id, {
        ...certifySignature(args.signature, row.fullNameThai), updatedAt: Date.now(),
        ...(signatureRequested ? { correctionRequests: corrections, status: activeCorrections(corrections).length ? "rejected" as const : "pending" as const } : {}),
      });
    }
    await ctx.db.patch("signatureRequests", request._id, { used: true });
    await ctx.db.insert("auditEvents", { action: "signature_request_completed", participantId: request.participantId, ipAddress: "signature-link", attempts: 1, createdAt: Date.now(), successful: true });
    return null;
  },
});
