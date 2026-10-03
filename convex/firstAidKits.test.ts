/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");

async function setup(role: "admin" | "registrar" | "viewer" = "admin") {
  const t = convexTest(schema, modules);
  const id = await t.run(ctx => ctx.db.insert("users", { role, active: true, name: "Staff" }));
  const staff = t.withIdentity({ subject: `${id}|session` });
  const admin = role === "admin" ? staff : t.withIdentity({ subject: `${await t.run(ctx => ctx.db.insert("users", { role: "admin", active: true }))}|session` });
  await admin.mutation(api.firstAidKits.addKits, { count: 2 });
  const kits = await t.query(api.firstAidKits.publicStatus, {});
  return { t, staff, kits };
}
const person = { studentId: "6909680001", name: "สมชาย ใจดี", nickname: "ชาย", phone: "+66 81 234 5678" };

test("anyone can borrow and return without an account, and repeat borrowers only need a student ID", async () => {
  const { t, staff, kits } = await setup();
  expect(kits.map(k => k.number)).toEqual([1, 2]);
  await t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Football", ...person });
  const status = await t.query(api.firstAidKits.publicStatus, {});
  expect(status[0].current).toMatchObject({ name: "สมชาย ใจดี", nickname: "ชาย", sport: "Football" });
  expect(JSON.stringify(status)).not.toContain("6909680001");
  expect(JSON.stringify(status)).not.toContain("0812345678");
  await t.mutation(api.firstAidKits.checkIn, { kitId: kits[0].id, studentId: person.studentId });

  expect(await t.query(api.firstAidKits.knownBorrower, { studentId: person.studentId })).toEqual({ name: "สมชาย ใจดี", nickname: "ชาย", phoneHint: "•••-•••-5678" });
  await t.mutation(api.firstAidKits.checkOut, { kitId: kits[1].id, sport: "Basketball", studentId: person.studentId });
  const log = await staff.query(api.firstAidKits.log, { paginationOpts: { cursor: null, numItems: 10 } });
  expect(log.page.map(r => [r.kitNumber, r.sport, r.phone, r.returnedAt === null])).toEqual([[2, "Basketball", "0812345678", true], [1, "Football", "0812345678", false]]);
  expect(log.page[1].returnerName).toBe("สมชาย ใจดี");
});

test("new borrowers must give name, nickname and phone; public users cannot backdate", async () => {
  const { t, kits } = await setup();
  await expect(t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Football", studentId: "6909680002", name: "A", nickname: "B" })).rejects.toThrow(/phone/);
  await expect(t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Football", ...person, phone: "123" })).rejects.toThrow(/Phone number/);
  await expect(t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Football", ...person, borrowedAt: Date.now() - 1000 })).rejects.toThrow(/staff/);
});

test("a kit can move between sports in one day through a handover", async () => {
  const { t, staff, kits } = await setup();
  await t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Football", ...person });
  await expect(t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Volleyball", studentId: "6909680002", name: "ข", nickname: "ข", phone: "0899999999" })).rejects.toThrow(/already with/);
  await t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Volleyball", studentId: "6909680002", name: "สมหญิง", nickname: "หญิง", phone: "0899999999", handover: true });
  const overview = await staff.query(api.firstAidKits.overview, { dayStart: 0 });
  expect(overview[0]).toMatchObject({ loansToday: 2, current: { sport: "Volleyball", borrowerName: "สมหญิง" }, lastReturned: { sport: "Football", returnerName: "สมหญิง", returnerStudentId: "6909680002" } });
});

test("staff views and corrections are protected by role", async () => {
  const { t, kits } = await setup("viewer");
  await expect(t.query(api.firstAidKits.overview, { dayStart: 0 })).rejects.toThrow(/Authentication/);
  const viewer = (await setup("viewer")).staff;
  expect(await viewer.query(api.firstAidKits.overview, { dayStart: 0 })).toHaveLength(2);
  await t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Football", ...person });
  const [entry] = (await t.run(ctx => ctx.db.query("firstAidKitLoans").collect()));
  await expect(viewer.mutation(api.firstAidKits.updateLoan, { loanId: entry._id, borrowerName: "x", nickname: "x", phone: "0812345678", studentId: person.studentId, sport: "x", borrowedAt: entry.borrowedAt, returnedAt: null })).rejects.toThrow();
  await expect(viewer.mutation(api.firstAidKits.addKits, { count: 1 })).rejects.toThrow(/Administrator/);
});

test("registrars can correct log entries and retired kits leave the public page", async () => {
  const { t, staff, kits } = await setup("registrar");
  await t.mutation(api.firstAidKits.checkOut, { kitId: kits[0].id, sport: "Futbol", ...person });
  const [entry] = await t.run(ctx => ctx.db.query("firstAidKitLoans").collect());
  await staff.mutation(api.firstAidKits.updateLoan, { loanId: entry._id, borrowerName: entry.borrowerName, nickname: entry.nickname, phone: entry.phone, studentId: entry.studentId, sport: "Football", borrowedAt: entry.borrowedAt - 60000, returnedAt: entry.borrowedAt });
  expect(await t.run(ctx => ctx.db.get("firstAidKitLoans", entry._id))).toMatchObject({ sport: "Football", returnedAt: entry.borrowedAt });
  await expect(staff.mutation(api.firstAidKits.updateKit, { kitId: kits[1].id, label: "", active: false })).rejects.toThrow(/Administrator/);
  const admin = t.withIdentity({ subject: `${await t.run(ctx => ctx.db.insert("users", { role: "admin", active: true }))}|session` });
  await admin.mutation(api.firstAidKits.updateKit, { kitId: kits[1].id, label: "", active: false });
  expect((await t.query(api.firstAidKits.publicStatus, {})).map(k => k.number)).toEqual([1]);
});
