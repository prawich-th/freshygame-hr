"use client";

import { useQuery } from "convex/react";
import { BadgeCheck } from "lucide-react";
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
