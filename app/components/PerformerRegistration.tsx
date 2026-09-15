"use client";

import { DocumentUploadFields, useDocumentFiles } from "./DocumentUploadFields";
import { ProfilePhotoGuide } from "./ProfilePhotoGuide";

import { PARADE_TYPES } from "@/shared/participantKinds";
import { SignaturePad } from "./SignaturePad";
import type { Signature } from "@/shared/signature";
import { errorMessage, UserFacingError } from "../lib/errors";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
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
import { Brand } from "./Brand";

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
      .then((response) => response.json())
      .then((data) => setAuditId(data.auditEventId))
      .catch(() => setError("ไม่สามารถเริ่มเซสชันได้ กรุณาลองอีกครั้ง / Could not start a secure session."));
  }, []);

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (!auditId) throw new UserFacingError("Secure session is still loading");
      if (data.get("pdpaConsent") !== "yes") throw new UserFacingError("PDPA consent is required to register");
      const result = await registerPerformer({
        auditEventId: auditId,
        performerType: String(data.get("performerType")) as PerformerType,
        category: performerType === "Parade" ? String(data.get("category")) : undefined,
        emergencyContactName: String(data.get("emergencyContactName") ?? ""),
        emergencyContactRelationship: String(data.get("emergencyContactRelationship") ?? ""),
        studentId: String(data.get("studentId")),
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
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(errorMessage(caught, "Register"));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signature.flat().length < 2) { setError("Please draw your signature before submitting"); return; }
    setError("");
    if (!registration || !files.profile || !files.nationalId || !files.studentId) {
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
      const profilePhotoId = await uploadImage(files.profile, "profile");
      const nationalIdImageId = await uploadImage(files.nationalId, "nationalId");
      const studentIdImageId = await uploadImage(files.studentId, "studentId");
      await completeUpload({
        signature,
        sessionId: registration.sessionId,
        profilePhotoId,
        nationalIdImageId,
        studentIdImageId,
      });
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(errorMessage(caught, "Upload images"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="intake-page performer-intake">
      <aside className="intake-aside">
        <Brand />
        <div className="intake-aside__copy">
          <span>PERFORMER REGISTRATION</span>
          <h1>ลงทะเบียน<br />นักแสดง</h1>
          <p>สำหรับ Katakorn, Cheerleader และสมาชิกขบวนพาเหรด กรอกข้อมูลของคุณด้วยตนเอง แล้วส่งเอกสารยืนยันให้ครบภายในครั้งเดียว</p>
        </div>
        <div className="intake-aside__orb" />
      </aside>
      <section className="intake-main">
        <div className="intake-main__top"><Link className="text-link" href="/"><ArrowLeft size={15} /> กลับหน้าหลัก</Link></div>
        <div className="intake-card intake-card--registration">
          <div className="stepper">
            {([[1, "ข้อมูลส่วนตัว"], [2, "ส่งเอกสาร"], [3, "เสร็จสิ้น"]] as const).map(([number, label], index) => (
              <div key={number} style={{ display: "contents" }}>
                <div className={`stepper__item ${step >= number ? "stepper__item--active" : ""}`}>
                  <b>{step > number ? <Check size={13} /> : number}</b><span>{label}</span>
                </div>
                {index < 2 && <div className="stepper__line" />}
              </div>
            ))}
          </div>

          {step === 1 && <>
            <h2>ข้อมูลผู้แสดง</h2>
            <p>Choose your performer group and enter your own registration information. Fields marked * are required.</p>
            <form onSubmit={handleRegistration}>
              <div className="performer-choice" role="radiogroup" aria-label="Performer group">
                <label><input type="radio" name="performerType" value="Katakorn" onChange={() => setPerformerType("Katakorn")} required /><span><Sparkles size={20} /><strong>Katakorn</strong><small>คทากร</small></span></label>
                <label><input type="radio" name="performerType" value="Cheerleader" onChange={() => setPerformerType("Cheerleader")} required /><span><Sparkles size={20} /><strong>Cheerleader</strong><small>เชียร์ลีดเดอร์</small></span></label>
                <label><input type="radio" name="performerType" value="Parade" onChange={() => setPerformerType("Parade")} required /><span><Sparkles size={20}/><strong>Parade</strong><small>สมาชิกขบวนพาเหรด</small></span></label>
              </div>
              <div className="form-grid">
                {performerType === "Parade" && <div className="field field--wide"><label htmlFor="parade-type">ประเภทสมาชิกขบวน / Parade member type *</label><select id="parade-type" name="category" className="select" required defaultValue=""><option value="" disabled>เลือกประเภท / Select type</option>{PARADE_TYPES.map(type => <option key={type}>{type}</option>)}</select></div>}
                <ParticipantInformationFields required includeJersey={false}/>
                <Field name="studentId" label="รหัสนักศึกษา / Student ID" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="6909680123" />
                <div className="field"><label>คณะ / Faculty <span>*</span></label><select className="select registration-select" name="faculty" required defaultValue=""><option value="" disabled>เลือกคณะ / Select faculty</option><option value="คณะแพทยศาสตร์">คณะแพทยศาสตร์</option><option value="คณะศิลปศาสตร์">คณะศิลปศาสตร์</option><option value="วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์">วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์</option></select></div>
                <Field name="fullNameThai" label="ชื่อ-สกุล (ไทย) / Thai full name" required placeholder="ชื่อ นามสกุล" />
                <Field name="nicknameThai" label="ชื่อเล่น (ไทย) / Thai nickname" placeholder="ชื่อเล่น" />
                <Field name="fullNameEnglish" label="Full name (English)" required placeholder="Name Surname" />
                <Field name="nicknameEnglish" label="Nickname (English)" placeholder="Nickname" />
                <div className="field"><label>เพศ / Sex <span>*</span></label><select className="select registration-select" name="sex" required defaultValue=""><option value="" disabled>Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option></select></div>
                <Field name="phone" label="หมายเลขโทรศัพท์ / Phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="081-234-5678" />
                <Field name="email" label="อีเมล / Email" required type="email" autoComplete="email" placeholder="name@dome.tu.ac.th" />
                <div className="field"><label>ช่องทางติดต่อหลัก / Preferred contact <span>*</span></label><select className="select registration-select" name="preferredContact" required defaultValue=""><option value="" disabled>Select</option><option value="Phone">Phone</option><option value="LINE">LINE</option><option value="Instagram">Instagram</option><option value="Email">Email</option></select></div>
                <Field name="lineId" label="LINE ID" placeholder="LINE ID" />
                <Field name="instagram" label="Instagram" placeholder="@username" />
              </div>
              <label className="consent-check"><input type="checkbox" name="pdpaConsent" value="yes" required /><span>ข้าพเจ้ายินยอมให้จัดเก็บและใช้ข้อมูลส่วนบุคคลเพื่อการลงทะเบียนและดำเนินงาน Freshy Game 2026 ตามวัตถุประสงค์ของโครงการ</span></label>
              {error && <div className="notice notice--error">{error}</div>}
              <button className="button button--primary button--large" disabled={busy || !auditId}>{busy ? <span className="spinner" /> : <>บันทึกและส่งเอกสาร <ArrowRight size={17} /></>}</button>
            </form>
          </>}

          {step === 2 && registration && <>
            <h2>ส่งเอกสารยืนยัน</h2>
            <p>Upload a profile photo, national ID card, and student ID card. Both ID copies will appear in the PDF with a signed certification.</p>
            <div className="verified-person"><span className="verified-person__icon"><BadgeCheck size={20} /></span><div><strong>{registration.name}</strong><span>Performer · {registration.performerType}</span></div></div>
            <form onSubmit={handleUpload}>
              <ProfilePhotoGuide />
              <DocumentUploadFields {...documents} existingPhotoUrl={registration.profilePhotoUrl} disabled={busy} />
              <SignaturePad disabled={busy} onChange={setSignature}/>
              {error && <div className="notice notice--error">{error}</div>}
              <button className="button button--primary button--large" disabled={busy}>{busy ? <span className="spinner" /> : <><UploadCloud size={17} /> ส่งใบสมัคร</>}</button>
            </form>
          </>}

          {step === 3 && <div className="success-panel"><div className="success-panel__check"><Check size={34} /></div><h2>ลงทะเบียนเรียบร้อยแล้ว</h2><p>Your performer registration and documents are waiting for staff review. You can safely close this page.</p><div className="notice notice--success"><ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />ข้อมูลของคุณถูกส่งอย่างปลอดภัยแล้ว</div><Link href="/" className="button button--ghost button--large" style={{ marginTop: 22 }}>กลับหน้าหลัก</Link></div>}
        </div>
      </section>
    </main>
  );
}

function Field({ label, required, ...props }: {
  label: string;
  required?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  return <div className="field"><label>{label} {required && <span>*</span>}</label><input className="input" required={required} {...props} /></div>;
}

function optional(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}
