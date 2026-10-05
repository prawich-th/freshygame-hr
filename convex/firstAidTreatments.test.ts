/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");

const ink = [[{ x: 10, y: 10 }, { x: 80, y: 60 }, { x: 150, y: 20 }]];
const record = {
  sport: "Football", patientName: "ผู้ป่วย ทดสอบ", patientStudentId: "6909680009", patientFaculty: "CICM" as const,
  symptoms: "ข้อเท้าพลิก", supplies: "สเปรย์เย็น", patientSignature: ink,
  caretakerStudentId: "6909680001", caretakerName: "ผู้ดูแล ทดสอบ", caretakerSignature: ink,
};

async function setup(role: "admin" | "viewer" = "admin") {
  const t = convexTest(schema, modules);
  const adminId = await t.run(ctx => ctx.db.insert("users", { role: "admin", active: true }));
  const admin = t.withIdentity({ subject: `${adminId}|session` });
  await admin.mutation(api.firstAidKits.addKits, { count: 2 });
  const kits = await t.query(api.firstAidKits.publicStatus, {});
  const staffId = role === "admin" ? adminId : await t.run(ctx => ctx.db.insert("users", { role, active: true }));
  return { t, staff: t.withIdentity({ subject: `${staffId}|session` }), kits };
}

test("anyone can log first aid; each kit numbers its own records", async () => {
  const { t, staff, kits } = await setup();
  expect(await t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record })).toEqual({ kitNumber: 1, sequence: 1 });
  expect(await t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record, patientStudentId: undefined, patientFaculty: "MED" })).toEqual({ kitNumber: 1, sequence: 2 });
  expect(await t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[1].id, ...record })).toEqual({ kitNumber: 2, sequence: 1 });
  const all = await staff.query(api.firstAidTreatments.list, { paginationOpts: { cursor: null, numItems: 10 } });
  expect(all.page).toHaveLength(3);
  const kit1 = await staff.query(api.firstAidTreatments.list, { kitId: kits[0].id, paginationOpts: { cursor: null, numItems: 10 } });
  expect(kit1.page.map(r => [r.sequence, r.patientFaculty, r.patientStudentId])).toEqual([[2, "MED", ""], [1, "CICM", "6909680009"]]);
});

test("both signatures and the patient's faculty are required", async () => {
  const { t, kits } = await setup();
  await expect(t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record, patientSignature: [] })).rejects.toThrow(/ผู้ใช้/);
  await expect(t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record, caretakerSignature: [[{ x: 1, y: 1 }]] })).rejects.toThrow(/ผู้ดูแล/);
  // @ts-expect-error faculty is validated at the API boundary
  await expect(t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record, patientFaculty: "ENG" })).rejects.toThrow();
});

test("caretaker name comes from earlier kit logs when omitted", async () => {
  const { t, staff, kits } = await setup();
  await t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Football", studentId: "6909680001", name: "สมชาย ใจดี", nickname: "ชาย", phone: "0812345678", faculty: "MED" });
  await t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record, caretakerName: undefined });
  const [row] = (await staff.query(api.firstAidTreatments.list, { paginationOpts: { cursor: null, numItems: 1 } })).page;
  expect(row.caretakerName).toBe("สมชาย ใจดี");
  await expect(t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record, caretakerStudentId: "6909680077", caretakerName: undefined })).rejects.toThrow(/Caretaker name/);
});

test("medical records are staff-only and only admins can delete them", async () => {
  const { t, staff, kits } = await setup("viewer");
  await t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record });
  await expect(t.query(api.firstAidTreatments.list, { paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow(/Authentication/);
  const [row] = (await staff.query(api.firstAidTreatments.list, { paginationOpts: { cursor: null, numItems: 10 } })).page;
  await expect(staff.mutation(api.firstAidTreatments.remove, { treatmentId: row.id })).rejects.toThrow(/Administrator/);
  const audit = await t.run(ctx => ctx.db.query("auditEvents").collect());
  expect(JSON.stringify(audit)).not.toContain("ข้อเท้าพลิก");
});

test("a known patient's name and faculty are filled from the participant registry", async () => {
  const { t, staff, kits } = await setup();
  await t.run(ctx => ctx.db.insert("participants", { studentId: "6909680055", fullNameThai: "นักกีฬา ลงทะเบียน", fullNameEnglish: "Registered", faculty: "คณะแพทยศาสตร์", sport: "Football", status: "verified", source: "import", updatedAt: 1 }));
  await t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record, patientName: undefined, patientFaculty: undefined, patientStudentId: "6909680055" });
  const [row] = (await staff.query(api.firstAidTreatments.list, { paginationOpts: { cursor: null, numItems: 1 } })).page;
  expect(row).toMatchObject({ patientName: "นักกีฬา ลงทะเบียน", patientFaculty: "MED" });
  await expect(t.mutation(api.firstAidTreatments.logTreatment, { kitId: kits[0].id, ...record, patientName: undefined, patientFaculty: undefined, patientStudentId: undefined })).rejects.toThrow(/faculty/);
});
