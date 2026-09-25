/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { participantCsv } from "../app/lib/participantCsv";

const modules = import.meta.glob("./**/*.ts");

test("contact export enforces staff access and paginates across other participant types", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const admin = await ctx.db.insert("users", { role: "admin", active: true });
    const restricted = await ctx.db.insert("users", { role: "co-sport", active: true });
    const base = { fullNameThai: "ทดสอบ", fullNameEnglish: "Test", faculty: "Medicine", sport: "Volleyball", status: "incomplete" as const, source: "staff" as const, updatedAt: 1 };
    await ctx.db.insert("participants", { ...base, studentId: "001", nicknameThai: "ชื่อเล่น", phone: "0812345678", lineId: "test.line", categories: ["Men", "Mixed"] });
    await ctx.db.insert("participants", { ...base, studentId: "002", participantKind: "performer", sport: "Parade", category: "Parade member" });
    await ctx.db.insert("participants", { ...base, studentId: "003", participantKind: "performer", sport: "Parade", category: "Camera" });
    return { admin, restricted };
  });
  const args = { kind: "athlete" as const, paginationOpts: { cursor: null, numItems: 1 } };
  await expect(t.query(api.participants.exportContacts, args)).rejects.toThrow("Authentication required");
  await expect(t.withIdentity({ subject: `${ids.restricted}|session` }).query(api.participants.exportContacts, args)).rejects.toThrow("Contact directory access only");
  const staff = t.withIdentity({ subject: `${ids.admin}|session` });
  const first = await staff.query(api.participants.exportContacts, args);
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const second = await staff.query(api.participants.exportContacts, { ...args, paginationOpts: { cursor: first.continueCursor, numItems: 1 } });
  const third = await staff.query(api.participants.exportContacts, { ...args, paginationOpts: { cursor: second.continueCursor, numItems: 1 } });
  expect(third.page).toEqual([{ studentId: "001", name: "ทดสอบ", nickname: "ชื่อเล่น", faculty: "Medicine", tel: "0812345678", line: "test.line", sport: "Volleyball", type: "Men; Mixed" }]);
  const performers = await staff.query(api.participants.exportContacts, { kind: "performer", paginationOpts: { cursor: null, numItems: 100 } });
  expect(performers.page.map(p => [p.studentId, p.sport, p.type])).toEqual([["002", "Parade", "Parade member"]]);
});

test("CSV handles Thai, quoting, blank fields, formulas and repeated registrations", () => {
  const person = { studentId: "0012345678", name: 'ทดสอบ, "Name"', nickname: "A\nB", faculty: "", tel: "0812345678", line: "=1+1", sport: "Volleyball", type: "Men; Mixed" };
  const csv = participantCsv([person]);
  expect(csv).toBe('\uFEFF"Name","Nickname","Faculty","Tel","Line","Student ID","Sport","Type"\r\n"ทดสอบ, ""Name""","A\nB","","0812345678","\'=1+1","0012345678","Volleyball","Men; Mixed"\r\n');
  const multiple = participantCsv([person, { ...person, sport: "Swimming", type: "Freestyle" }]);
  expect(multiple).toContain('"Swimming","Freestyle"');
  expect(multiple).toContain('"Volleyball","Men; Mixed"');
  expect(multiple.match(/0012345678/g)).toHaveLength(2);
  expect(participantCsv([])).toContain('"Student ID","Sport","Type"\r\n');
});
