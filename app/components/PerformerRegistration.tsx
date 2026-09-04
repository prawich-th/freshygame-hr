"use client";
/* eslint-disable @next/next/no-img-element */

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, type InputHTMLAttributes, useEffect, useState } from "react";
import { compressImage, type UploadImageKind } from "../lib/compressImage";
import { Brand } from "./Brand";

type PerformerType = "Katakorn" | "Cheerleader";
type Sex = "Male" | "Female" | "Non-binary" | "Prefer not to say";
type PreferredContact = "Phone" | "LINE" | "Instagram" | "Email";
type Faculty = "คณะแพทยศาสตร์" | "คณะศิลปศาสตร์" | "คณะแพทยศาสตร์นานาชาติจุฬาภรณ์";
type Registration = {
  sessionId: Id<"uploadSessions">;
  name: string;
  performerType: PerformerType;
};

export function PerformerRegistration() {
  const registerPerformer = useMutation(api.publicIntake.registerPerformer);
  const generateUploadUrl = useMutation(api.publicIntake.generateUploadUrl);
  const completeUpload = useMutation(api.publicIntake.completeUpload);
  const [step, setStep] = useState(1);
  const [auditId, setAuditId] = useState<Id<"auditEvents"> | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [files, setFiles] = useState<{
    profile: File | null;
    nationalId: File | null;
    studentId: File | null;
  }>({ profile: null, nationalId: null, studentId: null });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (!auditId) throw new Error("Secure session is still loading");
      if (data.get("pdpaConsent") !== "yes") throw new Error("PDPA consent is required to register");
      const result = await registerPerformer({
        auditEventId: auditId,
        performerType: String(data.get("performerType")) as PerformerType,
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
        pdpaConsent: true,
      });
      setRegistration(result);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  function chooseFile(kind: "profile" | "nationalId" | "studentId", nextFile?: File) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/") || nextFile.size > 25 * 1024 * 1024) {
      setError("Please choose a JPG, PNG, or WebP image under 25 MB");
      return;
    }
    if (kind === "profile" && preview) URL.revokeObjectURL(preview);
    setFiles((current) => ({ ...current, [kind]: nextFile }));
    if (kind === "profile") setPreview(URL.createObjectURL(nextFile));
    setError("");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        if (!response.ok) throw new Error("Image upload failed");
        return (await response.json()).storageId as Id<"_storage">;
      };
      const profilePhotoId = await uploadImage(files.profile, "profile");
      const nationalIdImageId = await uploadImage(files.nationalId, "nationalId");
      const studentIdImageId = await uploadImage(files.studentId, "studentId");
      await completeUpload({
        sessionId: registration.sessionId,
        profilePhotoId,
        nationalIdImageId,
        studentIdImageId,
      });
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
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
          <p>สำหรับ Katakorn และ Cheerleader กรอกข้อมูลของคุณด้วยตนเอง แล้วส่งเอกสารยืนยันให้ครบภายในครั้งเดียว</p>
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
                <label><input type="radio" name="performerType" value="Katakorn" required /><span><Sparkles size={20} /><strong>Katakorn</strong><small>คทากร</small></span></label>
                <label><input type="radio" name="performerType" value="Cheerleader" required /><span><Sparkles size={20} /><strong>Cheerleader</strong><small>เชียร์ลีดเดอร์</small></span></label>
              </div>
              <div className="form-grid">
                <Field name="studentId" label="รหัสนักศึกษา / Student ID" required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="6909680123" />
                <div className="field"><label>คณะ / Faculty <span>*</span></label><select className="select registration-select" name="faculty" required defaultValue=""><option value="" disabled>เลือกคณะ / Select faculty</option><option value="คณะแพทยศาสตร์">คณะแพทยศาสตร์</option><option value="คณะศิลปศาสตร์">คณะศิลปศาสตร์</option><option value="คณะแพทยศาสตร์นานาชาติจุฬาภรณ์">คณะแพทยศาสตร์นานาชาติจุฬาภรณ์</option></select></div>
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
            <p>Upload a profile photo, national ID card, and student ID card. ID images receive an official-use watermark before upload.</p>
            <div className="verified-person"><span className="verified-person__icon"><BadgeCheck size={20} /></span><div><strong>{registration.name}</strong><span>Performer · {registration.performerType}</span></div></div>
            <form onSubmit={handleUpload}>
              <div className="document-upload-grid">
                <div className="upload-drop"><input id="performer-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile("profile", event.target.files?.[0])} /><label htmlFor="performer-photo">{preview ? <img className="photo-preview" src={preview} alt="Profile preview" /> : <Camera size={28} />}<strong>รูปโปรไฟล์</strong><span>Profile photo</span></label></div>
                <div className={`upload-drop ${files.nationalId ? "upload-drop--ready" : ""}`}><input id="performer-national-card" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile("nationalId", event.target.files?.[0])} /><label htmlFor="performer-national-card">{files.nationalId ? <Check size={28} /> : <UploadCloud size={28} />}<strong>บัตรประชาชน</strong><span>{files.nationalId?.name ?? "National ID card image"}</span></label></div>
                <div className={`upload-drop ${files.studentId ? "upload-drop--ready" : ""}`}><input id="performer-student-card" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile("studentId", event.target.files?.[0])} /><label htmlFor="performer-student-card">{files.studentId ? <Check size={28} /> : <UploadCloud size={28} />}<strong>บัตรนักศึกษา</strong><span>{files.studentId?.name ?? "Student ID card image"}</span></label></div>
              </div>
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
