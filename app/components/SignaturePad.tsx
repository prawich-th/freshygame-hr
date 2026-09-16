"use client";

import { FieldCorrection } from "./FieldCorrections";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { SIGNATURE_WIDTH, SIGNATURE_HEIGHT, isValidSignature, type Signature } from "@/shared/signature";

export function SignaturePad({ onChange, disabled = false }: { onChange: (value: Signature) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Signature>([]);
  const pointer = useRef<number | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (context) { context.strokeStyle = "#221811"; context.lineWidth = 2; context.lineCap = "round"; context.lineJoin = "round"; }
  }, []);
  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(600, (event.clientX - bounds.left) * 600 / bounds.width)), y: Math.max(0, Math.min(180, (event.clientY - bounds.top) * 180 / bounds.height)) };
  }
  function end(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    onChange(strokes.current.map(stroke => [...stroke]));
    setHasSignature(isValidSignature(strokes.current));
  }
  return <div className="field field--wide">
    <label>ลายมือชื่อผู้เข้าร่วม / Participant signature <span>* Required</span></label>
    <FieldCorrection field="signature" />
    <p id="signature-help">ลงลายมือชื่อด้วยนิ้วหรือเมาส์ เพื่อยืนยันข้อมูลและรับรองสำเนาบัตรทั้งสองฉบับสำหรับการแข่งขัน TU Freshy Games 2026 / Draw your own signature to confirm your information and certify both ID copies for TU Freshy Games 2026.</p>
    <canvas ref={canvas} width={SIGNATURE_WIDTH} height={SIGNATURE_HEIGHT} aria-label="Draw your signature using touch, pen, or mouse" aria-describedby="signature-help" style={{ width: "100%", height: "auto", background: "white", border: "1px solid #b9a99c", borderRadius: 8, touchAction: "none", cursor: disabled ? "default" : "crosshair" }}
      onPointerDown={event => { if (disabled || pointer.current !== null || strokes.current.length >= 100) return; pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); strokes.current.push([point(event)]); }}
      onPointerMove={event => { if (disabled || pointer.current !== event.pointerId || strokes.current.flat().length >= 5000) return; const stroke = strokes.current[strokes.current.length - 1]; const previous = stroke[stroke.length - 1]; const next = point(event); stroke.push(next); const context = canvas.current?.getContext("2d"); if (context) { context.beginPath(); context.moveTo(previous.x, previous.y); context.lineTo(next.x, next.y); context.stroke(); } }}
      onPointerUp={end} onPointerCancel={end}/>
    <button className="button button--ghost" type="button" disabled={disabled} onClick={() => { canvas.current?.getContext("2d")?.clearRect(0, 0, 600, 180); strokes.current = []; pointer.current = null; setHasSignature(false); onChange([]); }}>ล้างลายมือชื่อ / Clear signature</button>
    <small aria-live="polite">{hasSignature ? "Signature captured. Submit to save." : "Please draw your signature before submitting."}</small>
  </div>;
}
