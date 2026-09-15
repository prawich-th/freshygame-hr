import { useState } from "react";
import { FieldCorrection } from "../FieldCorrections";
import { ArrowLeft, Check } from "lucide-react";
import { ParticipantInformationFields } from "../ParticipantInformationFields";
import { SignaturePad } from "../SignaturePad";
import { DOCUMENT_FIELDS } from "../DocumentUploadFields";
import { UploadError, UploadHeading } from "./UploadLayout";
import type { UploadFlow } from "./useSelfUpload";

const PERSONAL_FIELDS = [
  ["fullNameThai", "ชื่อ-สกุล / Thai full name"],
  ["fullNameEnglish", "English full name"],
  ["nicknameThai", "ชื่อเล่นภาษาไทย / Thai nickname"],
  ["nicknameEnglish", "English nickname"],
  ["sex", "เพศ / Sex"],
  ["email", "อีเมล / Email"],
  ["lineId", "LINE ID"],
  ["instagram", "Instagram"],
  ["preferredContact", "ช่องทางติดต่อที่สะดวก / Preferred contact"],
] as const;
const FACULTIES = ["คณะแพทยศาสตร์", "คณะศิลปศาสตร์", "วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์"];

export function ReviewInformationStep({ flow }: { flow: UploadFlow }) {
  const { verified, profile, busy, confirmed } = flow;
  const [editingDetails, setEditingDetails] = useState(false);
  const showDetails = editingDetails || !flow.savedProfileComplete || flow.profileCorrections.length > 0;
  if (!verified) return null;
  return <>
    <UploadHeading title="ตรวจสอบข้อมูลและลงนาม">ตรวจสอบข้อมูลให้ถูกต้อง ข้อมูลนี้จะใช้กับทุกการลงทะเบียนของคุณ<br />Check your information, then sign to certify your document copies.</UploadHeading>
    <div className="upload-review-summary">
      <div><span>เบอร์ที่ลงทะเบียน / Registered phone</span><strong>{verified.phone}</strong></div>
      <div><span>กีฬาและกิจกรรม / Sports & activities</span><strong>{verified.sport}</strong></div>
      <ul>{DOCUMENT_FIELDS.map(({ kind, title }) => <li key={kind}><Check size={15} /><span><strong>{title}</strong>{flow.documents.files[kind]?.name ?? "ใช้รูปเดิม / Existing image retained"}</span></li>)}</ul>
    </div>
    <form className="upload-form" onSubmit={flow.handleUpload} aria-busy={busy}>
      {!showDetails && <section className="completed-information"><strong>ข้อมูลครบแล้ว / Your information is complete</strong><p>{profile.fullNameThai} · {profile.fullNameEnglish}<br />{profile.faculty}</p><p>ใช้ข้อมูลเดิมได้โดยไม่ต้องกรอกใหม่ / Your saved details will be kept.</p><button className="button button--soft" type="button" disabled={busy} onClick={() => setEditingDetails(true)}>แก้ไขข้อมูล / Edit details</button></section>}
      {showDetails && <>
      <fieldset className="upload-section" disabled={busy}>
        <legend>ข้อมูลส่วนตัว / Personal details</legend>
        <div className="form-grid">
          {PERSONAL_FIELDS.map(([key, label]) => {
            const required = key === "fullNameThai" || key === "fullNameEnglish" || key === "sex";
            return <div className="field" key={key}>
              <label htmlFor={`confirm-${key}`}>{label}{required && " *"}</label>
              <FieldCorrection field={key} />
              <input
                id={`confirm-${key}`}
                className="input"
                type={key === "email" ? "email" : "text"}
                required={required}
                value={profile[key] ?? ""}
                onChange={event => flow.updateProfile(key, event.target.value)}
              />
            </div>;
          })}
          <div className="field field--wide">
            <label htmlFor="confirm-faculty">คณะ / Faculty *</label>
            <FieldCorrection field="faculty" />
            <select id="confirm-faculty" className="select" required value={profile.faculty} onChange={event => flow.updateProfile("faculty", event.target.value)}>
              <option value="">เลือกคณะ / Select faculty</option>
              {FACULTIES.map(faculty => <option key={faculty}>{faculty}</option>)}
            </select>
          </div>
        </div>
      </fieldset>
      <fieldset className="upload-section" disabled={busy}>
        <legend>ข้อมูลสุขภาพและการเข้าร่วม / Health & participation</legend>
        <div className="form-grid">
          <ParticipantInformationFields value={profile} includeJersey={verified.requiresJersey} required onChange={flow.updateProfile}/>
        </div>
      </fieldset>
      </>}
      <fieldset className="upload-section" disabled={busy}>
        <legend>รับรองเอกสาร / Certify your documents</legend>
        <SignaturePad disabled={busy} onChange={flow.updateSignature} />
        <label className="upload-confirmation"><input type="checkbox" required checked={confirmed} onChange={event => flow.setConfirmed(event.target.checked)} /><span>ฉันตรวจสอบแล้วว่าข้อมูลและเอกสารถูกต้อง<br />I confirm that my information and selected documents are correct.</span></label>
      </fieldset>
      <UploadError message={flow.error} />
      <div className="upload-actions upload-actions--split">
        <button type="button" className="button button--ghost" disabled={busy} onClick={flow.backToDocuments}><ArrowLeft size={16} />กลับไปเลือกเอกสาร / Back</button>
        <button className="button button--primary" disabled={!confirmed || busy}>{busy ? "กำลังส่ง / Submitting…" : "ยืนยันและส่ง / Confirm & submit"}</button>
      </div>
    </form>
  </>;
}
