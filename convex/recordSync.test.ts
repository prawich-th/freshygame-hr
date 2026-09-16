/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");
const signature = [[{x:10,y:10},{x:90,y:50}]];
async function setup() {
  const t = convexTest(schema, modules);
  const user = await t.run(ctx => ctx.db.insert("users",{role:"admin",active:true}));
  const staff = t.withIdentity({subject:`${user}|session`});
  const data = await t.run(async ctx => {
    const file = await ctx.storage.store(new Blob(["image"]));
    const base = {studentId:"6909680001",fullNameThai:"ทดสอบ",fullNameEnglish:"Test",faculty:"Medicine",sport:"Swimming",status:"incomplete" as const,source:"import" as const,updatedAt:1};
    const cert = {signature,signedName:"ทดสอบ",signedAt:123};
    const documents = {profilePhotoId:file,nationalIdImageId:file,studentIdImageId:file};
    const source = await ctx.db.insert("participants",{...base,...cert,...documents});
    const target = await ctx.db.insert("participants",{...base,sport:"Basketball"});
    const other = await ctx.db.insert("participants",{...base,studentId:"6909680002"});
    return {source,target,other,cert,documents};
  });
  return {t,staff,...data};
}
test("sync fills missing shared files and original certification, stays within student, and is idempotent",async () => {
  const {t,staff,target,other,cert,documents} = await setup();
  expect(await staff.mutation(api.recordSync.batch,{cursor:null})).toMatchObject({updated:1,done:true,conflicts:[]});
  expect(await t.run(ctx=>ctx.db.get("participants",target))).toMatchObject({...cert,...documents,status:"pending"});
  expect((await t.run(ctx=>ctx.db.get("participants",other)))?.signature).toBeUndefined();
  expect(await staff.mutation(api.recordSync.batch,{cursor:null})).toMatchObject({updated:0});
});
test("sync skips conflicting documents, signatures, and requested corrections",async () => {
  for (const kind of ["file","signature","correction"] as const) {
    const {t,staff,target} = await setup();
    await t.run(async ctx => {
      if(kind === "file") await ctx.db.patch("participants",target,{profilePhotoId:await ctx.storage.store(new Blob(["other"]))});
      if(kind === "signature") await ctx.db.patch("participants",target,{signature:[[{x:1,y:1},{x:99,y:90}]],signedName:"Test",signedAt:456});
      if(kind === "correction") await ctx.db.patch("participants",target,{correctionRequests:[{field:"signature",note:"Sign again",status:"requested"}]});
    });
    expect(await staff.mutation(api.recordSync.batch,{cursor:null})).toMatchObject({updated:0,conflicts:["6909680001"]});
    expect((await t.run(ctx=>ctx.db.get("participants",target)))?.studentIdImageId).toBeUndefined();
  }
});
test("sync requires editor access",async () => {
  const {t} = await setup();
  await expect(t.mutation(api.recordSync.batch,{cursor:null})).rejects.toThrow("Authentication");
  for(const role of ["viewer","co-sport"] as const) {
    const id = await t.run(ctx=>ctx.db.insert("users",{role,active:true}));
    await expect(t.withIdentity({subject:`${id}|session`}).mutation(api.recordSync.batch,{cursor:null})).rejects.toThrow("Read-only");
  }
});
