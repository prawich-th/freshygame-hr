/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
const modules = import.meta.glob("./**/*.ts");

async function setup(role: "co-sport" | "admin" | "registrar" | "viewer" = "co-sport", active = true) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { role, active, name: "Staff" });
    const participantId = await ctx.db.insert("participants", {
      studentId: "1234567890", fullNameEnglish: "Alice Example", fullNameThai: "อลิซ",
      nicknameThai: "ซันนี่", nicknameEnglish: "Sunny", faculty: "Medicine", sport: "Basketball", phone: "0812345678",
      email: "alice@example.com", lineId: "alice-line", instagram: "alice-ig",
      qualificationDetails: "PRIVATE", pdpaConsent: "PRIVATE", eligibilityCertification: "PRIVATE",
      status: "pending", source: "staff", updatedAt: 1,
    });
    return { userId, participantId };
  });
  return { t, staff: t.withIdentity({ subject: ids.userId }), ...ids };
}

test("Co-sport searches allowlisted contact details without sensitive fields", async () => {
  const { staff } = await setup();
  for (const term of ["Alice", "Sunny", "0812345678", "Medicine", "Basketball", "อลิซ"]) {
    const result = await staff.query(api.directory.search, { term });
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]).toMatchObject({ email: "alice@example.com", lineId: "alice-line" });
    expect(Object.keys(result.contacts[0]).sort()).toEqual(["_id", "fullNameThai", "fullNameEnglish", "nicknameThai", "nicknameEnglish", "faculty", "sport", "category", "participantKind", "phone", "email", "lineId", "instagram", "preferredContact"].sort());
  }
  expect(await staff.query(api.directory.search, { term: " " })).toEqual({ contacts: [], hasMore: false });
  expect((await staff.query(api.directory.search, { term: "PRIVATE" })).contacts).toEqual([]);
});

test("Co-sport cannot read records, export, upload, edit, administer, or bootstrap", async () => {
  const { staff, participantId, userId } = await setup();
  await expect(staff.query(api.participants.get, { participantId })).rejects.toThrow("Contact directory access only");
  await expect(staff.query(api.participants.list, { paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow();
  await expect(staff.query(api.participants.exportSport, { sport: "Basketball" })).rejects.toThrow();
  await expect(staff.query(api.participants.exportSelected, { participantIds: [participantId] })).rejects.toThrow();
  await expect(staff.query(api.participants.boothSearch, { search: "Alice" })).rejects.toThrow("Read-only access");
  await expect(staff.mutation(api.participants.generateStaffUploadUrl, {})).rejects.toThrow("Read-only access");
  await expect(staff.mutation(api.participants.updateStatus, { participantId, status: "verified" })).rejects.toThrow("Read-only access");
  await expect(staff.mutation(api.participants.updateStaffRole, { userId, role: "admin", active: true })).rejects.toThrow();
  await expect(staff.mutation(api.participants.bootstrapAdmin, {})).rejects.toThrow();
});

test("directory requires an active staff session", async () => {
  const { t, staff } = await setup("co-sport", false);
  await expect(t.query(api.directory.search, { term: "Alice" })).rejects.toThrow();
  await expect(staff.query(api.directory.search, { term: "Alice" })).rejects.toThrow();
});

test("existing staff roles can use directory and admins can assign Co-sport", async () => {
  for (const role of ["admin", "registrar", "viewer"] as const) {
    const { staff, t } = await setup(role);
    expect((await staff.query(api.directory.search, { term: "Alice" })).contacts).toHaveLength(1);
    if (role === "admin") {
      const userId = await t.run(ctx => ctx.db.insert("users", { role: "viewer", active: true }));
      await staff.mutation(api.participants.updateStaffRole, { userId, role: "co-sport", active: true });
      expect((await t.run(ctx => ctx.db.get("users", userId)))?.role).toBe("co-sport");
    }
  }
});
