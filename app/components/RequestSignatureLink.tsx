"use client";

import { useId, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "../lib/errors";

export function RequestSignatureLink({ participantId, disabled, compact = false }: { participantId: Id<"participants">; disabled?: boolean; compact?: boolean }) {
  const linkId = useId();
  const create = useMutation(api.signatureRequests.create);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Link copied. Send it to the participant.");
    } catch { setMessage("Select and copy the link below."); }
  }
  async function generate() {
    setBusy(true); setMessage(""); setLink("");
    try {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
      await create({ participantId, token });
      const value = `${window.location.origin}/sign#${token}`;
      setLink(value);
      if (compact) await copy(value);
    } catch (error) { setMessage(errorMessage(error, "Create signature link")); }
    finally { setBusy(false); }
  }
  if (compact) return <div className="signature-link-shortcut" onClick={event => event.stopPropagation()}>
    <button type="button" className="pill pill--amber signature-link-shortcut__button" disabled={disabled || busy} title={link ? "Copy signature-request link" : "Create and copy signature-request link (valid for 48 hours)"} onClick={() => void (link ? copy(link) : generate())}>
      {link ? <Copy size={12} /> : <Link2 size={12} />}{busy ? "Creating…" : link ? "Copy signature link" : "Missing signature"}
    </button>
    {message && <span className="signature-link-shortcut__message" role="status">{message}</span>}
    {link && <input className="input" aria-label="Signature-request link" readOnly value={link} onFocus={event => event.currentTarget.select()} />}
  </div>;
  return <section className="record-section record-signature-request">
    <header>
      <h3>Request signature / ขอรับลายมือชื่อ</h3>
      <p>Send a signature-only link to the participant</p>
    </header>
    <div className="record-signature-request__body">
      <p className="record-signature-request__description">The link expires after 48 hours and can be used once. Creating a new link replaces this record’s previous link.</p>
      <button type="button" className="button button--soft" disabled={disabled || busy} onClick={() => void generate()}><Link2 size={16} />{busy ? "Creating…" : "Create signature-only link"}</button>
      {link && <div className="field record-signature-request__link">
        <label htmlFor={linkId}>Signature link</label>
        <div className="record-signature-request__controls">
          <input id={linkId} className="input" readOnly value={link} onFocus={event => event.currentTarget.select()} />
          <button type="button" className="button button--soft" onClick={() => { void navigator.clipboard.writeText(link).then(() => setMessage("Link copied. Send it to the participant."), () => setMessage("Select and copy the link above.")); }}><Copy size={16} />Copy link</button>
        </div>
      </div>}
      {message && <p className="record-signature-request__message" role="status">{message}</p>}
    </div>
  </section>;
}
