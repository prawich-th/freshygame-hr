import { correctionValidator } from "./correctionValidators";
import { CORRECTION_FIELDS, activeCorrections, isDocumentField } from "../shared/corrections";
import { PARADE_TYPES, participantKind } from "../shared/participantKinds";
import { signatureValidator, certifySignature } from "./signatures";
import { normalizeInformation } from "./participantInformation";
import { ConvexError, v } from "convex/values";
import { existingDocuments, linkDocuments, registrationsForStudent } from "./participantDocuments";
import { mutation } from "./_generated/server";

const informationFields = { nationalIdNumber: v.optional(v.string()), birthDate: v.optional(v.string()), guardianPhone: v.optional(v.string()), emergencyContactName: v.optional(v.string()), emergencyContactRelationship: v.optional(v.string()), drugAllergies: v.optional(v.string()), foodAllergies: v.optional(v.string()), hospitalizationHistory: v.optional(v.string()),  jerseyNumber: v.optional(v.string()), allergies: v.optional(v.string()), medicalConditions: v.optional(v.string()) };

const profileInput = v.object({
  ...informationFields,
  fullNameThai: v.string(), fullNameEnglish: v.string(), faculty: v.string(),
  nicknameThai: v.optional(v.string()), nicknameEnglish: v.optional(v.string()),
  sex: v.optional(v.string()), email: v.optional(v.string()),
  lineId: v.optional(v.string()), instagram: v.optional(v.string()), preferredContact: v.optional(v.string()),
});

function normalizePhone(value: string) {
  let phone = value.replace(/\D/g, "");
  if (phone.startsWith("66")) {
    const localNumber = phone.slice(2);
    phone = localNumber.startsWith("0") ? localNumber : `0${localNumber}`;
  } else if (phone.length === 9 && !phone.startsWith("0")) {
    phone = `0${phone}`;
  }
  return /^0\d{9}$/.test(phone) ? phone : null;
}

export const recordVisit = mutation({
  args: {
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    purpose: v.optional(
      v.union(v.literal("document_upload"), v.literal("performer_registration")),
    ),
  },
  returns: v.id("auditEvents"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditEvents", {
      action: args.purpose === "performer_registration"
        ? "performer_registration_visit"
        : "self_upload_visit",
      ipAddress: args.ipAddress.slice(0, 128),
      userAgent: args.userAgent?.slice(0, 512),
      attempts: 0,
      createdAt: Date.now(),
    });
  },
});

