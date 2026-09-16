"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { isValidSignature, type Signature } from "@/shared/signature";
import { SignaturePad } from "./SignaturePad";
import { Brand } from "./Brand";
import { errorMessage, UserFacingError } from "../lib/errors";

type Request = FunctionReturnType<typeof api.signatureRequests.open>;
export function SignatureOnly() {
  const open = useMutation(api.signatureRequests.open);
  const submit = useMutation(api.signatureRequests.submit);
  const [request, setRequest] = useState<Request | null>(null);
  const [token, setToken] = useState("");
  const [signature, setSignature] = useState<Signature>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const value = window.location.hash.slice(1);
    void Promise.resolve().then(() => {
      if (!/^[a-f0-9]{64}$/.test(value)) throw new UserFacingError("กรุณาใช้ลิงก์จากเจ้าหน้าที่ / Please use the signature link sent by staff.");
      return open({ token: value });
    }).then(data => { if (active) { setToken(value); setRequest(data); } }, reason => { if (active) setError(errorMessage(reason, "Open signature request")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || !isValidSignature(signature)) { setError("กรุณาลงลายมือชื่อและยืนยันข้อมูล / Please sign and confirm your details."); return; }
    setBusy(true); setError("");
    try { await submit({ token, signature, confirmed: true }); setDone(true); setRequest(null); }
    catch (reason) { setError(errorMessage(reason, "Save signature")); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px" }}>
    <Brand />
    <section className="panel" style={{ padding: 24, marginTop: 24 }}>
      <h1>ลงลายมือชื่อ / Sign your documents</h1>
      {loading && <p role="status">กำลังโหลด / Loading…</p>}
      {done && <div className="notice notice--success" role="status">บันทึกลายมือชื่อเรียบร้อยแล้ว สามารถปิดหน้านี้ได้ / Signature saved. You can close this page.</div>}
      {error && <div className="notice notice--error" role="alert">{error}</div>}
      {request && !done && <form onSubmit={save}>
        <p>ลิงก์หมดอายุ / Link expires: {new Date(request.expiresAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} (Bangkok)</p>
        <p>รหัสนักศึกษา / Student ID: <strong>{request.studentId}</strong></p>
        <p>ตรวจสอบข้อมูลและสำเนาบัตรก่อนลงนาม หากข้อมูลไม่ถูกต้อง กรุณาติดต่อเจ้าหน้าที่ / Review your details and ID copies. Contact staff if anything is incorrect.</p>
        {request.records.map((record, index) => <section key={index} className="record-section">
          <h2>{record.name}</h2>
          <dl className="form-grid">{record.details.map(item => <div key={item.label}><dt>{item.label}</dt><dd style={{ margin: "4px 0 14px", overflowWrap: "anywhere" }}>{item.value}</dd></div>)}</dl>
          <div className="form-grid">{([["บัตรนักศึกษา / Student ID", record.studentIdImageUrl], ["บัตรประชาชน / National ID", record.nationalIdImageUrl]] as const).map(([label, url]) => <figure key={label} style={{ margin: 0 }}><figcaption>{label}</figcaption><img src={url} alt={label} referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: 300, objectFit: "contain" }} /></figure>)}</div>
        </section>)}
        {request.records.some(record => record.signatureNotes.length > 0) && <aside className="correction-summary" aria-label="Signature correction notes"><h3>กรุณาแก้ไขลายมือชื่อ / Signature correction requested</h3>{request.records.flatMap((record, index) => record.signatureNotes.map((note, noteIndex) => <p key={`${index}-${noteIndex}`}>{note}</p>))}</aside>}
        <SignaturePad disabled={busy} onChange={value => { setSignature(value); setConfirmed(false); }} />
        <p>สำเนาถูกต้อง — ใช้สำหรับการแข่งขันกีฬา TU Freshy Games 2026 เท่านั้น</p>
        <label className="upload-confirmation"><input type="checkbox" required disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>ฉันคือผู้มีชื่อข้างต้น และรับรองว่าข้อมูลกับสำเนาบัตรถูกต้อง / I am the named participant and certify these details and ID copies.</span></label>
        <button className="button button--primary" disabled={busy || !confirmed || !isValidSignature(signature)}>{busy ? "กำลังบันทึก / Saving…" : "บันทึกลายมือชื่อ / Submit signature"}</button>
      </form>}
    </section>
  </main>;
}
