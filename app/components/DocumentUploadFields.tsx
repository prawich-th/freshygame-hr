"use client";
/* eslint-disable @next/next/no-img-element */

import { FieldCorrection } from "./FieldCorrections";
import { DOCUMENT_KEYS, type CorrectionRequest } from "@/shared/corrections";
import { useEffect, useId, useRef, useState } from "react";
import { Camera, Check, FileImage, UploadCloud, X } from "lucide-react";
import type { UploadImageKind } from "../lib/compressImage";

export const DOCUMENT_FIELDS = [
  { kind: "profile", title: "รูปนักศึกษา", english: "Student profile photo", hint: "ชุดนักศึกษา หน้าตรง พื้นหลังเรียบ / Student uniform, face forward, plain background" },
  { kind: "nationalId", title: "บัตรประชาชน", english: "National ID card", hint: "เห็นบัตรครบทั้งใบและอ่านข้อมูลได้ชัดเจน / Show the full card with readable details" },
  { kind: "studentId", title: "บัตรนักศึกษา", english: "Student ID card", hint: "เห็นชื่อและรหัสนักศึกษาชัดเจน / Keep your name and Student ID readable" },
] as const;

type Files = Record<UploadImageKind, File | null>;
type Previews = Partial<Record<UploadImageKind, string>>;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function useDocumentFiles(onError: (message: string) => void) {
  const [files, setFiles] = useState<Files>({ profile: null, nationalId: null, studentId: null });
  const [previews, setPreviews] = useState<Previews>({});
  const urls = useRef<Previews>({});

  useEffect(() => () => {
    Object.values(urls.current).forEach(url => URL.revokeObjectURL(url));
  }, []);

  function chooseFile(kind: UploadImageKind, file?: File) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > 25 * 1024 * 1024) {
      onError("กรุณาเลือกไฟล์ JPG, PNG หรือ WebP ขนาดไม่เกิน 25 MB / Choose a JPG, PNG, or WebP image up to 25 MB.");
      return;
    }
    const oldUrl = urls.current[kind];
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    urls.current = { ...urls.current, [kind]: URL.createObjectURL(file) };
    setPreviews({ ...urls.current });
    setFiles(current => ({ ...current, [kind]: file }));
    onError("");
  }

  function removeFile(kind: UploadImageKind) {
    const oldUrl = urls.current[kind];
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    delete urls.current[kind];
    setPreviews({ ...urls.current });
    setFiles(current => ({ ...current, [kind]: null }));
    onError("");
  }

  return { files, previews, chooseFile, removeFile };
}

export function DocumentUploadFields({ files, previews, chooseFile, removeFile, existingPhotoUrl, existingUrls, corrections = [], disabled = false }: ReturnType<typeof useDocumentFiles> & {
  existingPhotoUrl?: string | null;
  existingUrls?: Partial<Record<UploadImageKind, string | null>>;
  corrections?: CorrectionRequest[];
  disabled?: boolean;
}) {
  const id = useId();
  const selectedCount = DOCUMENT_FIELDS.filter(({ kind }) => (files[kind] || existingUrls?.[kind]) && (!corrections.some(request => request.field === DOCUMENT_KEYS[kind] && request.status === "requested") || files[kind])).length;
  return (
    <section className="document-fields" aria-label="เอกสารที่ต้องอัปโหลด / Required documents">
      <div className="document-fields__heading">
        <div><h3>เอกสารของคุณ / Your documents</h3><p>JPG, PNG, WebP · ไม่เกิน 25 MB ต่อรูป / Up to 25 MB each</p></div>
        <span role="status">{selectedCount} / 3 ready</span>
      </div>
      <div className="document-fields__list">
        {DOCUMENT_FIELDS.map(({ kind, title, english, hint }) => {
          const file = files[kind];
          const preview = previews[kind] || existingUrls?.[kind] || (kind === "profile" ? existingPhotoUrl : null);
          const inputId = `${id}-${kind}`;
          return (
            <article key={kind} className={`document-field ${file ? "document-field--ready" : ""}`}>
              <div className={`document-field__preview ${kind === "profile" ? "document-field__preview--portrait" : ""}`}>
                {preview ? <img src={preview} alt={`${file ? "Selected" : "Current"} ${english}`} /> : kind === "profile" ? <Camera size={30} /> : <FileImage size={30} />}
              </div>
              <div className="document-field__body">
                <h4><label htmlFor={inputId}>{title} <span>*</span></label></h4>
                <span>{english}</span>
                <FieldCorrection field={DOCUMENT_KEYS[kind]} />
                <p id={`${inputId}-hint`}>{hint}</p>
                {file ? <p className="document-field__status"><Check size={14} /><span>{file.name}</span></p> : preview ? <p className="document-field__status">{existingUrls ? "รูปปัจจุบัน · ใช้รูปเดิมได้หากไม่ต้องแก้ไข / Current image · Kept unless replaced" : "รูปปัจจุบัน · เลือกรูปใหม่ / Current photo · Select a replacement"}</p> : null}
                <div className="document-field__actions">
                  <div className="document-field__picker">
                    <input id={inputId} type="file" accept={ACCEPTED_TYPES.join(",")} disabled={disabled} aria-describedby={`${inputId}-hint`} onChange={event => { chooseFile(kind, event.target.files?.[0]); event.target.value = ""; }} />
                    <span aria-hidden="true"><UploadCloud size={16} />{preview ? "เปลี่ยนรูป / Replace" : "เลือกรูป / Choose image"}</span>
                  </div>
                  {file && <button type="button" className="button button--ghost" disabled={disabled} onClick={() => removeFile(kind)} aria-label={`Remove selected ${english}`}><X size={16} />นำออก / Remove</button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