export const registerPerformer = mutation({
  args: {
    auditEventId: v.id("auditEvents"),
    performerType: v.union(v.literal("Katakorn"), v.literal("Cheerleader"), v.literal("Parade")),
    category: v.optional(v.string()),
    studentId: v.string(),
    fullNameThai: v.string(),
    fullNameEnglish: v.string(),
    nicknameThai: v.optional(v.string()),
    nicknameEnglish: v.optional(v.string()),
    sex: v.union(
      v.literal("Male"),
      v.literal("Female"),
      v.literal("Non-binary"),
      v.literal("Prefer not to say"),
    ),
    faculty: v.union(
      v.literal("คณะแพทยศาสตร์"),
      v.literal("คณะศิลปศาสตร์"),
      v.literal("วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์"),
    ),
    phone: v.string(),
    email: v.string(),
    lineId: v.optional(v.string()),
    instagram: v.optional(v.string()),
    preferredContact: v.union(
      v.literal("Phone"),
      v.literal("LINE"),
      v.literal("Instagram"),
      v.literal("Email"),
    ),
    ...informationFields,
    pdpaConsent: v.literal(true),
  },
  returns: v.object({
    sessionId: v.id("uploadSessions"),
    name: v.string(),
    profilePhotoUrl: v.union(v.string(), v.null()),
    performerType: v.union(v.literal("Katakorn"), v.literal("Cheerleader"), v.literal("Parade")),
  }),
  handler: async (ctx, args) => {
    const audit = await ctx.db.get("auditEvents", args.auditEventId);
    if (!audit || Date.now() - audit.createdAt > 30 * 60 * 1000) {
      throw new ConvexError("Registration session expired. Please refresh and try again");
    }
    if (audit.action !== "performer_registration_visit" || audit.successful) {
      throw new ConvexError("This registration session cannot be used");
    }

    const studentId = args.studentId.trim();
    const fullNameThai = args.fullNameThai.trim();
    const fullNameEnglish = args.fullNameEnglish.trim();
    const faculty = args.faculty.trim();
    const phone = normalizePhone(args.phone);
    const email = args.email.trim().toLowerCase();
    if (!/^\d{10}$/.test(studentId)) throw new ConvexError("Student ID must contain exactly 10 digits");
    if (!fullNameThai || !fullNameEnglish || !faculty) throw new ConvexError("Please complete all required personal information");
    if (!phone) throw new ConvexError("Please enter a valid 10-digit Thai phone number");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError("Please enter a valid email address");

    if (args.performerType === "Parade" && !PARADE_TYPES.some(type => type === args.category)) throw new ConvexError("Choose a valid parade member type");
    const registrations = await registrationsForStudent(ctx, studentId);
    if (registrations.length && !registrations.some(row => normalizePhone(row.phone ?? "") === phone)) {
      throw new ConvexError("The information does not match our registration record. Please contact staff");
    }
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_studentId_and_sport", (q) => q.eq("studentId", studentId).eq("sport", args.performerType))
      .unique();
    const registrationData = {
      ...normalizeInformation(args, true, false),
      participantKind: "performer",
      performerType: args.performerType,
      fullNameThai,
      fullNameEnglish,
      nicknameThai: args.nicknameThai?.trim() || undefined,
      nicknameEnglish: args.nicknameEnglish?.trim() || undefined,
      sex: args.sex.trim(),
      faculty,
      phone,
      email,
      lineId: args.lineId?.trim() || undefined,
      instagram: args.instagram?.trim().replace(/^@/, "") || undefined,
      preferredContact: args.preferredContact.trim(),
      pdpaConsent: "consented",
      sport: args.performerType,
      category: args.performerType === "Parade" ? args.category : "Performer",
      status: "incomplete",
      source: "self",
      updatedAt: Date.now(),
    } as const;

    let participantId;
    if (existing) {
      const isResumable = existing.participantKind === "performer" &&
        existing.status === "incomplete" &&
        normalizePhone(existing.phone ?? "") === phone;
      if (!isResumable) {
        throw new ConvexError("This Student ID is already registered. Please contact staff if you need to update your record");
      }
      await ctx.db.patch("participants", existing._id, registrationData);
      participantId = existing._id;
    } else {
      const lastOrderedParticipant = await ctx.db
        .query("participants")
        .withIndex("by_orderNumber")
        .order("desc")
        .first();
      participantId = await ctx.db.insert("participants", {
        ...registrationData,
        ...await existingDocuments(ctx, studentId),
        studentId,
        orderNumber: (lastOrderedParticipant?.orderNumber ?? 0) + 1,
      });
    }
    await ctx.db.patch("auditEvents", audit._id, {
      action: "performer_registration_started",
      participantId,
      attempts: audit.attempts + 1,
      successful: true,
    });
    const sessionId = await ctx.db.insert("uploadSessions", {
      participantId,
      studentId,
      auditEventId: audit._id,
      expiresAt: Date.now() + 30 * 60 * 1000,
      used: false,
    });
    const documents = await existingDocuments(ctx, studentId);
    const profilePhotoUrl = documents.profilePhotoId ? await ctx.storage.getUrl(documents.profilePhotoId) : null;
    return { sessionId, name: fullNameThai, performerType: args.performerType, profilePhotoUrl };
  },
});

