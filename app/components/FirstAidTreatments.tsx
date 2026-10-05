"use client";

import { useState } from "react";
import { useConvex, useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Download, Printer, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH, type Signature } from "@/shared/signature";
import { FacultyTag } from "./FirstAidFields";
import { errorMessage } from "../lib/errors";
import { downloadTreatmentCsv, treatmentDate, treatmentTime } from "../lib/firstAidCsv";

type Treatment = FunctionReturnType<typeof api.firstAidTreatments.list>["page"][number];
type Kit = { id: Id<"firstAidKits">; number: number; label: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function signatureSvg(signature: Signature) {
  const lines = signature.filter(stroke => stroke.length > 1).map(stroke => `<polyline points="${stroke.map(p => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#221811" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  return `<svg viewBox="0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${lines}</svg>`;
}

function SignatureThumb({ signature, label }: { signature: Signature; label: string }) {
  return <svg className="kit-signature" viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} role="img" aria-label={label}>
    {signature.filter(stroke => stroke.length > 1).map((stroke, index) => <polyline key={index} points={stroke.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#221811" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}

/** Printable copy laid out like the paper รายงานการปฐมพยาบาล sheet. */
function reportSheet(rows: Treatment[], kitLabel: string) {
  const body = [...rows].sort((a, b) => a.kitNumber - b.kitNumber || a.sequence - b.sequence).map(r => `<tr>
    <td>${r.sequence}</td><td>${r.kitNumber}</td><td>${treatmentDate(r.treatedAt)}</td><td>${treatmentTime(r.treatedAt)}</td><td>${escapeHtml(r.sport)}</td>
    <td>${escapeHtml(r.patientName)}</td><td>${escapeHtml(r.patientStudentId)}<br><small>${escapeHtml(r.patientFaculty)}</small></td>
    <td>${escapeHtml(r.symptoms)}</td><td>${escapeHtml(r.supplies)}${r.note ? `<br><small>หมายเหตุ: ${escapeHtml(r.note)}</small>` : ""}</td>
    <td class="sig">${signatureSvg(r.patientSignature)}</td><td class="sig">${signatureSvg(r.caretakerSignature)}<small>${escapeHtml(r.caretakerName)}</small></td>
  </tr>`).join("");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานการปฐมพยาบาล</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    body { margin: 0; font-family: system-ui, sans-serif; color: #221b18; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #222; padding: 4px 5px; vertical-align: top; text-align: left; }
    th { text-align: center; font-weight: 700; }
    caption { font-size: 14pt; font-weight: 700; padding-bottom: 6px; }
    .meta th { text-align: left; }
    .sig { width: 80px; } .sig svg { width: 80px; height: 24px; display: block; }
    small { color: #555; }
    tr { break-inside: avoid; }
  </style></head><body><table>
    <caption>รายงานการปฐมพยาบาล</caption>
    <thead>
      <tr class="meta"><th colspan="2">กล่องที่</th><td colspan="3">${escapeHtml(kitLabel)}</td><th colspan="2">พิมพ์เมื่อ</th><td colspan="4">${new Date().toLocaleString("th-TH")}</td></tr>
      <tr><th rowspan="2">ลำดับ</th><th rowspan="2">กล่องที่</th><th rowspan="2">วันที่</th><th rowspan="2">เวลา</th><th rowspan="2">กีฬา</th><th colspan="2">ผู้รับการปฐมพยาบาล</th><th rowspan="2">อาการ</th><th rowspan="2">ยา / เวชภัณฑ์ ที่ใช้</th><th colspan="2">ลงชื่อ</th></tr>
      <tr><th>ชื่อ - สกุล</th><th>รหัสนักศึกษา / คณะ</th><th>ผู้ใช้</th><th>ผู้ดูแล</th></tr>
    </thead><tbody>${body || `<tr><td colspan="11">ไม่มีรายการ</td></tr>`}</tbody></table>
    <script>window.onload = () => { window.print(); };</script></body></html>`;
}

/** Staff-only view of first aid given from the kits. Medical details never reach public pages. */
export function FirstAidTreatments({ kits, isAdmin }: { kits: Kit[]; isAdmin: boolean }) {
  const convex = useConvex();
  const remove = useMutation(api.firstAidTreatments.remove);
  const [kitFilter, setKitFilter] = useState<Id<"firstAidKits"> | "">("");
  const { results, status, loadMore } = usePaginatedQuery(api.firstAidTreatments.list, kitFilter ? { kitId: kitFilter } : {}, { initialNumItems: 25 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    const rows: Treatment[] = [];
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const page: FunctionReturnType<typeof api.firstAidTreatments.list> = await convex.query(api.firstAidTreatments.list, { ...(kitFilter ? { kitId: kitFilter } : {}), paginationOpts: { cursor, numItems: 100 } });
      rows.push(...page.page); cursor = page.continueCursor; isDone = page.isDone;
    }
    return rows;
  }
  async function run(action: () => Promise<void>, label: string) {
    setBusy(true); setError("");
    try { await action(); }
    catch (caught) { setError(errorMessage(caught, label)); }
    finally { setBusy(false); }
  }
  function print() {
    // Open the window during the click so pop-up blockers allow it, then fill it once data arrives.
    const sheet = window.open("", "_blank");
    if (!sheet) { setError("Allow pop-ups for this site to print the report."); return; }
    const kit = kits.find(k => k.id === kitFilter);
    void run(async () => {
      try {
        sheet.document.write(reportSheet(await loadAll(), kit ? `${kit.number}${kit.label ? ` · ${kit.label}` : ""}` : "ทุกกล่อง / All kits"));
        sheet.document.close();
      } catch (caught) { sheet.close(); throw caught; }
    }, "Print the first aid report");
  }
  function destroy(row: Treatment) {
    if (!window.confirm(`Delete first aid record ${row.sequence} of kit ${row.kitNumber}? This cannot be undone.`)) return;
    void run(async () => { await remove({ treatmentId: row.id }); }, "Delete the first aid record");
  }

  return <section className="panel" style={{ marginBottom: 20 }}>
    <div className="panel__head"><h2>รายงานการปฐมพยาบาล · First aid given</h2><div className="filters">
      <select className="select" aria-label="Filter first aid records by kit" value={kitFilter} onChange={e => setKitFilter(e.target.value as Id<"firstAidKits"> | "")}><option value="">All kits</option>{kits.map(k => <option key={k.id} value={k.id}>Kit {k.number}{k.label ? ` · ${k.label}` : ""}</option>)}</select>
      <button className="button button--soft" disabled={busy} onClick={() => void run(async () => downloadTreatmentCsv(await loadAll()), "Export first aid records")}><Download size={14} /> Export CSV</button>
      <button className="button button--soft" disabled={busy} onClick={print}><Printer size={14} /> Print report</button>
    </div></div>
    {error && <div role="alert" className="notice notice--error bulk-export-notice">{error}</div>}
    <div style={{ overflowX: "auto" }}><table className="data-table kit-log kit-treatments">
      <thead><tr><th>ลำดับ</th><th>กล่องที่</th><th>วันที่ · เวลา</th><th>กีฬา</th><th>ผู้รับการปฐมพยาบาล</th><th>อาการ</th><th>ยา / เวชภัณฑ์ ที่ใช้</th><th>ผู้ใช้</th><th>ผู้ดูแล</th>{isAdmin && <th aria-label="Actions" />}</tr></thead>
      <tbody>{results.map(row => <tr key={row.id} style={{ cursor: "default" }}>
        <td><strong>{row.sequence}</strong></td>
        <td><strong>{row.kitNumber}</strong></td>
        <td>{treatmentDate(row.treatedAt)}<br /><span className="kit-log__muted">{treatmentTime(row.treatedAt)}</span></td>
        <td>{row.sport}</td>
        <td><strong>{row.patientName}</strong><br /><span className="kit-log__muted">{row.patientStudentId || "—"}</span> <FacultyTag code={row.patientFaculty} /></td>
        <td>{row.symptoms}</td>
        <td>{row.supplies}{row.note && <><br /><span className="kit-log__muted">{row.note}</span></>}</td>
        <td><SignatureThumb signature={row.patientSignature} label={`Signature of ${row.patientName}`} /></td>
        <td><SignatureThumb signature={row.caretakerSignature} label={`Signature of ${row.caretakerName}`} /><span className="kit-log__muted">{row.caretakerName}</span></td>
        {isAdmin && <td><button className="icon-button" disabled={busy} aria-label={`Delete record ${row.sequence} of kit ${row.kitNumber}`} onClick={() => destroy(row)}><Trash2 size={14} /></button></td>}
      </tr>)}
      {status !== "LoadingFirstPage" && !results.length && <tr><td className="empty-state" colSpan={isAdmin ? 10 : 9}>No first aid has been logged yet.</td></tr>}</tbody>
    </table></div>
    {status === "CanLoadMore" && <div style={{ textAlign: "center", padding: 16 }}><button className="button button--ghost" onClick={() => loadMore(25)}>Load more</button></div>}
  </section>;
}
