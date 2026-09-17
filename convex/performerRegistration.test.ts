/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const profile = {
  studentId: "6909680001", fullNameThai: "ทดสอบ", fullNameEnglish: "Test Student",
  phone: "0812345678", faculty: "คณะแพทยศาสตร์" as const, sex: "Female" as const,
  email: "test@example.com", preferredContact: "Phone" as const,
  nationalIdNumber: "1234567890123", birthDate: "2007-03-15", guardianPhone: "0812345678",
  emergencyContactName: "Parent", emergencyContactRelationship: "Mother",
  drugAllergies: "None", foodAllergies: "None", hospitalizationHistory: "None", medicalConditions: "None",
  jerseyNumber: "92",
};

async function setup() {
  const t = convexTest(schema, modules);
  const participantId = await t.run(async ctx => {
    const profilePhotoId = await ctx.storage.store(new Blob(["photo"]));
    const nationalIdImageId = await ctx.storage.store(new Blob(["national"]));
    const studentIdImageId = await ctx.storage.store(new Blob(["student"]));
    return ctx.db.insert("participants", { ...profile, sport: "Volleyball", participantKind: "athlete", source: "import", status: "pending", updatedAt: Date.now(), profilePhotoId, nationalIdImageId, studentIdImageId });
  });
  const auditEventId = await t.mutation(api.publicIntake.recordVisit, { ipAddress: "test", purpose: "performer_registration" });
  return { t, participantId, auditEventId };
}

test("Student ID lookup reveals only existence and validates its session", async () => {
  const { t, auditEventId } = await setup();
  expect(await t.mutation(api.publicIntake.checkPerformerStudentId, { auditEventId, studentId: profile.studentId })).toEqual({ exists: true });
  expect(await t.mutation(api.publicIntake.checkPerformerStudentId, { auditEventId, studentId: "6909689999" })).toEqual({ exists: false });
  await expect(t.mutation(api.publicIntake.checkPerformerStudentId, { auditEventId, studentId: "123" })).rejects.toThrow("10 digits");
  await t.run(ctx => ctx.db.patch("auditEvents", auditEventId, { attempts: 5 }));
  await expect(t.mutation(api.publicIntake.checkPerformerStudentId, { auditEventId, studentId: profile.studentId })).rejects.toThrow("Too many attempts");
});

test("verified returning athlete adds a performer registration and reuses documents", async () => {
  const { t, auditEventId, participantId } = await setup();
  await expect(t.mutation(api.publicIntake.verifyIdentity, { auditEventId, studentId: profile.studentId, phone: "0899999999" })).rejects.toThrow("does not match");
  const verified = await t.mutation(api.publicIntake.verifyIdentity, { auditEventId, studentId: profile.studentId, phone: profile.phone });
  const result = await t.mutation(api.publicIntake.registerPerformer, { ...profile, auditEventId, verifiedSessionId: verified.sessionId, performerType: "Cheerleader", pdpaConsent: true });
  expect((await t.run(ctx => ctx.db.get("uploadSessions", verified.sessionId)))?.used).toBe(true);
  await t.mutation(api.publicIntake.completeUpload, { sessionId: result.sessionId, signature: [[{ x: 20, y: 30 }, { x: 80, y: 70 }, { x: 150, y: 20 }]] });
  const rows = await t.run(ctx => ctx.db.query("participants").withIndex("by_studentId", q => q.eq("studentId", profile.studentId)).take(10));
  expect(rows).toHaveLength(2);
  const performer = rows.find(row => row.participantKind === "performer")!;
  const athlete = rows.find(row => row._id === participantId)!;
  expect(performer).toMatchObject({ fullNameEnglish: profile.fullNameEnglish, status: "pending", profilePhotoId: athlete.profilePhotoId, nationalIdImageId: athlete.nationalIdImageId, studentIdImageId: athlete.studentIdImageId });
  expect(athlete.sport).toBe("Volleyball");
});

test("a verification session cannot be used with another audit or student", async () => {
  const { t, auditEventId } = await setup();
  const verified = await t.mutation(api.publicIntake.verifyIdentity, { auditEventId, studentId: profile.studentId, phone: profile.phone });
  const otherAudit = await t.mutation(api.publicIntake.recordVisit, { ipAddress: "other", purpose: "performer_registration" });
  const args = { ...profile, auditEventId, verifiedSessionId: verified.sessionId, performerType: "Parade" as const, pdpaConsent: true as const };
  await expect(t.mutation(api.publicIntake.registerPerformer, { ...args, auditEventId: otherAudit })).rejects.toThrow("Verification session expired");
  await expect(t.mutation(api.publicIntake.registerPerformer, { ...args, studentId: "6909689999" })).rejects.toThrow("Verification session expired");
});
