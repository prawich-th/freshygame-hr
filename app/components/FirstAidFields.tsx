"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { BadgeCheck, Camera, Check, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { FACULTIES, type FacultyCode } from "@/shared/faculties";

export function formatTime(value: number) {
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export function useKnownBorrower(studentId: string) {
  return useQuery(api.firstAidKits.knownBorrower, /^\d{10}$/.test(studentId) ? { studentId } : "skip");
}

export const isFaculty = (value: string): value is FacultyCode => FACULTIES.some(f => f.code === value);

export function StudentIdField({ id, value, onChange, disabled, required = true, label = "รหัสนักศึกษา / Student ID" }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean; label?: string }) {
  return <div className="field"><label htmlFor={id}>{label} {required && <span>*</span>}</label><input id={id} className="input" required={required} inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} autoComplete="off" value={value} disabled={disabled} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))} /></div>;
}

export function FacultyTag({ code }: { code: string }) {
  return <span className="kit-faculty">{code}</span>;
}

export function FacultyChoice({ value, onChange, id = "kit-faculty" }: { value: FacultyCode | ""; onChange: (value: FacultyCode) => void; id?: string }) {
  return <div className="field">
    <label id={`${id}-label`}>คณะ / Faculty <span>*</span></label>
    <div className="kit-faculty-choice" role="radiogroup" aria-labelledby={`${id}-label`}>
      {FACULTIES.map(f => <label key={f.code}><input type="radio" name={id} value={f.code} required checked={value === f.code} onChange={() => onChange(f.code)} /><span><strong>{f.code}</strong><small>{f.thai}</small></span></label>)}
    </div>
  </div>;
}

type Known = { name: string; nickname: string; faculty: string; phoneHint: string };

/** What the participant registry or earlier logs already know about a student ID. */
export function KnownPersonCard({ person, title, onEdit }: { person: Known; title?: string; onEdit?: () => void }) {
  const details = [person.phoneHint && `เบอร์โทร ${person.phoneHint}`].filter(Boolean);
  return <div className="upload-person"><BadgeCheck size={24} /><div>
    <strong>{title ? `${title}: ` : ""}{person.name || "ไม่มีชื่อในระบบ"}{person.nickname && ` (${person.nickname})`}{person.faculty && <> <FacultyTag code={person.faculty} /></>}</strong>
    <span>พบข้อมูลในระบบ / Found in records{details.length ? ` · ${details.join(" · ")}` : ""}{onEdit && <> · <button type="button" className="link-button" onClick={onEdit}>แก้ไขข้อมูล / Update details</button></>}</span>
  </div></div>;
}

/** One-tap camera capture with a preview; falls back to the photo picker on desktops. */
export function KitPhotoField({ id, file, onChange, disabled }: { id: string; file: File | null; onChange: (file: File | null) => void; disabled?: boolean }) {
  const [preview, setPreview] = useState("");
  const url = useRef("");
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
  function choose(next: File | null) {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = next ? URL.createObjectURL(next) : "";
    setPreview(url.current);
    onChange(next);
  }
  return <article className={`document-field ${file ? "document-field--ready" : ""}`}>
    <div className="document-field__preview kit-photo__preview">{file && preview ? <img src={preview} alt="รูปกล่องที่คืน / Photo of the returned kit" /> : <Camera size={30} />}</div>
    <div className="document-field__body">
      <h4><label htmlFor={id}>ถ่ายรูปกล่อง / Photo of the kit <span>*</span></label></h4>
      <p id={`${id}-hint`}>เปิดฝากล่อง ถ่ายให้เห็นกล่องทั้งใบและของข้างใน<br />Open the lid and show the whole kit and what is inside.</p>
      {file && <p className="document-field__status"><Check size={14} /><span>ถ่ายรูปแล้ว / Photo ready</span></p>}
      <div className="document-field__actions">
        <div className="document-field__picker">
          <input id={id} type="file" accept="image/*" capture="environment" disabled={disabled} aria-describedby={`${id}-hint`} onChange={event => { const chosen = event.target.files?.[0]; if (chosen) choose(chosen); event.target.value = ""; }} />
          <span aria-hidden="true"><Camera size={16} />{file ? "ถ่ายใหม่ / Retake" : "ถ่ายรูป / Take photo"}</span>
        </div>
        {file && <button type="button" className="button button--ghost" disabled={disabled} onClick={() => choose(null)}><X size={16} />นำออก / Remove</button>}
      </div>
    </div>
  </article>;
}
