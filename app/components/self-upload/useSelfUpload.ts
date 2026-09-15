"use client";

import { DOCUMENT_KEYS, isDocumentField } from "@/shared/corrections";
import { isIntakeProfileComplete } from "@/shared/intakeCompletion";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Signature } from "@/shared/signature";
import { useDocumentFiles } from "../DocumentUploadFields";
import { errorMessage, UserFacingError } from "../../lib/errors";
import { compressImage, type UploadImageKind } from "../../lib/compressImage";

export type Verified = FunctionReturnType<typeof api.publicIntake.verifyIdentity>;
export type Profile = Partial<Verified["profile"]> & Pick<Verified["profile"], "fullNameThai" | "fullNameEnglish" | "faculty">;

export function useSelfUpload() {
  const verifyIdentity = useMutation(api.publicIntake.verifyIdentity);
  const generateUploadUrl = useMutation(api.publicIntake.generateUploadUrl);
  const completeUpload = useMutation(api.publicIntake.completeUpload);
  const [profile, setProfile] = useState<Profile>({ fullNameThai: "", fullNameEnglish: "", faculty: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [signature, setSignature] = useState<Signature>([]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [auditId, setAuditId] = useState<Id<"auditEvents"> | null>(null);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const documents = useDocumentFiles(setError);
  const { files } = documents;
  const needsDocument = (kind: keyof typeof DOCUMENT_KEYS) => !files[kind] && (!verified?.documentUrls[kind] || verified.correctionRequests.some(request => request.field === DOCUMENT_KEYS[kind]));
  const documentsReady = Boolean(verified) && !Object.keys(DOCUMENT_KEYS).some(kind => needsDocument(kind as keyof typeof DOCUMENT_KEYS));
  const savedProfileComplete = Boolean(verified && isIntakeProfileComplete(verified.profile, verified.requiresJersey));
  const profileCorrections = verified?.correctionRequests.filter(request => !isDocumentField(request.field)) ?? [];

  useEffect(() => {
    fetch("/api/client-context", { method: "POST" })
      .then((r) => r.json())
      .then((data) => setAuditId(data.auditEventId))
      .catch(() => setError("ไม่สามารถเริ่มเซสชันได้ กรุณาลองอีกครั้ง / Could not start a secure session."));
  }, []);


  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (!auditId) throw new UserFacingError("Secure session is still loading");
      const result = await verifyIdentity({
        studentId: String(data.get("studentId")),
        phone: String(data.get("phone")),
        auditEventId: auditId,
      });
      setVerified(result);
      setProfile(result.profile);
      setStep(Object.values(result.documentUrls).every(Boolean) && !result.correctionRequests.some(request => isDocumentField(request.field)) ? 3 : 2);
    } catch (e) { setError(errorMessage(e, "Verify your details")); }
    finally { setBusy(false); }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!verified || !documentsReady) return setError("กรุณาเพิ่มรูปที่ขาดหรือแก้ไขรูปที่เจ้าหน้าที่ระบุ / Add missing images and replace those marked for correction.");
    if (signature.flat().length < 2) return setError("Please draw your signature before submitting");
    if (!confirmed) return setError("Please confirm your information");
    setBusy(true);
    try {
      const uploadImage = async (file: File | null, kind: UploadImageKind) => {
        if (!file) return undefined;
        const compressed = await compressImage(file, kind);
        const uploadUrl = await generateUploadUrl({ sessionId: verified.sessionId });
        const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": compressed.type }, body: compressed });
        if (!response.ok) throw new UserFacingError("Image upload failed");
        return (await response.json()).storageId as Id<"_storage">;
      };
      const profilePhotoId = await uploadImage(files.profile, "profile");
      const nationalIdImageId = await uploadImage(files.nationalId, "nationalId");
      const studentIdImageId = await uploadImage(files.studentId, "studentId");
      await completeUpload({ signature, profile, confirmed: true, sessionId: verified.sessionId, profilePhotoId, nationalIdImageId, studentIdImageId });
      setStep(4);
    } catch (e) { setError(errorMessage(e, "Upload images")); }
    finally { setBusy(false); }
  }

  function reviewDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documentsReady) {
      setError("กรุณาเพิ่มรูปที่ขาดหรือแก้ไขรูปที่เจ้าหน้าที่ระบุ / Add missing images and replace those marked for correction.");
      return;
    }
    setError("");
    setStep(3);
  }

  function backToDocuments() {
    setConfirmed(false);
    setSignature([]);
    setError("");
    setStep(2);
  }

  function updateProfile(key: keyof Profile, value: string) {
    setProfile(current => ({ ...current, [key]: value }));
    setConfirmed(false);
  }

  function updateSignature(value: Signature) {
    setSignature(value);
    setConfirmed(false);
  }

  return { documentsReady, savedProfileComplete, profileCorrections, step, auditId, verified, profile, confirmed, setConfirmed, busy, error, documents,
    handleVerify, handleUpload, reviewDocuments, backToDocuments, updateProfile, updateSignature };
}

export type UploadFlow = ReturnType<typeof useSelfUpload>;
