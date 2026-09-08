/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const row = (studentId: string) => ({studentId, fullNameThai: "ทดสอบ", fullNameEnglish: "Test Participant", faculty: "คณะแพทยศาสตร์", sport: "Volleyball", status: "incomplete" as const, source: "staff" as const, updatedAt: 1});
afterEach(() => vi.useRealTimers());
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => ({
    admin: await ctx.db.insert("users", {role:"admin", active:true}),
    registrar: await ctx.db.insert("users", {role:"registrar", active:true}),
    keep: await ctx.db.insert("participants", row("6909680001")),
    remove: await ctx.db.insert("participants", row("6909680002")),
  }));
  return {t, ids, admin:t.withIdentity({subject: `${ids.admin}|session`})};
}

test("only admins can review or remove; empty selection and invalid confirmation do nothing", async () => {
  const {t, ids, admin} = await setup();
  const args = {sport:"Volleyball", keepIds:[ids.keep], reviewedIds:[ids.keep,ids.remove], confirmation:"REMOVE OTHERS"};
  await expect(t.mutation(api.participants.keepOnlySelected, args)).rejects.toThrow("Authentication required");
  const registrar = t.withIdentity({subject:`${ids.registrar}|session`});
  await expect(registrar.query(api.participants.removalCandidates, {sport:"Volleyball"})).rejects.toThrow("Administrator access required");
  await expect(registrar.mutation(api.participants.keepOnlySelected, args)).rejects.toThrow("Administrator access required");
  await expect(admin.mutation(api.participants.keepOnlySelected, {...args, sport:"Volleyball", keepIds:[]})).rejects.toThrow("at least one");
  await expect(admin.mutation(api.participants.keepOnlySelected, {...args, confirmation:"yes"})).rejects.toThrow("REMOVE OTHERS");
  expect(await t.run(ctx => ctx.db.get("participants", ids.remove))).not.toBeNull();
});

test("stale membership, foreign keep IDs, and keeping everyone are rejected", async () => {
  const {t, ids, admin} = await setup();
  const extra = await t.run(ctx => ctx.db.insert("participants", row("6909680003")));
  const args = {sport:"Volleyball", keepIds:[ids.keep], reviewedIds:[ids.keep,ids.remove], confirmation:"REMOVE OTHERS"};
  await expect(admin.mutation(api.participants.keepOnlySelected, args)).rejects.toThrow("list changed");
  await t.run(ctx => ctx.db.delete("participants", extra));
  await expect(admin.mutation(api.participants.keepOnlySelected, {...args, sport:"Volleyball", keepIds:[extra]})).rejects.toThrow("list changed");
  await expect(admin.mutation(api.participants.keepOnlySelected, {...args, sport:"Volleyball", keepIds:[ids.keep,ids.remove]})).rejects.toThrow("nobody to remove");
});

test("removes the exact snapshot, cleans all sessions and unshared images, preserves selected and new records", async () => {
  vi.useFakeTimers();
  const {t, ids, admin} = await setup();
  const files = await t.run(async ctx => {
    const shared = await ctx.storage.store(new Blob(["shared"]));
    const removed = await ctx.storage.store(new Blob(["removed"]));
    await ctx.db.patch("participants", ids.keep, {profilePhotoId:shared});
    await ctx.db.patch("participants", ids.remove, {profilePhotoId:shared, nationalIdImageId:removed});
    const audit = await ctx.db.insert("auditEvents", {action:"test", ipAddress:"test", attempts:1, createdAt:1, participantId:ids.remove});
    for (let i=0;i<120;i++) await ctx.db.insert("uploadSessions", {participantId:ids.remove, auditEventId:audit, used:false, expiresAt:99999});
    return {shared,removed,audit};
  });
  const jobId = await admin.mutation(api.participants.keepOnlySelected, {sport:"Volleyball", keepIds:[ids.keep], reviewedIds:[ids.keep,ids.remove], confirmation:"REMOVE OTHERS"});
  const newId = await t.run(ctx => ctx.db.insert("participants", row("6909680004")));
  await expect(admin.mutation(api.participants.keepOnlySelected, {sport:"Volleyball", keepIds:[ids.keep], reviewedIds:[ids.keep,ids.remove,newId], confirmation:"REMOVE OTHERS"})).rejects.toThrow("already in progress");
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await t.run(async ctx => {
    expect(await ctx.db.get("participants", ids.keep)).not.toBeNull();
    expect(await ctx.db.get("participants", newId)).not.toBeNull();
    expect(await ctx.db.get("participants", ids.remove)).toBeNull();
    expect(await ctx.storage.get(files.shared)).not.toBeNull();
    expect(await ctx.storage.get(files.removed)).toBeNull();
    expect(await ctx.db.query("uploadSessions").withIndex("by_participantId",q=>q.eq("participantId",ids.remove)).first()).toBeNull();
    expect(await ctx.db.get("auditEvents", files.audit)).not.toBeNull();
    expect(await ctx.db.get("participantRemovalJobs",jobId)).toMatchObject({status:"complete",nextIndex:1,participantIds:[]});
  });
});

test("a paused job resumes without removing retained participants", async () => {
  vi.useFakeTimers();
  const {t, ids, admin} = await setup();
  const jobId = await t.run(ctx => ctx.db.insert("participantRemovalJobs", {participantIds:[ids.remove], nextIndex:0, removeCount:1, keepCount:1, status:"paused", createdBy:ids.admin}));
  await admin.mutation(api.participants.resumeRemoval, {jobId});
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await admin.query(api.participants.latestRemoval, {})).toMatchObject({status:"complete",processed:1});
  expect(await t.run(ctx => ctx.db.get("participants",ids.keep))).not.toBeNull();
});

test("sport review excludes other sports and forged cross-sport selections are rejected", async () => {
  vi.useFakeTimers();
  const {t, ids, admin} = await setup();
  const other = await t.run(ctx => ctx.db.insert("participants", {...row("6909680999"), sport:"Swimming"}));
  const candidates = await admin.query(api.participants.removalCandidates, {sport:"Volleyball"});
  expect(candidates.map(p => p.id).sort()).toEqual([ids.keep,ids.remove].sort());
  await expect(admin.mutation(api.participants.keepOnlySelected, {sport:"Volleyball", keepIds:[other], reviewedIds:[ids.keep,ids.remove], confirmation:"REMOVE OTHERS"})).rejects.toThrow("list changed");
  await admin.mutation(api.participants.keepOnlySelected, {sport:"Volleyball", keepIds:[ids.keep], reviewedIds:[ids.keep,ids.remove], confirmation:"REMOVE OTHERS"});
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await t.run(ctx => ctx.db.get("participants",other))).not.toBeNull();
  expect(await t.run(ctx => ctx.db.get("participants",ids.remove))).toBeNull();
});

test("participants moved to a different sport after confirmation are not deleted", async () => {
  vi.useFakeTimers();
  const {t, ids, admin} = await setup();
  await admin.mutation(api.participants.keepOnlySelected, {sport:"Volleyball", keepIds:[ids.keep], reviewedIds:[ids.keep,ids.remove], confirmation:"REMOVE OTHERS"});
  await t.run(ctx => ctx.db.patch("participants", ids.remove, {sport:"Swimming"}));
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await t.run(ctx => ctx.db.get("participants",ids.remove))).toMatchObject({sport:"Swimming"});
  expect(await admin.query(api.participants.latestRemoval, {})).toMatchObject({status:"complete",skippedCount:1,sport:"Volleyball"});
});
