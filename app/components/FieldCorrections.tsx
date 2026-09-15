"use client";

import { createContext, useContext, type ReactNode } from "react";
import { CORRECTION_FIELDS, activeCorrections, type CorrectionField, type CorrectionRequest } from "@/shared/corrections";

const CorrectionContext = createContext<CorrectionRequest[]>([]);
export function CorrectionScope({ requests, children }: { requests: CorrectionRequest[]; children: ReactNode }) {
  return <CorrectionContext.Provider value={requests}>{children}</CorrectionContext.Provider>;
}
export function FieldCorrection({ field }: { field: CorrectionField }) {
  const requests = activeCorrections(useContext(CorrectionContext)).filter(request => request.field === field);
  if (!requests.length) return null;
  return <p className="field-correction" role="note"><strong>กรุณาแก้ไข / Correction requested</strong>{requests.map((request, index) => <span key={index}>{request.note || "กรุณาตรวจสอบและแก้ไขรายการนี้ / Please correct this field."}</span>)}</p>;
}
export function CorrectionSummary({ requests }: { requests: CorrectionRequest[] }) {
  const active = activeCorrections(requests);
  if (!active.length) return null;
  return <aside className="correction-summary" aria-label="รายการที่ต้องแก้ไข / Requested corrections"><h3>รายการที่เจ้าหน้าที่ให้แก้ไข / Corrections requested</h3><ul>{active.map((request, index) => <li key={index}><strong>{CORRECTION_FIELDS[request.field]}</strong>{request.note && <span>{request.note}</span>}</li>)}</ul><p>แก้ไขรายการที่ระบุ แล้วส่งให้เจ้าหน้าที่ตรวจสอบอีกครั้ง / Update the marked fields and resubmit for review.</p></aside>;
}
