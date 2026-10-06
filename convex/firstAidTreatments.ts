import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, requireRecordsAccess } from "./access";
import { audit, cleanNote, cleanStudentId, faculty, getKit, knownPerson, optionalStaff, text } from "./firstAidKits";
import { isValidSignature } from "../shared/signature";

const signature = v.array(v.array(v.object({ x: v.number(), y: v.number() })));

const treatment = v.object({
  id: v.id("firstAidTreatments"),
  kitId: v.id("firstAidKits"),
  kitNumber: v.number(),
  sequence: v.number(),
  treatedAt: v.number(),
  sport: v.string(),
  patientName: v.string(),
  patientStudentId: v.string(),
  patientFaculty: v.string(),
  symptoms: v.string(),
  supplies: v.string(),
  note: v.string(),
  patientSignature: signature,
  caretakerName: v.string(),
  caretakerStudentId: v.string(),
  caretakerFaculty: v.string(),
  caretakerSignature: signature,
  loggedByName: v.union(v.string(), v.null()),
});

/**
 * Public, account-free entry for the paper "รายงานการปฐมพยาบาล" sheet kept with each kit.
 * Write-only for the public: medical details are readable by staff only.
 */
export const logTreatment = mutation({
  args: {
    kitId: v.id("firstAidKits"),
    sport: v.string(),
    // Name and faculty may be left blank when the patient's student ID is already known.
    patientName: v.optional(v.string()),
    patientStudentId: v.optional(v.string()),
    patientFaculty: v.optional(faculty),
    symptoms: v.string(),
    supplies: v.string(),
    note: v.optional(v.string()),
    patientSignature: signature,
    caretakerStudentId: v.string(),
    caretakerName: v.optional(v.string()),
    // May be left blank when the caretaker's student ID is already known.
    caretakerFaculty: v.optional(faculty),
    caretakerSignature: signature,
  },
  returns: v.object({ kitNumber: v.number(), sequence: v.number() }),
  handler: async (ctx, args) => {
    const staffId = await optionalStaff(ctx);
    const kit = await getKit(ctx, args.kitId);
    if (!kit.active) throw new ConvexError(`Kit ${kit.number} is retired`);
    const patientStudentId = args.patientStudentId?.trim() ? cleanStudentId(args.patientStudentId) : undefined;
    const caretakerStudentId = cleanStudentId(args.caretakerStudentId);
    const patient = patientStudentId ? await knownPerson(ctx, patientStudentId) : null;
    const patientFaculty = args.patientFaculty || patient?.faculty;
    if (!patientFaculty) throw new ConvexError("Choose the faculty of the person receiving first aid");
    const caretaker = await knownPerson(ctx, caretakerStudentId);
    const caretakerName = text(args.caretakerName?.trim() || caretaker?.name || "", "Caretaker name");
    const caretakerFaculty = args.caretakerFaculty || caretaker?.faculty;
    if (!caretakerFaculty) throw new ConvexError("Choose the caretaker's faculty");
    if (!isValidSignature(args.patientSignature)) throw new ConvexError("The person receiving first aid must sign (ผู้ใช้)");
    if (!isValidSignature(args.caretakerSignature)) throw new ConvexError("The caretaker must sign (ผู้ดูแล)");
    const last = await ctx.db.query("firstAidTreatments").withIndex("by_kitId_and_sequence", q => q.eq("kitId", kit._id)).order("desc").first();
    const sequence = (last?.sequence ?? 0) + 1;
    await ctx.db.insert("firstAidTreatments", {
      kitId: kit._id, kitNumber: kit.number, sequence, treatedAt: Date.now(),
      sport: text(args.sport, "Sport / activity"),
      patientName: text(args.patientName?.trim() || patient?.name || "", "Name of the person receiving first aid"),
      patientStudentId,
      patientFaculty,
      symptoms: text(args.symptoms, "Symptoms", 300),
      supplies: text(args.supplies, "Medicine / supplies used", 300),
      note: cleanNote(args.note),
      patientSignature: args.patientSignature,
      caretakerName, caretakerStudentId, caretakerFaculty,
      caretakerSignature: args.caretakerSignature,
      loggedBy: staffId,
    });
    // Keep medical details out of the general audit log.
    await audit(ctx, staffId, `first_aid_treatment_logged:kit=${kit.number}:no=${sequence}`);
    return { kitNumber: kit.number, sequence };
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator, kitId: v.optional(v.id("firstAidKits")) },
  returns: paginationResultValidator(treatment),
  handler: async (ctx, { paginationOpts, kitId }) => {
    await requireRecordsAccess(ctx);
    const page = kitId
      ? await ctx.db.query("firstAidTreatments").withIndex("by_kitId_and_sequence", q => q.eq("kitId", kitId)).order("desc").paginate(paginationOpts)
      : await ctx.db.query("firstAidTreatments").withIndex("by_treatedAt").order("desc").paginate(paginationOpts);
    const names = new Map<Id<"users">, string | null>();
    return {
      ...page,
      page: await Promise.all(page.page.map(async row => {
        if (row.loggedBy && !names.has(row.loggedBy)) names.set(row.loggedBy, (await ctx.db.get("users", row.loggedBy))?.name ?? null);
        return {
          id: row._id, kitId: row.kitId, kitNumber: row.kitNumber, sequence: row.sequence, treatedAt: row.treatedAt, sport: row.sport,
          patientName: row.patientName, patientStudentId: row.patientStudentId ?? "", patientFaculty: row.patientFaculty, symptoms: row.symptoms, supplies: row.supplies, note: row.note ?? "",
          patientSignature: row.patientSignature, caretakerName: row.caretakerName, caretakerStudentId: row.caretakerStudentId, caretakerFaculty: row.caretakerFaculty ?? "",
          caretakerSignature: row.caretakerSignature, loggedByName: row.loggedBy ? names.get(row.loggedBy) ?? null : null,
        };
      })),
    };
  },
});

export const remove = mutation({
  args: { treatmentId: v.id("firstAidTreatments") },
  returns: v.null(),
  handler: async (ctx, { treatmentId }) => {
    const staff = await requireAdmin(ctx);
    const row = await ctx.db.get("firstAidTreatments", treatmentId);
    if (!row) throw new ConvexError("Treatment record not found. Refresh and try again.");
    await ctx.db.delete("firstAidTreatments", treatmentId);
    await audit(ctx, staff.userId, `first_aid_treatment_deleted:kit=${row.kitNumber}:no=${row.sequence}`);
    return null;
  },
});
