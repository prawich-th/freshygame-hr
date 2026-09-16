/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { certifySignature } from "./signatures";
const modules = import.meta.glob("./**/*.ts");
const signature = [[{ x: 20, y: 30 }, { x: 120, y: 80 }, { x: 160, y: 20 }]];
const token = "a".repeat(64);
async function setup() {
  const t = convexTest(schema, modules);
  const data = await t.run(async ctx => {
    const admin = await ctx.db.insert("users", { role: "admin", active: true });
    const viewer = await ctx.db.insert("users", { role: "viewer", active: true });
    const files = { studentIdImageId: await ctx.storage.store(new Blob(["student"])), nationalIdImageId: await ctx.storage.store(new Blob(["national"])) };
    const person = { ...files, studentId: "6900000001", fullNameThai: "ทดสอบ", fullNameEnglish: "Test Person", faculty: "คณะศิลปศาสตร์", source: "import" as const, status: "pending" as const, updatedAt: 1 };
    const first = await ctx.db.insert("participants", { ...person, sport: "Badminton" });
    const second = await ctx.db.insert("participants", { ...person, sport: "Swimming" });
    const other = await ctx.db.insert("participants", { ...person, studentId: "6900000002", sport: "Badminton" });
    return { admin, viewer, first, second, other };
  });
  return { t, ...data, staff: t.withIdentity({ subject: `${data.admin}|session` }), readonly: t.withIdentity({ subject: `${data.viewer}|session` }) };
}

test("signature requires actual bounded ink, not missing data or separate taps", () => {
  for (const ink of [undefined, [], [[{ x: 1, y: 1 }], [{ x: 100, y: 100 }]], [[{ x: 1, y: 1 }, { x: 1, y: 1 }]], [[{ x: NaN, y: 1 }, { x: 100, y: 10 }]], [[{ x: 1, y: 1 }, { x: 601, y: 10 }]]]) {
    expect(() => certifySignature(ink, "Test")).toThrow("signature");
  }
  expect(certifySignature(signature, "Test")).toMatchObject({ signature, signedName: "Test" });
});

test("only editors create links; unknown links cannot read or write records", async () => {
  const { t, staff, readonly, first } = await setup();
  await expect(t.mutation(api.signatureRequests.create, { participantId: first, token })).rejects.toThrow("Authentication");
  await expect(readonly.mutation(api.signatureRequests.create, { participantId: first, token })).rejects.toThrow("Read-only");
  await staff.mutation(api.signatureRequests.create, { participantId: first, token });
  await expect(t.mutation(api.signatureRequests.open, { token: "b".repeat(64) })).rejects.toThrow("link");
  await expect(t.mutation(api.signatureRequests.submit, { token: "b".repeat(64), signature, confirmed: true })).rejects.toThrow("link");
});

test("a link signs only its student's registrations once and rejects blank signatures", async () => {
  const { t, staff, first, second, other } = await setup();
  await staff.mutation(api.signatureRequests.create, { participantId: first, token });
  const data = await t.mutation(api.signatureRequests.open, { token });
  expect(data.records).toHaveLength(2);
  await expect(t.mutation(api.signatureRequests.submit, { token, signature: [], confirmed: true })).rejects.toThrow("signature");
  await t.mutation(api.signatureRequests.submit, { token, signature, confirmed: true });
  for (const id of [first, second]) expect(await t.run(ctx => ctx.db.get("participants", id))).toMatchObject({ signature, signedName: "ทดสอบ", status: "pending" });
  expect((await t.run(ctx => ctx.db.get("participants", other)))?.signature).toBeUndefined();
  await expect(t.mutation(api.signatureRequests.open, { token })).rejects.toThrow("link");
  await expect(t.mutation(api.signatureRequests.submit, { token, signature, confirmed: true })).rejects.toThrow("link");
});

