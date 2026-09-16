import { PenLine } from "lucide-react";
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH, type Signature } from "@/shared/signature";

export function SignaturePreview({ signature, signedName, signedAt }: {
  signature?: Signature;
  signedName?: string;
  signedAt?: number;
}) {
  const strokes = signature?.filter(stroke => stroke.length > 1) ?? [];
  const hasSignature = strokes.length > 0;
  return (
    <section className="record-section record-signature">
      <header><h3>Participant signature / ลายมือชื่อ</h3><p>Confirmation of participant information and certified ID copies</p></header>
      {hasSignature ? <div className="record-signature__body">
        <div className="record-signature__image">
          <svg viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} role="img" aria-label={signedName ? `Saved signature of ${signedName}` : "Saved participant signature"}>
            {strokes.map((stroke, index) => <polyline key={index} points={stroke.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#221811" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />)}
          </svg>
        </div>
        <dl className="record-signature__details">
          <div><dt>Signed by / ผู้ลงนาม</dt><dd>{signedName || "Not recorded"}</dd></div>
          <div><dt>Signed on / วันที่ลงนาม</dt><dd>{signedAt ? <time dateTime={new Date(signedAt).toISOString()}>{new Date(signedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} (Bangkok)</time> : "Not recorded"}</dd></div>
        </dl>
      </div> : <div className="record-signature__empty"><PenLine size={24} /><div><strong>No saved signature / ยังไม่มีลายมือชื่อ</strong><p>The participant needs to sign and submit their documents.</p></div></div>}
    </section>
  );
}
