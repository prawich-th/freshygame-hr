"use client";
/* eslint-disable @next/next/no-img-element */

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Check, LockKeyhole, ShieldCheck, UploadCloud } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Brand } from "./Brand";
import { compressImage, type UploadImageKind } from "../lib/compressImage";

type Verified = { sessionId: Id<"uploadSessions">; name: string; sport: string; faculty: string };

export function SelfUpload() {
  const verifyIdentity = useMutation(api.publicIntake.verifyIdentity);
  const generateUploadUrl = useMutation(api.publicIntake.generateUploadUrl);
  const completeUpload = useMutation(api.publicIntake.completeUpload);
  const [step, setStep] = useState(1);
  const [auditId, setAuditId] = useState<Id<"auditEvents"> | null>(null);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [files, setFiles] = useState<{ profile: File | null; nationalId: File | null; studentId: File | null }>({ profile: null, nationalId: null, studentId: null });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/client-context", { method: "POST" })
      .then((r) => r.json())
      .then((data) => setAuditId(data.auditEventId))
      .catch(() => setError("ไม่สามารถเริ่มเซสชันได้ กรุณาลองอีกครั้ง / Could not start a secure session."));
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (!auditId) throw new Error("Secure session is still loading");
      const result = await verifyIdentity({
        studentId: String(data.get("studentId")),
        phone: String(data.get("phone")),
        auditEventId: auditId,
      });
      setVerified(result); setStep(2);
    } catch (e) { setError(e instanceof Error ? e.message : "Verification failed"); }
    finally { setBusy(false); }
  }

  function chooseFile(kind: "profile" | "nationalId" | "studentId", nextFile?: File) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/") || nextFile.size > 25 * 1024 * 1024) {
      setError("Please choose a JPG, PNG, or WebP image under 25 MB"); return;
    }
    if (kind === "profile" && preview) URL.revokeObjectURL(preview);
    setFiles((current) => ({ ...current, [kind]: nextFile }));
    if (kind === "profile") setPreview(URL.createObjectURL(nextFile));
    setError("");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!verified || !files.profile || !files.nationalId || !files.studentId) return setError("กรุณาอัปโหลดรูปทั้ง 3 รายการ / Please upload all three images");
    setBusy(true);
    try {
      const uploadImage = async (file: File, kind: UploadImageKind) => {
        const compressed = await compressImage(file, kind);
        const uploadUrl = await generateUploadUrl({ sessionId: verified.sessionId });
        const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": compressed.type }, body: compressed });
        if (!response.ok) throw new Error("Image upload failed");
        return (await response.json()).storageId as Id<"_storage">;
      };
      const profilePhotoId = await uploadImage(files.profile, "profile");
      const nationalIdImageId = await uploadImage(files.nationalId, "nationalId");
      const studentIdImageId = await uploadImage(files.studentId, "studentId");
      await completeUpload({ sessionId: verified.sessionId, profilePhotoId, nationalIdImageId, studentIdImageId });
      setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  }

  return (
    <main className="intake-page">
      <aside className="intake-aside">
        <Brand />
        <div className="intake-aside__copy"><span>PARTICIPANT DOCUMENT PORTAL</span><h1>ส่งเอกสาร<br />ของคุณให้ครบ</h1><p>ใช้ข้อมูลเดียวกับที่ลงทะเบียนไว้เพื่อยืนยันตัวตน จากนั้นอัปโหลดรูปโปรไฟล์ รูปบัตรประชาชน และรูปบัตรนักศึกษาอย่างปลอดภัย</p></div>
        <div className="intake-aside__orb" />
      </aside>
      <section className="intake-main">
        <div className="intake-main__top"><Link className="text-link" href="/"><ArrowLeft size={15} /> กลับหน้าหลัก</Link></div>
        <div className="intake-card">
          <div className="stepper">
            {([[1,"ยืนยันตัวตน"],[2,"ส่งเอกสาร"],[3,"เสร็จสิ้น"]] as const).map(([number,label], index) => <div key={number} style={{display:"contents"}}><div className={`stepper__item ${step >= number ? "stepper__item--active" : ""}`}><b>{step > number ? <Check size={13}/> : number}</b><span>{label}</span></div>{index < 2 && <div className="stepper__line" />}</div>)}
          </div>

          {step === 1 && <>
            <h2>ยืนยันตัวตนของคุณ</h2><p>Verify your identity with your Student ID and full registered phone number.</p>
            <form onSubmit={handleVerify}>
              <div className="field"><label>หมายเลขประจำตัวนักศึกษา / Student ID <span>*</span></label><input className="input" name="studentId" required inputMode="numeric" placeholder="เช่น 6709680123" /></div>
              <div className="field"><label>หมายเลขโทรศัพท์ที่ลงทะเบียน / Registered phone number <span>*</span></label><input className="input" name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="081-234-5678 or +66 81 234 5678" /></div>
              <div className="notice notice--info"><LockKeyhole size={13} style={{verticalAlign:"middle",marginRight:6}}/>IP address and browser details are recorded to protect your personal data.</div>
              {error && <div className="notice notice--error">{error}</div>}
              <button className="button button--primary button--large" disabled={busy || !auditId}>{busy ? <span className="spinner" /> : <>ตรวจสอบข้อมูล <ArrowRight size={17}/></>}</button>
            </form>
          </>}

          {step === 2 && verified && <>
            <h2>ส่งเอกสารเพิ่มเติม</h2><p>Upload clear images of your profile, national ID card, and student ID card. Images are compressed automatically, and both ID cards receive an official-use watermark before upload.</p>
            <div className="verified-person"><span className="verified-person__icon"><BadgeCheck size={20}/></span><div><strong>{verified.name}</strong><span>{verified.sport} · {verified.faculty}</span></div></div>
            <form onSubmit={handleUpload}>
              <div className="document-upload-grid">
                <div className="upload-drop"><input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFile("profile", e.target.files?.[0])}/><label htmlFor="photo">{preview ? <img className="photo-preview" src={preview} alt="Profile preview"/> : <Camera size={28}/>}<strong>รูปโปรไฟล์</strong><span>Profile photo</span></label></div>
                <div className={`upload-drop ${files.nationalId ? "upload-drop--ready" : ""}`}><input id="national-card" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFile("nationalId", e.target.files?.[0])}/><label htmlFor="national-card">{files.nationalId ? <Check size={28}/> : <UploadCloud size={28}/>}<strong>บัตรประชาชน</strong><span>{files.nationalId?.name ?? "National ID card image"}</span></label></div>
                <div className={`upload-drop ${files.studentId ? "upload-drop--ready" : ""}`}><input id="student-card" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFile("studentId", e.target.files?.[0])}/><label htmlFor="student-card">{files.studentId ? <Check size={28}/> : <UploadCloud size={28}/>}<strong>บัตรนักศึกษา</strong><span>{files.studentId?.name ?? "Student ID card image"}</span></label></div>
              </div>
              {error && <div className="notice notice--error">{error}</div>}
              <button className="button button--primary button--large" disabled={busy}>{busy ? <span className="spinner"/> : <><UploadCloud size={17}/> ส่งเอกสาร</>}</button>
            </form>
          </>}

          {step === 3 && <div className="success-panel"><div className="success-panel__check"><Check size={34}/></div><h2>ส่งเอกสารเรียบร้อยแล้ว</h2><p>Your documents are now waiting for staff review. You can safely close this page.</p><div className="notice notice--success"><ShieldCheck size={14} style={{verticalAlign:"middle",marginRight:6}}/>ข้อมูลของคุณถูกส่งอย่างปลอดภัยแล้ว</div><Link href="/" className="button button--ghost button--large" style={{marginTop:22}}>กลับหน้าหลัก</Link></div>}
        </div>
      </section>
    </main>
  );
}
