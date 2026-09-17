"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { participantKind } from "@/shared/participantKinds";
import type { Doc } from "@/convex/_generated/dataModel";
import { CORRECTION_FIELDS, isDocumentField, type CorrectionField, type CorrectionRequest } from "@/shared/corrections";
import { CORRECTION_FIELD_GROUPS } from "./correctionFieldGroups";
import { isValidSignature } from "@/shared/signature";
import { errorMessage } from "../lib/errors";

export function FieldCorrectionEditor({ participant, onClose }: {
  participant: Doc<"participants">;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const save = useMutation(api.participants.setFieldCorrection);
  const [selectedField, setSelectedField] = useState<CorrectionField | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requests = participant.correctionRequests ?? [];
  const availableFields = Object.entries(CORRECTION_FIELDS).filter(([field]) =>
    !requests.some(request => request.field === field) &&
    (field !== "jerseyNumber" || participantKind(participant) === "athlete"),
  );
  const canAdd = selectedField !== "" && availableFields.some(([field]) => field === selectedField);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  async function update(field: CorrectionField, nextNote: string, requested: boolean) {
    setBusy(true);
    setError("");
    try {
      await save({ participantId: participant._id, field, note: nextNote, requested });
      return true;
    } catch (error) {
      setError(errorMessage(error, "Save correction request"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedField || !canAdd) return;
    if (await update(selectedField, note, true)) {
      setSelectedField("");
      setNote("");
    }
  }

  return (
    <dialog ref={dialog} className="correction-modal" aria-labelledby="correction-modal-title" aria-describedby="correction-modal-description"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <header className="correction-modal__header">
        <div><h2 id="correction-modal-title">Mark fields for correction</h2><p>{participant.fullNameThai || participant.fullNameEnglish} · {participant.studentId}</p></div>
        <button type="button" className="icon-button" aria-label="Close correction modal" disabled={busy} onClick={onClose}><X size={20} /></button>
      </header>
      <div className="correction-modal__body">
        <p id="correction-modal-description">Add only the fields that need changing. Each correction is saved immediately and appears on the participant’s upload page.</p>
        <form className="correction-modal__add" onSubmit={addCorrection}>
          <label htmlFor="correction-field">Field to correct</label>
          <select id="correction-field" className="select" required value={canAdd ? selectedField : ""} disabled={busy || !availableFields.length}
            onChange={event => { setSelectedField(event.target.value as CorrectionField | ""); setNote(""); setError(""); }}>
            <option value="">{availableFields.length ? "Choose a field…" : "All fields are already in the list"}</option>
            {CORRECTION_FIELD_GROUPS.map(group => {
              const fields = group.fields.filter(field => availableFields.some(([key]) => key === field));
              return fields.length ? <optgroup key={group.title} label={group.title}>{fields.map(field => <option key={field} value={field}>{CORRECTION_FIELDS[field]}</option>)}</optgroup> : null;
            })}
          </select>
          {canAdd && selectedField && <>
            <p className="correction-editor__value">Current value: {fieldValue(participant, selectedField)}</p>
            <label htmlFor="new-correction-note">Note to participant (optional)</label>
            <input id="new-correction-note" className="input" maxLength={500} value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="Describe what needs to change" />
          </>}
          <button type="submit" className="button button--primary" disabled={busy || !canAdd}><Plus size={16} />{busy ? "Saving…" : "Add correction"}</button>
        </form>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        <section className="correction-modal__list" aria-label="Selected correction fields">
          <h3>Correction list <span role="status">({requests.length})</span></h3>
          {!requests.length ? <p className="correction-modal__empty">No fields marked yet. Choose a field above to add your first correction.</p> : CORRECTION_FIELD_GROUPS.map(group => {
            const selected = requests.filter(request => group.fields.includes(request.field));
            return selected.length ? <section className="correction-modal__group" key={group.title}>
              <h4>{group.title}</h4>
              {selected.map(request => <CorrectionRow key={`${request.field}-${request.note}-${request.status}`} participant={participant} request={request} busy={busy} onUpdate={update} />)}
            </section> : null;
          })}
        </section>
      </div>
      <footer className="correction-modal__footer"><button type="button" className="button button--soft" disabled={busy} onClick={onClose}>Done</button></footer>
    </dialog>
  );
}

function fieldValue(participant: Doc<"participants">, field: CorrectionField) {
  if (field === "signature") return isValidSignature(participant.signature) ? "Signature on file" : "Not completed / ยังไม่ได้ลงลายมือชื่อ";
  return isDocumentField(field) ? participant[field] ? "Image on file" : "No image" : String(participant[field] || "Not provided");
}

function CorrectionRow({ participant, request, busy, onUpdate }: {
  participant: Doc<"participants">;
  request: CorrectionRequest;
  busy: boolean;
  onUpdate: (field: CorrectionField, note: string, requested: boolean) => Promise<boolean>;
}) {
  const [note, setNote] = useState(request.note);
  const { field } = request;
  return <article className="correction-editor__row is-marked">
    <strong>{CORRECTION_FIELDS[field]}</strong><span className="correction-editor__value">{fieldValue(participant, field)}</span>
    <span className="pill pill--cream">{request.status === "requested" ? "Correction requested" : "Resubmitted · Awaiting review"}</span>
    <label htmlFor={`correction-${field}`}>Note to participant (optional)</label>
    <input id={`correction-${field}`} className="input" maxLength={500} value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="Describe what needs to change" />
    <div>
      <button type="button" className="button button--soft" disabled={busy || (request.status === "requested" && note === request.note)} onClick={() => void onUpdate(field, note, true)}>{request.status === "requested" ? "Save note" : "Request correction again"}</button>
      <button type="button" className="button button--ghost" disabled={busy} onClick={() => void onUpdate(field, request.note, false)}>Remove from list</button>
    </div>
    {note !== request.note && <small className="correction-editor__value">Unsaved note — click Save note to apply.</small>}
  </article>;
}