test("expired, replaced, and stale links cannot certify changed information", async () => {
  const { t, staff, first, second } = await setup();
  await staff.mutation(api.signatureRequests.create, { participantId: first, token });
  await t.run(async ctx => { const request = await ctx.db.query("signatureRequests").withIndex("by_token", q => q.eq("token", token)).unique(); await ctx.db.patch("signatureRequests", request!._id, { expiresAt: 0 }); });
  await expect(t.mutation(api.signatureRequests.open, { token })).rejects.toThrow("link");
  const replacement = "b".repeat(64);
  await staff.mutation(api.signatureRequests.create, { participantId: first, token: replacement });
  await expect(t.mutation(api.signatureRequests.open, { token })).rejects.toThrow("link");
  await t.mutation(api.signatureRequests.open, { token: replacement });
  await t.run(ctx => ctx.db.patch("participants", second, { updatedAt: 2, fullNameThai: "Changed" }));
  await expect(t.mutation(api.signatureRequests.submit, { token: replacement, signature, confirmed: true })).rejects.toThrow("record changed");
  expect((await t.run(ctx => ctx.db.get("participants", first)))?.signature).toBeUndefined();
});

test("deleted ID files invalidate certification", async () => {
  const { t, staff, first } = await setup();
  await staff.mutation(api.signatureRequests.create, { participantId: first, token });
  await t.run(async ctx => { const person = await ctx.db.get("participants", first); await ctx.storage.delete(person!.studentIdImageId!); });
  await expect(t.mutation(api.signatureRequests.submit, { token, signature, confirmed: true })).rejects.toThrow("ID images");
});


test("booth uploads remain pending until signed, and replacement IDs clear verification", async () => {
  const { t, staff, first } = await setup();
  const files = await t.run(async ctx => ({ profilePhotoId: await ctx.storage.store(new Blob(["photo"])), studentIdImageId: await ctx.storage.store(new Blob(["new student"])), nationalIdImageId: await ctx.storage.store(new Blob(["new national"])) }));
  await expect(staff.mutation(api.participants.updateStatus, { participantId: first, status: "verified" })).rejects.toThrow("must sign");
  await staff.mutation(api.participants.completeStaffUpload, { participantId: first, ...files, uploadedFromBooth: true });
  expect(await t.run(ctx => ctx.db.get("participants", first))).toMatchObject({ status: "pending" });
  await t.run(ctx => ctx.db.patch("participants", first, { signature, status: "verified" }));
  await staff.mutation(api.participants.completeStaffUpload, { participantId: first, studentIdImageId: files.studentIdImageId, uploadedFromBooth: true });
  const row = await t.run(ctx => ctx.db.get("participants", first));
  expect(row?.status).toBe("pending");
  expect(row?.signature).toBeUndefined();
});

test("signature-only links show correction notes and resubmit only the signature field", async () => {
  const { t, staff, first } = await setup();
  await staff.mutation(api.participants.setFieldCorrection, { participantId: first, field: "signature", note: "Signature not completed; please sign your full name", requested: true });
  await staff.mutation(api.participants.setFieldCorrection, { participantId: first, field: "medicalConditions", note: "Please clarify", requested: true });
  await staff.mutation(api.signatureRequests.create, { participantId: first, token });
  const data = await t.mutation(api.signatureRequests.open, { token });
  expect(data.records.flatMap(record => record.signatureNotes)).toEqual(["Signature not completed; please sign your full name"]);
  await t.mutation(api.signatureRequests.submit, { token, signature, confirmed: true });
  const person = await t.run(ctx => ctx.db.get("participants", first));
  expect(person).toMatchObject({ status: "rejected", signature });
  expect(person?.correctionRequests).toEqual([
    { field: "signature", note: "Signature not completed; please sign your full name", status: "submitted" },
    { field: "medicalConditions", note: "Please clarify", status: "requested" },
  ]);
});

test("signature correction requires fresh ink and returns to pending review", async () => {
  const { t, staff, first } = await setup();
  await t.run(ctx => ctx.db.patch("participants", first, { signature }));
  await staff.mutation(api.participants.setFieldCorrection, { participantId: first, field: "signature", note: "Please sign clearly", requested: true });
  await staff.mutation(api.signatureRequests.create, { participantId: first, token });
  await expect(t.mutation(api.signatureRequests.submit, { token, signature, confirmed: true })).rejects.toThrow("new signature");
  const fresh = [[{ x: 10, y: 20 }, { x: 170, y: 70 }]];
  await t.mutation(api.signatureRequests.submit, { token, signature: fresh, confirmed: true });
  expect(await t.run(ctx => ctx.db.get("participants", first))).toMatchObject({ status: "pending", signature: fresh, correctionRequests: [{ field: "signature", note: "Please sign clearly", status: "submitted" }] });
});
