/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const person = { studentId: "6909680001", fullNameThai: "ทดสอบ", fullNameEnglish: "Test Swimmer", faculty: "คณะแพทยศาสตร์", sport: "Swimming", participantKind: "athlete" as const };
async function setup() {
  const t = convexTest(schema, modules);
  const id = await t.run(ctx => ctx.db.insert("users", { role: "admin", active: true }));
  return { t, staff: t.withIdentity({ subject: `${id}|session` }) };
}

test("sport and category migrations update linked registrations, history and stale imports", async () => {
  const { t, staff } = await setup();
  await staff.mutation(api.participants.importBatch, { participants: [{ ...person, categories: ["50 m Freestyle", "50 m Backstroke"] }, { ...person, sport: "Athletics", category: "100 m" }] });
  expect(await staff.mutation(api.sportCatalog.save, { code: "SW", expectedName: "Swimming", name: "Aquatics", thai: "ว่ายน้ำ" })).toBe(1);
  expect(await staff.mutation(api.sportCatalog.save, { code: "SW", expectedName: "Aquatics", name: "Aquatics", thai: "ว่ายน้ำ", category: { oldName: "50 m Freestyle", name: "Freestyle 50 metres" } })).toBe(1);
  await staff.mutation(api.participants.importBatch, { participants: [{ ...person, sport: "SW", categories: ["50 m Freestyle"] }] });
  const rows = await t.run(ctx => ctx.db.query("participants").collect());
  expect(rows).toHaveLength(2);
  expect(rows.find(p => p.sport === "Aquatics")).toMatchObject({ category: "Freestyle 50 metres", categories: ["Freestyle 50 metres", "50 m Backstroke"] });
  expect(rows.find(p => p.sport === "Athletics")?.category).toBe("100 m");
  const preview = await staff.query(api.sportCatalog.migrationPreview, { code: "SW" });
  expect(preview.history.map(h => [h.oldValue, h.newValue])).toEqual([["50 m Freestyle", "Freestyle 50 metres"], ["Swimming", "Aquatics"]]);
  await staff.mutation(api.participants.createParticipant, { participant: { ...person, studentId: "6909680002", sport: "Swimming", categories: ["50 m Freestyle"] } });
  expect((await t.run(ctx => ctx.db.query("participants").collect())).filter(p => p.sport === "Aquatics")).toHaveLength(2);
});

test("legacy category migration merges into an existing category and clears signatures", async () => {
  const { t, staff } = await setup();
  const id = await t.run(ctx => ctx.db.insert("participants", { ...person, category: "Old freestyle", categories: ["Old freestyle", "50 m Freestyle"], source: "import", status: "verified", updatedAt: 1, signedName: "Test", signedAt: 1, signature: [[{ x: 1, y: 1 }]] }));
  expect((await staff.query(api.sportCatalog.migrationPreview, { code: "SW" })).categories).toContainEqual({ name: "Old freestyle", participants: 1 });
  await staff.mutation(api.sportCatalog.save, { code: "SW", expectedName: "Swimming", name: "Swimming", thai: "ว่ายน้ำ", category: { oldName: "Old freestyle", name: "50 m Freestyle" } });
  const row = await t.run(ctx => ctx.db.get("participants", id));
  expect(row?.categories).toEqual(["50 m Freestyle"]);
  expect(row?.signature).toBeUndefined();
  await staff.mutation(api.participants.importBatch, { participants: [{ ...person, category: "Old freestyle" }] });
  expect((await t.run(ctx => ctx.db.get("participants", id)))?.categories).toEqual(["50 m Freestyle"]);
});

test("migrations reject unauthorized users, collisions and stale changes without partial writes", async () => {
  const { t, staff } = await setup();
  const args = { code: "SW", expectedName: "Swimming", name: "Aquatics", thai: "ว่ายน้ำ" };
  for (const role of ["viewer", "registrar", "co-sport"] as const) {
    const id = await t.run(ctx => ctx.db.insert("users", { role, active: true }));
    await expect(t.withIdentity({ subject: `${id}|session` }).mutation(api.sportCatalog.save, args)).rejects.toThrow("Administrator");
  }
  await expect(t.mutation(api.sportCatalog.save, args)).rejects.toThrow("Authentication");
  await expect(staff.mutation(api.sportCatalog.save, { ...args, name: "Athletics" })).rejects.toThrow("already uses");
  await staff.mutation(api.sportCatalog.save, args);
  await expect(staff.mutation(api.sportCatalog.save, args)).rejects.toThrow("changed");
  expect((await staff.query(api.sportCatalog.list)).find(s => s.code === "SW")?.name).toBe("Aquatics");
  expect((await staff.query(api.sportCatalog.migrationPreview, { code: "SW" })).history).toHaveLength(1);
});
