"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ClipboardPlus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FacultyCode } from "@/shared/faculties";
import { isValidSignature, type Signature } from "@/shared/signature";
import { SignaturePad } from "./SignaturePad";
import { UploadError, UploadHeading } from "./self-upload/UploadLayout";
import { FacultyChoice, KnownPersonCard, StillNeeded, StudentIdField, useKnownBorrower } from "./FirstAidFields";
import { errorMessage } from "../lib/errors";

/** Digital row of the paper "รายงานการปฐมพยาบาล" sheet kept with each kit. */
export function TreatmentForm({ kitId, defaultSport, onBack, onDone }: { kitId: Id<"firstAidKits">; defaultSport: string; onBack: () => void; onDone: (sequence: number) => void }) {
  const logTreatment = useMutation(api.firstAidTreatments.logTreatment);
  const sports = useQuery(api.firstAidKits.sportOptions);
  const [patientName, setPatientName] = useState("");
  const [patientStudentId, setPatientStudentId] = useState("");
  const [patientFaculty, setPatientFaculty] = useState<FacultyCode | "">("");
  const [sport, setSport] = useState(defaultSport);
  const [symptoms, setSymptoms] = useState("");
  const [supplies, setSupplies] = useState("");
  const [note, setNote] = useState("");
  const [patientSignature, setPatientSignature] = useState<Signature>([]);
  const [caretakerStudentId, setCaretakerStudentId] = useState("");
  const [caretakerName, setCaretakerName] = useState("");
  const [caretakerFaculty, setCaretakerFaculty] = useState<FacultyCode | "">("");
  const [caretakerSignature, setCaretakerSignature] = useState<Signature>([]);
  const caretaker = useKnownBorrower(caretakerStudentId);
  const patient = useKnownBorrower(patientStudentId);
  const patientLookingUp = patientStudentId.length === 10 && patient === undefined;
  // Ask only for what the participant registry and earlier logs don't already have.
  const askPatientName = !patient?.name;
  const askPatientFaculty = !patient?.faculty;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lookingUp = caretakerStudentId.length === 10 && caretaker === undefined;
  const caretakerKnown = caretakerStudentId.length === 10 && !lookingUp;
  const askCaretakerName = caretakerKnown && !caretaker?.name;
  const askCaretakerFaculty = caretakerKnown && !caretaker?.faculty;
  const missing = [
    askPatientName && !patientLookingUp && !patientName.trim() && "ชื่อผู้รับการปฐมพยาบาล / Patient name",
    askPatientFaculty && !patientLookingUp && !patientFaculty && "คณะผู้รับการปฐมพยาบาล / Patient faculty",
    !sport.trim() && "กีฬา / Sport",
    !symptoms.trim() && "อาการ / Symptoms",
    !supplies.trim() && "ยาที่ใช้ / Supplies used",
    !isValidSignature(patientSignature) && "ลายมือชื่อผู้ใช้ / Patient signature",
    caretakerStudentId.length !== 10 && "รหัสผู้ดูแล / Caretaker Student ID",
    askCaretakerName && !caretakerName.trim() && "ชื่อผู้ดูแล / Caretaker name",
    askCaretakerFaculty && !caretakerFaculty && "คณะผู้ดูแล / Caretaker faculty",
    !isValidSignature(caretakerSignature) && "ลายมือชื่อผู้ดูแล / Caretaker signature",
  ];
  const ready = !missing.some(Boolean) && !patientLookingUp && !lookingUp;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isValidSignature(patientSignature) || !isValidSignature(caretakerSignature)) { setError("ต้องมีลายมือชื่อทั้งผู้ใช้และผู้ดูแล / Both signatures are required."); return; }
    setBusy(true); setError("");
    try {
      const result = await logTreatment({
        kitId, sport, patientName: askPatientName ? patientName : undefined, patientStudentId: patientStudentId || undefined, patientFaculty: askPatientFaculty && patientFaculty ? patientFaculty : undefined,
        symptoms, supplies, note: note || undefined, patientSignature,
        caretakerStudentId, caretakerName: askCaretakerName ? caretakerName : undefined, caretakerFaculty: askCaretakerFaculty && caretakerFaculty ? caretakerFaculty : undefined, caretakerSignature,
      });
      onDone(result.sequence);
    } catch (caught) { setError(errorMessage(caught, "Save the first aid record")); }
    finally { setBusy(false); }
  }

  return <>
    <UploadHeading title="บันทึกการปฐมพยาบาล">บันทึกทุกครั้งที่ใช้ยาหรือเวชภัณฑ์จากกล่องนี้ วันที่และเวลาจะบันทึกอัตโนมัติ<br />Record every time medicine or supplies from this kit are used. The date and time are saved automatically.</UploadHeading>
    <form className="upload-form" onSubmit={e => void submit(e)} aria-busy={busy}>
      <fieldset className="upload-section" disabled={busy}>
        <legend>1 · ผู้รับการปฐมพยาบาล / Person receiving first aid</legend>
        <StudentIdField id="treat-patient-student-id" required={false} label="รหัสนักศึกษา / Student ID (กรอกก่อนเพื่อดึงข้อมูล)" value={patientStudentId} onChange={value => { setPatientStudentId(value); setPatientName(""); setPatientFaculty(""); }} />
        {patientLookingUp && <p role="status" className="upload-help">กำลังตรวจสอบ / Checking…</p>}
        {patient && <KnownPersonCard person={patient} />}
        {patientStudentId.length === 10 && patient === null && <p className="upload-help">ไม่พบข้อมูลรหัสนี้ กรุณากรอกข้อมูล / No record found. Please fill in the details.</p>}
        {askPatientName && !patientLookingUp && <div className="field"><label htmlFor="treat-patient-name">ชื่อ - สกุล / Full name <span>*</span></label><input id="treat-patient-name" className="input" required maxLength={100} value={patientName} onChange={e => setPatientName(e.target.value)} /></div>}
        {askPatientFaculty && !patientLookingUp && <FacultyChoice id="treat-patient-faculty" value={patientFaculty} onChange={setPatientFaculty} />}
      </fieldset>
      <fieldset className="upload-section" disabled={busy}>
        <legend>2 · การปฐมพยาบาล / Treatment</legend>
        <div className="field"><label htmlFor="treat-sport">กีฬา / Sport or activity <span>*</span></label><input id="treat-sport" className="input" required maxLength={100} list="treat-sport-options" value={sport} onChange={e => setSport(e.target.value)} /><datalist id="treat-sport-options">{sports?.map(s => <option key={s} value={s} />)}</datalist></div>
        <div className="field"><label htmlFor="treat-symptoms">อาการ / Symptoms <span>*</span></label><textarea id="treat-symptoms" className="input kit-textarea" rows={3} required maxLength={300} placeholder="เช่น ข้อเท้าพลิก บวมเล็กน้อย" value={symptoms} onChange={e => setSymptoms(e.target.value)} /></div>
        <div className="field"><label htmlFor="treat-supplies">ยา / เวชภัณฑ์ ที่ใช้ / Medicine or supplies used <span>*</span></label><textarea id="treat-supplies" className="input kit-textarea" rows={3} required maxLength={300} placeholder="เช่น สเปรย์เย็น 1 ครั้ง, ผ้าพันแผลยืด 1 ม้วน" value={supplies} onChange={e => setSupplies(e.target.value)} /></div>
        <div className="field"><label htmlFor="treat-note">หมายเหตุ / Note</label><input id="treat-note" className="input" maxLength={300} placeholder="ไม่บังคับ / Optional" value={note} onChange={e => setNote(e.target.value)} /></div>
      </fieldset>
      <fieldset className="upload-section" disabled={busy}>
        <legend>3 · ผู้รับการปฐมพยาบาลลงชื่อ / Patient signs</legend>
        <SignaturePad id="treat-patient-signature" label="ลายมือชื่อผู้ใช้ / Signature of person receiving first aid" help="ผู้รับการปฐมพยาบาลลงชื่อยืนยันการใช้ยาและเวชภัณฑ์ / The person who received first aid signs to confirm the supplies used." disabled={busy} onChange={setPatientSignature} />
      </fieldset>
      <fieldset className="upload-section" disabled={busy}>
        <legend>4 · ผู้ดูแล (ผู้ให้การปฐมพยาบาล) / Caretaker</legend>
        <StudentIdField id="treat-caretaker-student-id" label="รหัสนักศึกษาผู้ดูแล / Caretaker Student ID" value={caretakerStudentId} onChange={value => { setCaretakerStudentId(value); setCaretakerName(""); setCaretakerFaculty(""); }} />
        {lookingUp && <p role="status" className="upload-help">กำลังตรวจสอบ / Checking…</p>}
        {caretaker && <KnownPersonCard person={caretaker} title="ผู้ดูแล" />}
        {askCaretakerName && <div className="field"><label htmlFor="treat-caretaker-name">ชื่อ - สกุลผู้ดูแล / Caretaker full name <span>*</span></label><input id="treat-caretaker-name" className="input" required maxLength={100} value={caretakerName} onChange={e => setCaretakerName(e.target.value)} /></div>}
        {askCaretakerFaculty && <FacultyChoice id="treat-caretaker-faculty" value={caretakerFaculty} onChange={setCaretakerFaculty} />}
        <SignaturePad id="treat-caretaker-signature" label="ลายมือชื่อผู้ดูแล / Caretaker signature" help="ผู้ให้การปฐมพยาบาลลงชื่อ / The person who gave first aid signs." disabled={busy} onChange={setCaretakerSignature} />
      </fieldset>
      <UploadError message={error} />
      <StillNeeded items={missing} />
      <div className="upload-actions">
        <button type="button" className="button button--ghost" disabled={busy} onClick={onBack}>ย้อนกลับ / Back</button>
        <button className="button button--primary" disabled={busy || !ready}>{busy ? "กำลังบันทึก / Saving…" : <><ClipboardPlus size={17} /> บันทึก / Save record</>}</button>
      </div>
    </form>
  </>;
}
