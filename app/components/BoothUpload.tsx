"use client";
/* eslint-disable @next/next/no-img-element */

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  FileCheck2,
  Images,
  LoaderCircle,
  LogOut,
  RotateCcw,
  Search,
  ShieldCheck,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Brand } from "./Brand";
import { compressImage } from "../lib/compressImage";

type DocumentKind = "profile" | "nationalId" | "studentId";
type SelectedFiles = Partial<Record<DocumentKind, File>>;
type PreviewUrls = Partial<Record<DocumentKind, string>>;

const documentDetails: Array<{
  kind: DocumentKind;
  title: string;
  thai: string;
  hint: string;
  capture: "user" | "environment";
  portrait?: boolean;
}> = [
  { kind: "profile", title: "Profile photo", thai: "รูปโปรไฟล์", hint: "Face centered, plain background", capture: "user", portrait: true },
  { kind: "nationalId", title: "National ID card", thai: "บัตรประชาชน", hint: "Capture the full front of the card", capture: "environment" },
  { kind: "studentId", title: "Student ID card", thai: "บัตรนักศึกษา", hint: "Make the name and ID readable", capture: "environment" },
];

export function BoothUpload() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) return <BoothLoading />;
  return isAuthenticated ? <BoothWorkspace /> : <BoothSignIn />;
}

function BoothLoading() {
  return <main className="booth-center"><LoaderCircle className="booth-spinner" size={30} /></main>;
}

function BoothSignIn() {
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    data.set("flow", "signIn");
    try {
      await signIn("password", data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
      setBusy(false);
    }
  }

  return <main className="booth-auth">
    <div className="booth-auth__brand"><Brand /></div>
    <section className="booth-auth__card">
      <span className="booth-kicker"><ShieldCheck size={14} /> Staff only · สำหรับเจ้าหน้าที่</span>
      <h1>Registration booth</h1>
      <p>Sign in to capture participant documents at the registration table.</p>
      <form onSubmit={submit}>
        <label className="booth-field"><span>Email address</span><input name="email" type="email" autoComplete="email" required placeholder="staff@tu.ac.th" /></label>
        <label className="booth-field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required placeholder="••••••••••" /></label>
        {error && <div className="booth-alert booth-alert--error">{error}</div>}
        <button className="booth-primary" disabled={busy}>{busy ? <LoaderCircle className="booth-spinner" size={19} /> : "Sign in to booth"}</button>
      </form>
      <Link className="booth-back-link" href="/staff"><ArrowLeft size={15} /> Open full staff portal</Link>
    </section>
  </main>;
}

