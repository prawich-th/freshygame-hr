/// <reference types="vite/client" />
import { expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const participant = {studentId:"6909680001", fullNameThai:"ทดสอบ", fullNameEnglish:"Test", faculty:"คณะแพทยศาสตร์", sport:"Volleyball", category:"Team", phone:"0812345678"};
async function setup() {
  const t = convexTest(schema, modules);
  const id = await t.run(ctx => ctx.db.insert("users", {role:"admin", active:true}));
  return {t, staff:t.withIdentity({subject:`${id}|session`})};
}
test("imports preserve multiple sports and reimports update only the matching registration", async () => {
  const {t, staff} = await setup();
  expect(await staff.mutation(api.participants.importBatch, {participants:[participant, {...participant,sport:"BB"}]})).toEqual({created:2,updated:0});
  const rows = await t.run(ctx => ctx.db.query("participants").collect());
  const volleyball = rows.find(p => p.sport === "Volleyball")!;
  await staff.mutation(api.participants.updateStatus,{participantId:volleyball._id,status:"verified"});
  expect(await staff.mutation(api.participants.importBatch,{participants:[{...participant,sport:"VB",fullNameEnglish:"Updated"}]})).toEqual({created:0,updated:1});
  expect(await t.run(ctx => ctx.db.get("participants",volleyball._id))).toMatchObject({status:"verified",fullNameEnglish:"Updated"});
  expect(await t.run(ctx => ctx.db.get("participants",rows.find(p => p.sport === "Basketball")!._id))).toMatchObject({fullNameEnglish:"Test"});
});
test("staff can add another sport but cannot create or edit into a duplicate", async () => {
  const {staff} = await setup();
  await staff.mutation(api.participants.createParticipant,{participant});
  const basketball = await staff.mutation(api.participants.createParticipant,{participant:{...participant,sport:"Basketball"}});
  await expect(staff.mutation(api.participants.createParticipant,{participant:{...participant,sport:"VB"}})).rejects.toThrow("already registered");
  await expect(staff.mutation(api.participants.updateParticipant,{...participant,faculty:"คณะแพทยศาสตร์",participantKind:"athlete",participantId:basketball})).rejects.toThrow("already registered");
});
test("self upload verifies once and lists all sports", async () => {
  const {t,staff} = await setup();
  await staff.mutation(api.participants.importBatch,{participants:[participant,{...participant,sport:"Basketball",phone:"0899999999"}]});
  const auditEventId = await t.mutation(api.publicIntake.recordVisit,{ipAddress:"test"});
  const args = {auditEventId,studentId:participant.studentId,phone:participant.phone};
  await expect(t.mutation(api.publicIntake.verifyIdentity,{...args,phone:"0800000000"})).rejects.toThrow("does not match");
  const verified = await t.mutation(api.publicIntake.verifyIdentity,{...args,sport:"VB"});
  expect(verified.sport).toBe("Volleyball, Basketball");
  const session = await t.run(ctx => ctx.db.get("uploadSessions",verified.sessionId));
  expect(await t.run(ctx => ctx.db.get("participants",session!.participantId))).toMatchObject({sport:"Volleyball"});
});

async function uploadFiles(t: ReturnType<typeof convexTest>) {
  return t.run(async ctx => ({
    profilePhotoId: await ctx.storage.store(new Blob(["photo"])),
    nationalIdImageId: await ctx.storage.store(new Blob(["national"])),
    studentIdImageId: await ctx.storage.store(new Blob(["student"])),
  }));
}
test("one self upload links all sports, preserves decisions, and new sports inherit files", async () => {
  const {t,staff} = await setup();
  const first = await staff.mutation(api.participants.createParticipant,{participant});
  const second = await staff.mutation(api.participants.createParticipant,{participant:{...participant,sport:"Basketball"}});
  const other = await staff.mutation(api.participants.createParticipant,{participant:{...participant,studentId:"6909680002"}});
  await staff.mutation(api.participants.updateStatus,{participantId:second,status:"rejected"});
  const auditEventId = await t.mutation(api.publicIntake.recordVisit,{ipAddress:"test"});
  const {sessionId} = await t.mutation(api.publicIntake.verifyIdentity,{auditEventId,studentId:participant.studentId,phone:participant.phone});
  const files = await uploadFiles(t);
  await t.mutation(api.publicIntake.completeUpload,{sessionId,...files,confirmed:true,profile:{fullNameThai:participant.fullNameThai,fullNameEnglish:participant.fullNameEnglish,faculty:participant.faculty}});
  expect(await t.run(ctx => ctx.db.get("participants",first))).toMatchObject({...files,status:"pending"});
  expect(await t.run(ctx => ctx.db.get("participants",second))).toMatchObject({...files,status:"rejected"});
  expect((await t.run(ctx => ctx.db.get("participants",other)))?.nationalIdImageId).toBeUndefined();
  await expect(t.mutation(api.publicIntake.completeUpload,{sessionId,...files})).rejects.toThrow("expired");
  const third = await staff.mutation(api.participants.createParticipant,{participant:{...participant,sport:"Football"}});
  expect(await t.run(ctx => ctx.db.get("participants",third))).toMatchObject({...files,status:"pending"});
  await staff.mutation(api.participants.importBatch,{participants:[{...participant,sport:"Swimming"}]});
  const imported = await t.run(ctx => ctx.db.query("participants").withIndex("by_studentId_and_sport",q=>q.eq("studentId",participant.studentId).eq("sport","Swimming")).unique());
  expect(imported).toMatchObject(files);
});
test("staff partial uploads share files and removal preserves a person's other sport and files", async () => {
  vi.useFakeTimers();
  try {
    const {t,staff} = await setup();
    const first = await staff.mutation(api.participants.createParticipant,{participant});
    const second = await staff.mutation(api.participants.createParticipant,{participant:{...participant,sport:"Basketball"}});
    const keeper = await staff.mutation(api.participants.createParticipant,{participant:{...participant,studentId:"6909680002"}});
    const files = await uploadFiles(t);
    await staff.mutation(api.participants.completeStaffUpload,{participantId:first,...files,uploadedFromBooth:true});
    expect(await t.run(ctx=>ctx.db.get("participants",first))).toMatchObject({...files,status:"verified"});
    expect(await t.run(ctx=>ctx.db.get("participants",second))).toMatchObject({...files,status:"pending"});
    const replacement = await uploadFiles(t);
    await staff.mutation(api.participants.completeStaffUpload,{participantId:second,profilePhotoId:replacement.profilePhotoId});
    expect(await t.run(ctx=>ctx.db.get("participants",first))).toMatchObject({...files,profilePhotoId:replacement.profilePhotoId,status:"verified"});
    await staff.mutation(api.participants.keepOnlySelected,{sport:"Volleyball",keepIds:[keeper],reviewedIds:[first,keeper],confirmation:"REMOVE OTHERS"});
    await t.finishAllScheduledFunctions(()=>vi.runAllTimers());
    expect(await t.run(ctx=>ctx.db.get("participants",first))).toBeNull();
    expect(await t.run(ctx=>ctx.db.get("participants",second))).toMatchObject({nationalIdImageId:files.nationalIdImageId});
    await t.run(async ctx => { expect(await ctx.storage.get(files.nationalIdImageId)).not.toBeNull(); });
  } finally { vi.useRealTimers(); }
});
test("self upload cannot follow a registration reassigned to another Student ID", async () => {
  const {t,staff} = await setup();
  const id = await staff.mutation(api.participants.createParticipant,{participant});
  const auditEventId = await t.mutation(api.publicIntake.recordVisit,{ipAddress:"test"});
  const {sessionId} = await t.mutation(api.publicIntake.verifyIdentity,{auditEventId,studentId:participant.studentId,phone:participant.phone});
  await staff.mutation(api.participants.updateParticipant,{...participant,participantId:id,participantKind:"athlete",faculty:"คณะแพทยศาสตร์",studentId:"6909680002"});
  await expect(t.mutation(api.publicIntake.completeUpload,{sessionId,...await uploadFiles(t)})).rejects.toThrow("Registration changed");
});
test("public performer registration cannot use a new phone to gain shared upload access", async () => {
  const {t,staff} = await setup();
  await staff.mutation(api.participants.createParticipant,{participant});
  const auditEventId = await t.mutation(api.publicIntake.recordVisit,{ipAddress:"test",purpose:"performer_registration"});
  await expect(t.mutation(api.publicIntake.registerPerformer,{
    auditEventId,performerType:"Cheerleader",studentId:participant.studentId,
    fullNameThai:participant.fullNameThai,fullNameEnglish:participant.fullNameEnglish,
    faculty:"คณะแพทยศาสตร์",sex:"Male",phone:"0899999999",email:"test@example.com",preferredContact:"Phone",pdpaConsent:true,
  })).rejects.toThrow("does not match");
});


test("admin draft profiles require an identity phone and athletes must complete and confirm them", async () => {
  const {t, staff} = await setup();
  const draft = {...participant, fullNameThai:"", fullNameEnglish:"", faculty:""};
  await expect(staff.mutation(api.participants.createParticipant, {participant:draft})).rejects.toThrow("names are required");
  await expect(staff.mutation(api.participants.createParticipant, {participant:{...draft, phone:undefined}, incomplete:true})).rejects.toThrow("registered phone");
  const registrarId = await t.run(ctx => ctx.db.insert("users", {role:"registrar", active:true}));
  await expect(t.withIdentity({subject:`${registrarId}|session`}).mutation(api.participants.createParticipant, {participant:draft, incomplete:true})).rejects.toThrow();
  const id = await staff.mutation(api.participants.createParticipant, {participant:draft, incomplete:true});
  const other = await staff.mutation(api.participants.createParticipant, {participant:{...draft, sport:"Basketball"}, incomplete:true});
  const files = await uploadFiles(t);
  await staff.mutation(api.participants.completeStaffUpload, {participantId:id,...files});
  expect(await t.run(ctx => ctx.db.get("participants", id))).toMatchObject({status:"incomplete"});
  const auditEventId = await t.mutation(api.publicIntake.recordVisit, {ipAddress:"test"});
  const verified = await t.mutation(api.publicIntake.verifyIdentity, {auditEventId, studentId:participant.studentId, phone:participant.phone});
  expect(verified.profile).toMatchObject({fullNameThai:"", faculty:""});
  const args = {sessionId:verified.sessionId,...files};
  await expect(t.mutation(api.publicIntake.completeUpload,args)).rejects.toThrow("complete and confirm");
  await expect(t.mutation(api.publicIntake.completeUpload,{...args,confirmed:true,profile:verified.profile})).rejects.toThrow("names are required");
  expect(await t.run(ctx => ctx.db.get("uploadSessions",verified.sessionId))).toMatchObject({used:false});
  const profile = {fullNameThai:"ชื่อ ทดสอบ",fullNameEnglish:"Test Athlete",faculty:participant.faculty,email:"athlete@example.com"};
  await t.mutation(api.publicIntake.completeUpload, {...args,profile,confirmed:true});
  for (const participantId of [id,other]) expect(await t.run(ctx => ctx.db.get("participants",participantId))).toMatchObject({...profile,...files,status:"pending"});
});
