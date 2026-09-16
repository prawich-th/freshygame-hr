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

test("unused default categories stay deleted, including the last category, with an audit entry", async () => {
  const { t, staff } = await setup();
  await staff.mutation(api.sportCatalog.deleteCategory, { code: "VB", name: "Team" });
  expect((await staff.query(api.sportCatalog.list)).find(s => s.code === "VB")?.events).toEqual([]);
  expect((await staff.query(api.sportCatalog.list)).find(s => s.code === "BB")?.types).toContain("Team");
  expect(await t.run(ctx => ctx.db.query("auditEvents").collect())).toEqual(expect.arrayContaining([expect.objectContaining({ action: "sport_category_deleted:VB:Team" })]));
  await expect(staff.mutation(api.sportCatalog.deleteCategory, { code: "VB", name: "Team" })).rejects.toThrow("not found");
});

test("deletion rejects categories used through canonical or historical names, even after a stale preview", async () => {
  const { t, staff } = await setup();
  await staff.mutation(api.sportCatalog.save, { code: "SW", expectedName: "Swimming", name: "Aquatics", thai: "", category: { oldName: "50 m Freestyle", name: "Freestyle" } });
  expect((await staff.query(api.sportCatalog.migrationPreview, { code: "SW" })).participants).toBe(0);
  const id = await t.run(ctx => ctx.db.insert("participants", { ...person, sport: "SW", category: " 50 M FREESTYLE ", source: "import", status: "incomplete", updatedAt: 1 }));
  await expect(staff.mutation(api.sportCatalog.deleteCategory, { code: "SW", name: "Freestyle" })).rejects.toThrow("used by participants");
  await t.run(ctx => ctx.db.patch("participants", id, { sport: "Aquatics", categories: ["50 m Backstroke", "Freestyle"] }));
  await expect(staff.mutation(api.sportCatalog.deleteCategory, { code: "SW", name: "Freestyle" })).rejects.toThrow("used by participants");
  await t.run(ctx => ctx.db.patch("participants", id, { category: "50 m Backstroke", categories: ["50 m Backstroke"] }));
  await staff.mutation(api.sportCatalog.deleteCategory, { code: "SW", name: "Freestyle" });
  expect((await staff.query(api.sportCatalog.list)).find(s => s.code === "SW")?.types).not.toContain("Freestyle");
  expect((await staff.query(api.sportCatalog.migrationPreview, { code: "SW" })).history).toHaveLength(2);
});

test("only administrators may delete unused categories", async () => {
  const { t } = await setup();
  const args = { code: "SW", name: "50 m Freestyle" };
  await expect(t.mutation(api.sportCatalog.deleteCategory, args)).rejects.toThrow("Authentication");
  for (const role of ["viewer", "registrar", "co-sport"] as const) {
    const id = await t.run(ctx => ctx.db.insert("users", { role, active: true }));
    await expect(t.withIdentity({ subject: `${id}|session` }).mutation(api.sportCatalog.deleteCategory, args)).rejects.toThrow("Administrator");
  }
});
