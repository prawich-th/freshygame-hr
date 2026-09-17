"use client";

import { DocumentUploadFields, useDocumentFiles } from "./DocumentUploadFields";
import { ProfilePhotoGuide } from "./ProfilePhotoGuide";

import { PARADE_TYPES } from "@/shared/participantKinds";
import { SignaturePad } from "./SignaturePad";
import { isValidSignature, type Signature } from "@/shared/signature";
import { errorMessage, UserFacingError } from "../lib/errors";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, type InputHTMLAttributes, useEffect, useState } from "react";
import { compressImage, type UploadImageKind } from "../lib/compressImage";
import { ParticipantInformationFields } from "./ParticipantInformationFields";
import { UploadLayout, UploadHeading, UploadError } from "./self-upload/UploadLayout";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContext } from "react";

const ExistingProfile = createContext<Record<string, string | undefined>>({});

type PerformerType = "Katakorn" | "Cheerleader" | "Parade";
type Sex = "Male" | "Female" | "Non-binary" | "Prefer not to say";
type PreferredContact = "Phone" | "LINE" | "Instagram" | "Email";
type Faculty = "คณะแพทยศาสตร์" | "คณะศิลปศาสตร์" | "วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์";
type Registration = {
  sessionId: Id<"uploadSessions">;
  profilePhotoUrl: string | null;
  name: string;
  performerType: PerformerType;
};