export const verifyIdentity = mutation({
  args: {
    sport: v.optional(v.string()),
    studentId: v.string(),
    phone: v.string(),
    auditEventId: v.id("auditEvents"),
  },
  returns: v.object({ sessionId: v.id("uploadSessions"), name: v.string(), sport: v.string(), faculty: v.string(), phone: v.string(), requiresJersey: v.boolean(), profilePhotoUrl: v.union(v.string(), v.null()), documentUrls: v.object({ profile: v.union(v.string(), v.null()), nationalId: v.union(v.string(), v.null()), studentId: v.union(v.string(), v.null()) }), correctionRequests: v.array(correctionValidator), profile: profileInput }),
  handler: async (ctx, args) => {
    const audit = await ctx.db.get("auditEvents", args.auditEventId);
    if (!audit || Date.now() - audit.createdAt > 30 * 60 * 1000) throw new ConvexError("Verification session expired");
    if (audit.attempts >= 5) throw new ConvexError("Too many attempts. Please contact staff");
    await ctx.db.patch("auditEvents", audit._id, { attempts: audit.attempts + 1 });

    const studentId = args.studentId.trim();
    if (!/^\d{10}$/.test(studentId)) {
      throw new ConvexError("Student ID must contain exactly 10 digits");
    }
    const registrations = await registrationsForStudent(ctx, studentId);
    const submittedPhone = normalizePhone(args.phone);
    const participant = submittedPhone === null ? undefined : registrations.find(row => normalizePhone(row.phone ?? "") === submittedPhone);
    if (!participant) {
      throw new ConvexError("The information does not match our registration record");
    }
    await ctx.db.patch("auditEvents", audit._id, { participantId: participant._id, successful: true });
    const sessionId = await ctx.db.insert("uploadSessions", {
      participantId: participant._id,
      studentId,
      auditEventId: audit._id,
      expiresAt: Date.now() + 15 * 60 * 1000,
      used: false,
    });
    const documents = await existingDocuments(ctx, studentId);
    const profilePhotoUrl = documents.profilePhotoId ? await ctx.storage.getUrl(documents.profilePhotoId) : null;
    const documentUrls = {
      profile: profilePhotoUrl,
      nationalId: documents.nationalIdImageId ? await ctx.storage.getUrl(documents.nationalIdImageId) : null,
      studentId: documents.studentIdImageId ? await ctx.storage.getUrl(documents.studentIdImageId) : null,
    };
    const correctionRequests = registrations.flatMap(row => activeCorrections(row.correctionRequests));
    return { sessionId, profilePhotoUrl, documentUrls, correctionRequests, requiresJersey: registrations.some(row => participantKind(row) !== "performer"), name: participant.fullNameThai, sport: [...new Set(registrations.map(row => row.sport))].join(", "), faculty: participant.faculty, phone: participant.phone ?? "", profile: {
      fullNameThai: participant.fullNameThai, fullNameEnglish: participant.fullNameEnglish, faculty: participant.faculty,
      nicknameThai: participant.nicknameThai, nicknameEnglish: participant.nicknameEnglish, sex: participant.sex,
      nationalIdNumber: participant.nationalIdNumber, birthDate: participant.birthDate, guardianPhone: participant.guardianPhone, emergencyContactName: participant.emergencyContactName, emergencyContactRelationship: participant.emergencyContactRelationship, drugAllergies: participant.drugAllergies, foodAllergies: participant.foodAllergies, hospitalizationHistory: participant.hospitalizationHistory,
      jerseyNumber: participant.jerseyNumber, allergies: participant.allergies, medicalConditions: participant.medicalConditions,
      email: participant.email, lineId: participant.lineId, instagram: participant.instagram, preferredContact: participant.preferredContact,
    } };
  },
});

export const generateUploadUrl = mutation({
  args: { sessionId: v.id("uploadSessions") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("uploadSessions", args.sessionId);
    if (!session || session.used || session.expiresAt < Date.now()) throw new ConvexError("Upload session expired");
    return await ctx.storage.generateUploadUrl();
  },
});

