"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Printer } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

type Kit = { id: Id<"firstAidKits">; number: number; label: string };

export function kitPath(number: number) {
  return `/first-aid/kit/${number}`;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function labelSheet(kits: Kit[], codes: Map<number, string>, origin: string) {
  const labels = kits.map(kit => `<section class="label">
    <strong>กล่องที่ ${kit.number}</strong>${kit.label ? `<small>${escapeHtml(kit.label)}</small>` : ""}
    <img src="${codes.get(kit.number)}" alt="QR code for kit ${kit.number}">
    <span>สแกนเพื่อยืม คืน หรือรับต่อ<br>Scan to borrow, return, or take over</span>
    <code>${escapeHtml(origin + kitPath(kit.number))}</code>
  </section>`).join("");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>First aid kit labels</title><style>
    @page { margin: 10mm; }
    body { margin: 0; font-family: system-ui, sans-serif; color: #221b18; }
    main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
    .label { break-inside: avoid; border: 1px dashed #b9aca4; border-radius: 4mm; padding: 5mm; display: flex; flex-direction: column; align-items: center; gap: 2mm; text-align: center; }
    strong { font-size: 20pt; color: #4b2f25; }
    small { font-size: 10pt; color: #6f625b; }
    img { width: 42mm; height: 42mm; }
    span { font-size: 9pt; line-height: 1.4; }
    code { font-size: 7pt; color: #6f625b; overflow-wrap: anywhere; }
  </style></head><body><main>${labels}</main><script>window.onload = () => { window.print(); };</script></body></html>`;
}

/** Permanent link and printable QR code for every kit, so each box can be scanned to log it. */
export function FirstAidKitLinks({ kits }: { kits: Kit[] }) {
  const [codes, setCodes] = useState<Map<number, string>>(new Map());
  const [message, setMessage] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const numbers = kits.map(k => k.number).join(",");

  useEffect(() => {
    let cancelled = false;
    void Promise.all(numbers.split(",").filter(Boolean).map(async n => [Number(n), await QRCode.toDataURL(origin + kitPath(Number(n)), { width: 512, margin: 1, errorCorrectionLevel: "M", color: { dark: "#221b18", light: "#ffffff" } })] as const))
      .then(entries => { if (!cancelled) setCodes(new Map(entries)); })
      .catch(() => { if (!cancelled) setMessage("QR codes could not be generated. Refresh and try again."); });
    return () => { cancelled = true; };
  }, [numbers, origin]);

  async function copy(number: number) {
    try { await navigator.clipboard.writeText(origin + kitPath(number)); setMessage(`Copied the link for kit ${number}.`); }
    catch { setMessage("Copy failed. Select the link text and copy it manually."); }
  }
  function download(number: number) {
    const link = document.createElement("a");
    link.href = codes.get(number)!;
    link.download = `Freshy-Game-first-aid-kit-${number}-QR.png`;
    link.click();
  }
  function printLabels() {
    const sheet = window.open("", "_blank");
    if (!sheet) { setMessage("Allow pop-ups for this site to print labels."); return; }
    sheet.document.write(labelSheet(kits, codes, origin));
    sheet.document.close();
  }

  const ready = kits.every(k => codes.has(k.number));
  return <section className="content-card" style={{ marginBottom: 20 }}>
    <h2>Kit links & QR codes</h2>
    <p>Each kit has a permanent link that opens the borrow/return page with that kit already selected. Stick the printed QR label on the box so borrowers can scan it.</p>
    {message && <div role="status" className="notice notice--info" style={{ marginBottom: 16 }}>{message}</div>}
    <button className="button button--primary" disabled={!ready || !kits.length} onClick={printLabels}><Printer size={15} /> Print all labels</button>
    <div className="kit-grid kit-qr-grid">{kits.map(kit => <article key={kit.id} className="kit-card kit-qr">
      <span className="kit-card__head"><strong>Kit {kit.number}</strong>{kit.label && <small>{kit.label}</small>}</span>
      {codes.get(kit.number) ? <img src={codes.get(kit.number)} alt={`QR code linking to kit ${kit.number}`} /> : <span className="kit-qr__placeholder" role="status">Generating…</span>}
      <code>{origin + kitPath(kit.number)}</code>
      <span className="kit-qr__actions">
        <button type="button" className="button button--soft" onClick={() => void copy(kit.number)}><Copy size={13} /> Copy link</button>
        <button type="button" className="button button--soft" disabled={!codes.has(kit.number)} onClick={() => download(kit.number)}><Download size={13} /> PNG</button>
      </span>
    </article>)}</div>
  </section>;
}