export function PerformerRegistration() {
  const checkStudentId = useMutation(api.publicIntake.checkPerformerStudentId);
  const verifyIdentity = useMutation(api.publicIntake.verifyIdentity);
  const [studentId, setStudentId] = useState("");
  const [recordExists, setRecordExists] = useState(false);
  const [verified, setVerified] = useState<FunctionReturnType<typeof api.publicIntake.verifyIdentity> | null>(null);
  const existingProfile: Record<string, string | undefined> = verified ? { ...verified.profile, phone: verified.phone } : {};
  const registerPerformer = useMutation(api.publicIntake.registerPerformer);
  const generateUploadUrl = useMutation(api.publicIntake.generateUploadUrl);
  const completeUpload = useMutation(api.publicIntake.completeUpload);
  const [signature, setSignature] = useState<Signature>([]);
  const [performerType, setPerformerType] = useState<PerformerType | null>(null);
  const [step, setStep] = useState(1);
  const [auditId, setAuditId] = useState<Id<"auditEvents"> | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const documents = useDocumentFiles(setError);
  const { files } = documents;

  useEffect(() => {
    fetch("/api/client-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "performer_registration" }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not start session");
        const data = await response.json();
        if (!data.auditEventId) throw new Error("Missing session");
        setAuditId(data.auditEventId);
      })
      .catch(() => setError("ไม่สามารถเริ่มเซสชันได้ กรุณาลองอีกครั้ง / Could not start a secure session."));
  }, []);

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auditId) return;
    setBusy(true);
    setError("");
    try {
      if (recordExists) {
        const phone = String(new FormData(event.currentTarget).get("phone") ?? "");
        const result = await verifyIdentity({ auditEventId: auditId, studentId, phone });
        setVerified(result);
        setStep(2);
      } else {
        const result = await checkStudentId({ auditEventId: auditId, studentId });
        setRecordExists(result.exists);
        if (!result.exists) setStep(2);
      }
    } catch (caught) {
      setError(errorMessage(caught, "Check registration"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    for (const [key, value] of Object.entries(existingProfile)) {
      if (value?.trim()) data.set(key, value);
    }
    try {
      if (!auditId) throw new UserFacingError("Secure session is still loading");
      if (data.get("pdpaConsent") !== "yes") throw new UserFacingError("PDPA consent is required to register");
      const result = await registerPerformer({
        auditEventId: auditId,
        verifiedSessionId: verified?.sessionId,
        performerType: String(data.get("performerType")) as PerformerType,
        category: performerType === "Parade" ? String(data.get("category")) : undefined,
        emergencyContactName: String(data.get("emergencyContactName") ?? ""),
        emergencyContactRelationship: String(data.get("emergencyContactRelationship") ?? ""),
        studentId,
        fullNameThai: String(data.get("fullNameThai")),
        fullNameEnglish: String(data.get("fullNameEnglish")),
        nicknameThai: optional(data.get("nicknameThai")),
        nicknameEnglish: optional(data.get("nicknameEnglish")),
        sex: String(data.get("sex")) as Sex,
        faculty: String(data.get("faculty")) as Faculty,
        phone: String(data.get("phone")),
        email: String(data.get("email")),
        lineId: optional(data.get("lineId")),
        instagram: optional(data.get("instagram")),
        preferredContact: String(data.get("preferredContact")) as PreferredContact,
        jerseyNumber: optional(data.get("jerseyNumber")),
        allergies: String(data.get("allergies") ?? ""),
        medicalConditions: String(data.get("medicalConditions") ?? ""),
        nationalIdNumber: String(data.get("nationalIdNumber") ?? ""),
        birthDate: String(data.get("birthDate") ?? ""),
        guardianPhone: String(data.get("guardianPhone") ?? ""),
        drugAllergies: String(data.get("drugAllergies") ?? ""),
        foodAllergies: String(data.get("foodAllergies") ?? ""),
        hospitalizationHistory: String(data.get("hospitalizationHistory") ?? ""),
        pdpaConsent: true,
      });
      setRegistration(result);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(errorMessage(caught, "Register"));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidSignature(signature)) { setError("Please draw your signature before submitting"); return; }
    setError("");
    if (!registration || (["profile", "nationalId", "studentId"] as const).some(kind => !files[kind] && !verified?.documentUrls[kind])) {
      setError("กรุณาอัปโหลดรูปทั้ง 3 รายการ / Please upload all three images");
      return;
    }
    setBusy(true);
    try {
      const uploadImage = async (file: File, kind: UploadImageKind) => {
        const compressed = await compressImage(file, kind);
        const uploadUrl = await generateUploadUrl({ sessionId: registration.sessionId });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": compressed.type },
          body: compressed,
        });
        if (!response.ok) throw new UserFacingError("Image upload failed");
        return (await response.json()).storageId as Id<"_storage">;
      };
      const profilePhotoId = files.profile ? await uploadImage(files.profile, "profile") : undefined;
      const nationalIdImageId = files.nationalId ? await uploadImage(files.nationalId, "nationalId") : undefined;
      const studentIdImageId = files.studentId ? await uploadImage(files.studentId, "studentId") : undefined;
      await completeUpload({
        signature,
        sessionId: registration.sessionId,
        profilePhotoId,
        nationalIdImageId,
        studentIdImageId,
      });
      setStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(errorMessage(caught, "Upload images"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <UploadLayout step={step} registration>
      {step === 1 && <>
        <UploadHeading title="ตรวจสอบรหัสนักศึกษา">เริ่มด้วยรหัสนักศึกษา เพื่อตรวจสอบข้อมูลที่มีอยู่แล้ว<br />Enter your Student ID to check for an existing record.</UploadHeading>
        <form onSubmit={handleLookup} className="upload-form" aria-busy={busy}>
          <fieldset className="upload-section" disabled={busy}>
            <legend>ข้อมูลลงทะเบียน / Registration details</legend>
            <div className="field"><label htmlFor="performer-student-id">รหัสนักศึกษา / Student ID *</label><input id="performer-student-id" className="input" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} value={studentId} readOnly={recordExists} onChange={event => setStudentId(event.target.value)} placeholder="6909680123" /><small>รหัสนักศึกษา 10 หลัก / 10-digit Student ID</small></div>
            {recordExists && <>
              <div className="notice notice--success">พบข้อมูลแล้ว กรุณายืนยันเบอร์โทรเพื่อใช้ข้อมูลเดิม<br />Record found. Verify your registered phone to reuse your details.</div>
              <Field name="phone" label="เบอร์โทรที่ลงทะเบียน / Registered phone" required type="tel" autoComplete="tel" />
            </>}
          </fieldset>
          <UploadError message={error} />
          <div className="upload-actions">
            {recordExists && <button type="button" className="button button--ghost" disabled={busy} onClick={() => { setRecordExists(false); setError(""); }}>เปลี่ยนรหัส / Change ID</button>}
            <button className="button button--primary" disabled={busy || !auditId}>{busy ? "กำลังตรวจสอบ / Checking…" : <>ดำเนินการต่อ / Continue <ArrowRight size={17} /></>}</button>
          </div>
        </form>
      </>}
      {step === 2 && <ExistingProfile.Provider value={existingProfile}>
        <UploadHeading title="ข้อมูลผู้แสดง">{verified ? "ใช้ข้อมูลเดิมของคุณแล้ว กรุณาเลือกทีมและกรอกเฉพาะข้อมูลที่ยังขาด / Your existing details are reused. Choose your team and add only missing information." : "ไม่พบข้อมูลเดิม กรุณาเลือกทีมและกรอกข้อมูลเพื่อลงทะเบียน / No existing record. Choose your team and complete your profile."}</UploadHeading>
        <div className="upload-person"><BadgeCheck size={24} /><div><strong>{verified?.name || "ลงทะเบียนใหม่ / New registration"}</strong><span>{studentId}</span></div></div>
        <form onSubmit={handleRegistration} className="upload-form" aria-busy={busy}>
          <fieldset className="upload-section" disabled={busy}><legend>ทีมและข้อมูลเพิ่มเติม / Team & additional details</legend>

              <div className="performer-choice" role="radiogroup" aria-label="Performer group">
                <label><input type="radio" name="performerType" value="Katakorn" onChange={() => setPerformerType("Katakorn")} required /><span><Sparkles size={20} /><strong>Katakorn</strong><small>คทากร</small></span></label>
                <label><input type="radio" name="performerType" value="Cheerleader" onChange={() => setPerformerType("Cheerleader")} required /><span><Sparkles size={20} /><strong>Cheerleader</strong><small>เชียร์ลีดเดอร์</small></span></label>
                <label><input type="radio" name="performerType" value="Parade" onChange={() => setPerformerType("Parade")} required /><span><Sparkles size={20}/><strong>Parade</strong><small>สมาชิกขบวนพาเหรด</small></span></label>
              </div>
              <div className="form-grid">
                {performerType === "Parade" && <div className="field field--wide"><label htmlFor="parade-type">ประเภทสมาชิกขบวน / Parade member type *</label><select id="parade-type" name="category" className="select" required defaultValue=""><option value="" disabled>เลือกประเภท / Select type</option>{PARADE_TYPES.map(type => <option key={type}>{type}</option>)}</select></div>}
                <ParticipantInformationFields value={verified?.profile} required includeJersey={verified?.requiresJersey ?? false} missingOnly={Boolean(verified)}/>
                {!existingProfile.faculty?.trim() && <div className="field"><label>คณะ / Faculty <span>*</span></label><select className="select registration-select" name="faculty" required defaultValue=""><option value="" disabled>เลือกคณะ / Select faculty</option><option value="คณะแพทยศาสตร์">คณะแพทยศาสตร์</option><option value="คณะศิลปศาสตร์">คณะศิลปศาสตร์</option><option value="วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์">วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์</option></select></div>}
                <Field name="fullNameThai" label="ชื่อ-สกุล (ไทย) / Thai full name" required placeholder="ชื่อ นามสกุล" />
                <Field name="nicknameThai" label="ชื่อเล่น (ไทย) / Thai nickname" placeholder="ชื่อเล่น" />
                <Field name="fullNameEnglish" label="Full name (English)" required placeholder="Name Surname" />
                <Field name="nicknameEnglish" label="Nickname (English)" placeholder="Nickname" />
                {!existingProfile.sex?.trim() && <div className="field"><label>เพศ / Sex <span>*</span></label><select className="select registration-select" name="sex" required defaultValue=""><option value="" disabled>Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option></select></div>}
                <Field name="phone" label="หมายเลขโทรศัพท์ / Phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="081-234-5678" />
                <Field name="email" label="อีเมล / Email" required type="email" autoComplete="email" placeholder="name@dome.tu.ac.th" />
                {!existingProfile.preferredContact?.trim() && <div className="field"><label>ช่องทางติดต่อหลัก / Preferred contact <span>*</span></label><select className="select registration-select" name="preferredContact" required defaultValue=""><option value="" disabled>Select</option><option value="Phone">Phone</option><option value="LINE">LINE</option><option value="Instagram">Instagram</option><option value="Email">Email</option></select></div>}
                <Field name="lineId" label="LINE ID" placeholder="LINE ID" />
                <Field name="instagram" label="Instagram" placeholder="@username" />
              </div>
          </fieldset>
              <label className="consent-check"><input type="checkbox" name="pdpaConsent" value="yes" required /><span>ข้าพเจ้ายินยอมให้จัดเก็บและใช้ข้อมูลส่วนบุคคลเพื่อการลงทะเบียนและดำเนินงาน Freshy Game 2026 ตามวัตถุประสงค์ของโครงการ</span></label>
              {error && <div className="notice notice--error">{error}</div>}
              <div className="upload-actions">{!verified && <button type="button" className="button button--ghost" disabled={busy} onClick={() => { setStep(1); setError(""); }}>เปลี่ยนรหัส / Change ID</button>}<button className="button button--primary" disabled={busy || !auditId}>{busy ? <span className="spinner" /> : <>บันทึกและส่งเอกสาร <ArrowRight size={17} /></>}</button></div>
            </form>
          </ExistingProfile.Provider>}

          {step === 3 && registration && <>
            <UploadHeading title="เอกสารและลายเซ็น">เพิ่มเฉพาะเอกสารที่ยังขาด แล้วลงนามเพื่อส่งใบสมัคร<br />Add missing documents, then sign to submit your registration. Existing images can be reused.</UploadHeading>
            <div className="upload-person"><span className="verified-person__icon"><BadgeCheck size={20} /></span><div><strong>{registration.name}</strong><span>Performer · {registration.performerType}</span></div></div>
            <form onSubmit={handleUpload} className="upload-form">
              <ProfilePhotoGuide />
              <DocumentUploadFields {...documents} existingUrls={verified?.documentUrls} disabled={busy} />
              <SignaturePad disabled={busy} onChange={setSignature}/>
              {error && <div className="notice notice--error">{error}</div>}
              <div className="upload-actions"><button className="button button--primary" disabled={busy || !isValidSignature(signature)}>{busy ? <span className="spinner" /> : <><UploadCloud size={17} /> ส่งใบสมัคร</>}</button></div>
            </form>
          </>}

          {step === 4 && <div className="success-panel"><div className="success-panel__check"><Check size={34} /></div><h2>ลงทะเบียนเรียบร้อยแล้ว</h2><p>Your performer registration and documents are waiting for staff review. You can safely close this page.</p><div className="notice notice--success"><ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />ข้อมูลของคุณถูกส่งอย่างปลอดภัยแล้ว</div><Link href="/" className="button button--ghost button--large" style={{ marginTop: 22 }}>กลับหน้าหลัก</Link></div>}
    </UploadLayout>
  );
}

function Field({ label, required, ...props }: {
  label: string;
  required?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  const existing = useContext(ExistingProfile);
  if (props.name && existing[props.name]?.trim()) return null;
  return <div className="field"><label htmlFor={props.name}>{label} {required && <span>*</span>}</label><input id={props.name} className="input" required={required} {...props} /></div>;
}

function optional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}