function BoothWorkspace() {
  const { signOut } = useAuthActions();
  const current = useQuery(api.participants.currentStaff);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<Id<"participants"> | null>(null);
  const [files, setFiles] = useState<SelectedFiles>({});
  const [previews, setPreviews] = useState<PreviewUrls>({});
  const previewRef = useRef<PreviewUrls>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  const searchTerm = search.trim();
  const isNumericSearch = /^\d+$/.test(searchTerm);
  const minimumSearchLength = isNumericSearch ? 5 : 2;
  const canSearch = Boolean(current && current.role !== "viewer" && searchTerm.length >= minimumSearchLength && !selectedId);
  const results = useQuery(api.participants.boothSearch, canSearch ? { search: searchTerm } : "skip");
  const detail = useQuery(api.participants.get, selectedId ? { participantId: selectedId } : "skip");
  const generateUploadUrl = useMutation(api.participants.generateStaffUploadUrl);
  const completeUpload = useMutation(api.participants.completeStaffUpload);

  useEffect(() => () => {
    Object.values(previewRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function clearFiles() {
    Object.values(previewRef.current).forEach((url) => URL.revokeObjectURL(url));
    previewRef.current = {};
    setPreviews({});
    setFiles({});
  }

  function startNext() {
    clearFiles();
    setSelectedId(null);
    setSearch("");
    setError("");
    setComplete(false);
  }

  function selectParticipant(id: Id<"participants">) {
    clearFiles();
    setSelectedId(id);
    setError("");
    setComplete(false);
  }

  function selectFile(kind: DocumentKind, file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Choose a JPG, PNG, or WebP image no larger than 10 MB.");
      return;
    }
    const oldPreview = previewRef.current[kind];
    if (oldPreview) URL.revokeObjectURL(oldPreview);
    const url = URL.createObjectURL(file);
    previewRef.current = { ...previewRef.current, [kind]: url };
    setPreviews({ ...previewRef.current });
    setFiles((currentFiles) => ({ ...currentFiles, [kind]: file }));
    setError("");
  }

  function removeFile(kind: DocumentKind) {
    const url = previewRef.current[kind];
    if (url) URL.revokeObjectURL(url);
    const nextPreviews = { ...previewRef.current };
    const nextFiles = { ...files };
    delete nextPreviews[kind];
    delete nextFiles[kind];
    previewRef.current = nextPreviews;
    setPreviews(nextPreviews);
    setFiles(nextFiles);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || Object.keys(files).length === 0) {
      setError("Capture or choose at least one document first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const uploadOne = async (kind: DocumentKind, file?: File) => {
        if (!file) return undefined;
        const compressed = await compressImage(file, kind);
        const url = await generateUploadUrl();
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": compressed.type }, body: compressed });
        if (!response.ok) throw new Error("One of the images could not be uploaded. Please try again.");
        return (await response.json()).storageId as Id<"_storage">;
      };
      const profilePhotoId = await uploadOne("profile", files.profile);
      const nationalIdImageId = await uploadOne("nationalId", files.nationalId);
      const studentIdImageId = await uploadOne("studentId", files.studentId);
      await completeUpload({ participantId: selectedId, profilePhotoId, nationalIdImageId, studentIdImageId, uploadedFromBooth: true });
      clearFiles();
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (current === undefined) return <BoothLoading />;
  if (current === null) return <AccessMessage title="Access unavailable" body="Your staff account is not active. Contact an administrator." onSignOut={() => void signOut()} />;
  if (current.role === "viewer") return <AccessMessage title="Upload access required" body="Viewer accounts cannot retrieve or upload identity documents. Ask an administrator for registrar access." onSignOut={() => void signOut()} />;

  const participant = detail?.participant;
  const existing = {
    profile: Boolean(participant?.profilePhotoId),
    nationalId: Boolean(participant?.nationalIdImageId),
    studentId: Boolean(participant?.studentIdImageId),
  };
  const readyCount = documentDetails.filter(({ kind }) => existing[kind] || files[kind]).length;

  return <main className="booth-page">
    <header className="booth-header">
      <Brand compact />
      <div className="booth-header__actions">
        <Link href="/staff" aria-label="Full staff portal"><Images size={18} /></Link>
        <button onClick={() => void signOut()} aria-label="Sign out"><LogOut size={18} /></button>
      </div>
    </header>

    {!selectedId && <section className="booth-search-screen">
      <div className="booth-greeting">
        <span className="booth-kicker"><span className="booth-live-dot" /> Booth mode</span>
        <h1>Find a participant</h1>
        <p>Search by student ID or registered name.</p>
      </div>
      <div className="booth-search">
        <Search size={20} />
        <input autoFocus inputMode="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student ID or name" aria-label="Search participants" />
        {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={17} /></button>}
      </div>
      <div className="booth-results" aria-live="polite">
        {searchTerm.length < minimumSearchLength && <div className="booth-search-hint"><Search size={27} /><strong>Ready for the next arrival</strong><span>{isNumericSearch ? "Enter at least 5 digits to search" : "Enter at least 2 characters to search"}</span></div>}
        {canSearch && results === undefined && <div className="booth-search-hint"><LoaderCircle className="booth-spinner" size={27} /><span>Searching participant records…</span></div>}
        {results?.map((person) => {
          const documentCount = [person.hasProfilePhoto, person.hasNationalId, person.hasStudentId].filter(Boolean).length;
          return <button className="booth-result" key={person._id} onClick={() => selectParticipant(person._id)}>
            <span className="booth-result__avatar">{initials(person.fullNameEnglish)}</span>
            <span className="booth-result__copy"><strong>{person.fullNameThai}</strong><span>{person.fullNameEnglish}</span><small>{person.studentId} · {person.sport}</small></span>
            <span className={`booth-result__count ${documentCount === 3 ? "is-complete" : ""}`}>{documentCount}/3</span>
            <ChevronRight size={18} />
          </button>;
        })}
        {results?.length === 0 && <div className="booth-search-hint"><UserRound size={28} /><strong>No participant found</strong><span>Check the ID or try a different spelling</span></div>}
      </div>
    </section>}

    {selectedId && !participant && <section className="booth-search-hint booth-search-hint--fill"><LoaderCircle className="booth-spinner" size={30} /><span>Loading participant…</span></section>}

    {participant && !complete && <section className="booth-capture-screen">
      <button className="booth-back" type="button" onClick={startNext}><ArrowLeft size={17} /> Back to search</button>
      <div className="booth-person-card">
        {detail.photoUrl ? <img src={detail.photoUrl} alt="" /> : <span className="booth-person-card__avatar">{initials(participant.fullNameEnglish)}</span>}
        <div><small>{participant.studentId}</small><h1>{participant.fullNameThai}</h1><p>{participant.fullNameEnglish}</p><span>{participant.sport} · {participant.faculty}</span></div>
      </div>
      <div className="booth-progress-head"><div><strong>Document set</strong><span>อัปโหลดเอกสาร</span></div><b>{readyCount} of 3 ready</b></div>
      <div className="booth-progress"><span style={{ width: `${(readyCount / 3) * 100}%` }} /></div>

      <form onSubmit={upload}>
        <div className="booth-document-list">
          {documentDetails.map((document) => <DocumentCapture
            key={document.kind}
            {...document}
            existing={existing[document.kind]}
            preview={previews[document.kind]}
            disabled={busy}
            onFile={(file) => selectFile(document.kind, file)}
            onRemove={() => removeFile(document.kind)}
          />)}
        </div>
        {error && <div className="booth-alert booth-alert--error">{error}</div>}
        <div className="booth-submit-bar">
          <div><small>New images</small><strong>{Object.keys(files).length} selected</strong></div>
          <button className="booth-primary" disabled={busy || Object.keys(files).length === 0}>{busy ? <><LoaderCircle className="booth-spinner" size={18} /> Uploading…</> : <><UploadCloud size={18} /> Save documents</>}</button>
        </div>
      </form>
    </section>}

    {participant && complete && <section className="booth-success">
      <div className="booth-success__mark"><Check size={34} /></div>
      <span className="booth-kicker">Upload complete</span>
      <h1>Documents saved</h1>
      <p>The new images have been added to <strong>{participant.fullNameThai}</strong>’s protected record.</p>
      <div className="booth-success__record"><FileCheck2 size={21} /><div><strong>{participant.studentId}</strong><span>{participant.sport} · {participant.faculty}</span></div><BadgeCheck size={20} /></div>
      <button className="booth-primary booth-primary--wide" onClick={startNext}><RotateCcw size={18} /> Next participant</button>
      <Link className="booth-back-link" href="/staff">Return to staff portal</Link>
    </section>}
  </main>;
}

function DocumentCapture({ title, thai, hint, capture, portrait, existing, preview, disabled, onFile, onRemove }: {
  kind: DocumentKind;
  title: string;
  thai: string;
  hint: string;
  capture: "user" | "environment";
  portrait?: boolean;
  existing: boolean;
  preview?: string;
  disabled: boolean;
  onFile: (file?: File) => void;
  onRemove: () => void;
}) {
  const inputId = `booth-${title.toLowerCase().replaceAll(" ", "-")}`;
  return <article className={`booth-document ${preview ? "has-preview" : ""}`}>
    <div className={`booth-document__visual ${portrait ? "is-portrait" : ""}`}>
      {preview ? <img src={preview} alt={`${title} preview`} /> : portrait ? <UserRound size={25} /> : <FileCheck2 size={25} />}
      {preview && <button type="button" onClick={onRemove} aria-label={`Remove ${title}`}><X size={14} /></button>}
    </div>
    <div className="booth-document__copy"><strong>{title}</strong><span>{thai}</span><small>{preview ? "New image ready" : existing ? "Already on file · replace if needed" : hint}</small></div>
    <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" capture={capture} disabled={disabled} onChange={(event) => onFile(event.target.files?.[0])} />
    <label htmlFor={inputId} className={preview ? "is-ready" : ""}>{preview ? <Check size={17} /> : <Camera size={17} />}<span>{preview ? "Ready" : existing ? "Replace" : "Capture"}</span></label>
  </article>;
}

function AccessMessage({ title, body, onSignOut }: { title: string; body: string; onSignOut: () => void }) {
  return <main className="booth-center"><section className="booth-access"><ShieldCheck size={31} /><h1>{title}</h1><p>{body}</p><button className="booth-primary booth-primary--wide" onClick={onSignOut}>Sign out</button></section></main>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FG";
}