export const completeUpload = mutation({
  args: { signature: v.optional(signatureValidator), profile: v.optional(profileInput), confirmed: v.optional(v.literal(true)), sessionId: v.id("uploadSessions"), profilePhotoId: v.optional(v.id("_storage")), nationalIdImageId: v.optional(v.id("_storage")), studentIdImageId: v.optional(v.id("_storage")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get("uploadSessions", args.sessionId);
    if (!session || session.used || session.expiresAt < Date.now()) throw new ConvexError("Upload session expired");
    const participant = await ctx.db.get("participants", session.participantId);
    if (!participant) throw new ConvexError("Participant not found");
    if (session.studentId && session.studentId !== participant.studentId) throw new ConvexError("Registration changed. Please verify your identity again");
    const audit = await ctx.db.get("auditEvents", session.auditEventId);
    if (audit?.action !== "performer_registration_started" && !args.confirmed) {
      throw new ConvexError("Please complete and confirm your information before submitting");
    }
    const registrations = await registrationsForStudent(ctx, participant.studentId);
    const previousDocuments = await existingDocuments(ctx, participant.studentId);
    const uploaded = {
      ...(args.profilePhotoId ? { profilePhotoId: args.profilePhotoId } : {}),
      ...(args.nationalIdImageId ? { nationalIdImageId: args.nationalIdImageId } : {}),
      ...(args.studentIdImageId ? { studentIdImageId: args.studentIdImageId } : {}),
    };
    const documents = { ...previousDocuments, ...uploaded };
    for (const id of [documents.profilePhotoId, documents.nationalIdImageId, documents.studentIdImageId]) {
      if (!id || !await ctx.db.system.get("_storage", id)) throw new ConvexError("Please upload all three images");
    }
    const sourceProfile = args.profile ?? participant;
    if (!sourceProfile.fullNameThai.trim() || !sourceProfile.fullNameEnglish.trim()) throw new ConvexError("Thai and English names are required");
    const profile = {
      ...Object.fromEntries(Object.keys(profileInput.fields).map(key => [key, sourceProfile[key as keyof typeof sourceProfile]])),
      fullNameThai: sourceProfile.fullNameThai.trim(),
      fullNameEnglish: sourceProfile.fullNameEnglish.trim(),
      faculty: sourceProfile.faculty.trim(),
      email: sourceProfile.email?.trim().toLowerCase() || undefined,
      ...normalizeInformation(sourceProfile, true, registrations.some(row => participantKind(row) !== "performer")),
      ...certifySignature(args.signature, sourceProfile.fullNameThai.trim()),
    };
    if (!profile.fullNameThai || !profile.fullNameEnglish) throw new ConvexError("Thai and English names are required");
    if (!["คณะแพทยศาสตร์", "คณะศิลปศาสตร์", "วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์"].includes(profile.faculty)) throw new ConvexError("Choose a supported faculty");
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new ConvexError("Please enter a valid email address");
    for (const row of registrations) {
      for (const request of activeCorrections(row.correctionRequests)) {
        const field = request.field;
        const changed = isDocumentField(field)
          ? uploaded[field as keyof typeof uploaded] && uploaded[field as keyof typeof uploaded] !== row[field as keyof typeof uploaded]
          : String(profile[field as keyof typeof profile] ?? "").trim() !== String(row[field as keyof typeof row] ?? "").trim();
        if (!changed) throw new ConvexError(`Please correct ${CORRECTION_FIELDS[field]} before submitting`);
      }
    }
    for (const row of registrations) {
      const { jerseyNumber, ...personalProfile } = profile;
      await ctx.db.patch("participants", row._id, participantKind(row) === "performer" ? personalProfile : { ...personalProfile, jerseyNumber });
    }
    await linkDocuments(ctx, participant, uploaded);
    for (const row of registrations) {
      if (activeCorrections(row.correctionRequests).length) {
        await ctx.db.patch("participants", row._id, {
          correctionRequests: row.correctionRequests!.map(request => ({ ...request, status: "submitted" as const })),
          status: "pending",
        });
      }
    }
    await ctx.db.patch("uploadSessions", session._id, { used: true });
    await ctx.db.patch("auditEvents", session.auditEventId, {
      action: participant.participantKind === "performer"
        ? "performer_registration_completed"
        : "self_upload_completed",
      successful: true,
    });
    return null;
  },
});
