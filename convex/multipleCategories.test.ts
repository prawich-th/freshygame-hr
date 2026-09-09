/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const participant = {
  studentId: "6909680001", fullNameThai: "ทดสอบ", fullNameEnglish: "Test Swimmer",
  nicknameThai: "Tester", nicknameEnglish: "Tester", phone: "0812345678", email: "test@example.com",
  faculty: "คณะแพทยศาสตร์" as const, sport: "Swimming", participantKind: "athlete" as const,
};
async function setup() {
  const t = convexTest(schema, modules);
  const id = await t.run(ctx => ctx.db.insert("users", { role: "admin", active: true }));
  return { t, staff: t.withIdentity({ subject: `${id}|session` }) };
}

test("multiple categories round-trip through create, list, directory, export and edit", async () => {
  const { t, staff } = await setup();
  const categories = ["50 m Freestyle", "50 m Backstroke"];
  const id = await staff.mutation(api.participants.createParticipant, { participant: { ...participant, categories: [" 50 m Freestyle ", ...categories] } });
  expect(await t.run(ctx => ctx.db.get("participants", id))).toMatchObject({ categories, category: categories[0] });
  expect((await staff.query(api.directory.search, { term: "Swimmer" })).contacts[0].categories).toEqual(categories);
  expect((await staff.query(api.participants.list, { paginationOpts: { cursor: null, numItems: 10 } })).page[0].categories).toEqual(categories);
  expect((await staff.query(api.participants.exportSelected, { participantIds: [id] }))[0].participant.categories).toEqual(categories);
  await staff.mutation(api.participants.updateParticipant, { ...participant, participantId: id, categories: [categories[1]] });
  expect(await t.run(ctx => ctx.db.get("participants", id))).toMatchObject({ categories: [categories[1]], category: categories[1] });
  await expect(staff.mutation(api.participants.updateParticipant, { ...participant, participantId: id, categories: [] })).rejects.toThrow("event type");
  await expect(staff.mutation(api.participants.updateParticipant, { ...participant, participantId: id, categories: ["100 m"] })).rejects.toThrow("event type");
  await expect(staff.mutation(api.participants.createParticipant, { participant: { ...participant, studentId: "6909680002", categories: ["50 m Freestyle", "100 m"] } })).rejects.toThrow("event type");
});

test("imports merge repeated categories across batches and keep other sports separate", async () => {
  const { t, staff } = await setup();
  await staff.mutation(api.participants.importBatch, { participants: [
    { ...participant, category: "50 m Freestyle" },
    { ...participant, category: "50 m Backstroke" },
    { ...participant, sport: "Athletics", category: "100 m" },
  ] });
  await staff.mutation(api.participants.importBatch, { participants: [
    { ...participant, sport: "SW", categories: ["50 m Backstroke", "Freestyle Relay"] },
  ] });
  const rows = await t.run(ctx => ctx.db.query("participants").collect());
  expect(rows).toHaveLength(2);
  expect(rows.find(p => p.sport === "Swimming")?.categories).toEqual(["50 m Freestyle", "50 m Backstroke", "Freestyle Relay"]);
  expect(rows.find(p => p.sport === "Athletics")?.categories).toEqual(["100 m"]);
});

test("legacy free-form categories remain readable and editable without a migration", async () => {
  const { t, staff } = await setup();
  const id = await t.run(ctx => ctx.db.insert("participants", { ...participant, sport: "Taekwondo", category: "Under 58 kg", status: "verified", source: "import", updatedAt: 1 }));
  expect((await staff.query(api.directory.search, { term: "Swimmer" })).contacts[0].categories).toEqual(["Under 58 kg"]);
  await staff.mutation(api.participants.updateParticipant, { ...participant, sport: "Taekwondo", participantId: id, categories: ["Under 58 kg", "Combat — By weight class"] });
  expect((await t.run(ctx => ctx.db.get("participants", id)))?.categories).toHaveLength(2);
  await expect(staff.mutation(api.participants.updateParticipant, { ...participant, participantId: id, categories: ["Under 58 kg"] })).rejects.toThrow("event type");
});

test("switching away from athlete clears sport categories and read-only staff cannot edit them", async () => {
  const { t, staff } = await setup();
  const id = await staff.mutation(api.participants.createParticipant, { participant: { ...participant, categories: ["50 m Freestyle"] } });
  const viewerId = await t.run(ctx => ctx.db.insert("users", { role: "viewer", active: true }));
  await expect(t.withIdentity({ subject: `${viewerId}|session` }).mutation(api.participants.updateParticipant, { ...participant, participantId: id, categories: ["50 m Backstroke"] })).rejects.toThrow("Read-only access");
  await staff.mutation(api.participants.updateParticipant, { ...participant, participantId: id, participantKind: "support", sport: "Support team", category: "Camera" });
  const saved = await t.run(ctx => ctx.db.get("participants", id));
  expect(saved?.categories).toBeUndefined();
  expect(saved?.category).toBe("Camera");
});
