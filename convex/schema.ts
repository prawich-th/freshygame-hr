import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(
  v.literal("admin"),
  v.literal("registrar"),
  v.literal("viewer"),
  v.literal("co-sport"),
);

const status = v.union(
  v.literal("incomplete"),
  v.literal("pending"),
  v.literal("verified"),
  v.literal("rejected"),
);

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(role),
    active: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_role", ["role"]),

  authSessions: defineTable({
    userId: v.id("users"),
    expirationTime: v.number(),
  }).index("userId", ["userId"]),
  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("userIdAndProvider", ["userId", "provider"])
    .index("providerAndAccountId", ["provider", "providerAccountId"]),
  authRefreshTokens: defineTable({
    sessionId: v.id("authSessions"),
    expirationTime: v.number(),
    firstUsedTime: v.optional(v.number()),
    parentRefreshTokenId: v.optional(v.id("authRefreshTokens")),
  })
    .index("sessionId", ["sessionId"])
    .index("sessionIdAndParentRefreshTokenId", [
      "sessionId",
      "parentRefreshTokenId",
    ]),
  authVerificationCodes: defineTable({
    accountId: v.id("authAccounts"),
    provider: v.string(),
    code: v.string(),
    expirationTime: v.number(),
    verifier: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("accountId", ["accountId"])
    .index("code", ["code"]),
  authVerifiers: defineTable({
    sessionId: v.optional(v.id("authSessions")),
    signature: v.string(),
  }).index("signature", ["signature"]),
  authRateLimits: defineTable({
    identifier: v.string(),
    periodStart: v.number(),
    attempts: v.number(),
  }).index("identifier", ["identifier"]),

  participantRemovalJobs: defineTable({
    sport: v.optional(v.string()),
    skippedCount: v.optional(v.number()),
    participantIds: v.array(v.id("participants")),
    nextIndex: v.number(),
    removeCount: v.number(),
    keepCount: v.number(),
    status: v.union(v.literal("running"), v.literal("paused"), v.literal("complete")),
    createdBy: v.id("users"),
  }).index("by_status", ["status"]),

  participants: defineTable({
    participantKind: v.optional(
      v.union(v.literal("athlete"), v.literal("performer"), v.literal("support")),
    ),
    performerType: v.optional(
      v.union(
        v.literal("Katakorn"),
        v.literal("Cheerleader"),
        v.literal("Parade"),
      ),
    ),
    email: v.optional(v.string()),
    sportOrder: v.optional(v.string()),
    orderNumber: v.optional(v.number()),
    studentId: v.string(),
    fullNameThai: v.string(),
    fullNameEnglish: v.string(),
    nicknameThai: v.optional(v.string()),
    nicknameEnglish: v.optional(v.string()),
    sex: v.optional(v.string()),
    faculty: v.string(),
    facultyCode: v.optional(v.string()),
    phone: v.optional(v.string()),
    lineId: v.optional(v.string()),
    instagram: v.optional(v.string()),
    preferredContact: v.optional(v.string()),
    qualificationCriteria: v.optional(v.string()),
    pdpaConsent: v.optional(v.string()),
    qualificationDetails: v.optional(v.string()),
    eligibilityCertification: v.optional(v.string()),
    sport: v.string(),
    category: v.optional(v.string()),
    profilePhotoId: v.optional(v.id("_storage")),
    nationalIdImageId: v.optional(v.id("_storage")),
    studentIdImageId: v.optional(v.id("_storage")),
    status,
    source: v.union(v.literal("import"), v.literal("staff"), v.literal("self")),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  })
    .index("by_profilePhotoId", ["profilePhotoId"])
    .index("by_nationalIdImageId", ["nationalIdImageId"])
    .index("by_studentIdImageId", ["studentIdImageId"])
    .index("by_studentId", ["studentId"])
    .index("by_orderNumber", ["orderNumber"])
    .index("by_status", ["status"])
    .index("by_sport", ["sport"])
    .searchIndex("search_studentId", { searchField: "studentId" })
    .searchIndex("search_fullNameThai", { searchField: "fullNameThai" })
    .searchIndex("search_fullNameEnglish", { searchField: "fullNameEnglish" })
    .searchIndex("search_nicknameThai", { searchField: "nicknameThai" })
    .searchIndex("search_nicknameEnglish", { searchField: "nicknameEnglish" })
    .searchIndex("search_email", { searchField: "email" })
    .searchIndex("search_phone", { searchField: "phone" })
    .searchIndex("search_faculty", { searchField: "faculty" })
    .searchIndex("search_sport", { searchField: "sport" }),

  auditEvents: defineTable({
    action: v.string(),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    participantId: v.optional(v.id("participants")),
    staffUserId: v.optional(v.id("users")),
    successful: v.optional(v.boolean()),
    attempts: v.number(),
    createdAt: v.number(),
  })
    .index("by_participantId", ["participantId"])
    .index("by_staffUserId", ["staffUserId"]),

  uploadSessions: defineTable({
    participantId: v.id("participants"),
    auditEventId: v.id("auditEvents"),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_participantId", ["participantId"]),
});
