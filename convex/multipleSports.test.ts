/// <reference types="vite/client" />
import { expect, test } from "vitest";
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
test("self upload requires a sport for multiple registrations and verifies its phone", async () => {
  const {t,staff} = await setup();
  await staff.mutation(api.participants.importBatch,{participants:[participant,{...participant,sport:"Basketball",phone:"0899999999"}]});
  const auditEventId = await t.mutation(api.publicIntake.recordVisit,{ipAddress:"test"});
  const args = {auditEventId,studentId:participant.studentId,phone:participant.phone};
  await expect(t.mutation(api.publicIntake.verifyIdentity,args)).rejects.toThrow("Choose the sport");
  await expect(t.mutation(api.publicIntake.verifyIdentity,{...args,sport:"Basketball"})).rejects.toThrow("does not match");
  const verified = await t.mutation(api.publicIntake.verifyIdentity,{...args,sport:"VB"});
  expect(verified.sport).toBe("Volleyball");
  const session = await t.run(ctx => ctx.db.get("uploadSessions",verified.sessionId));
  expect(await t.run(ctx => ctx.db.get("participants",session!.participantId))).toMatchObject({sport:"Volleyball"});
});
