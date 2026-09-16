"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "../lib/errors";

export function SyncRecords() {
  const sync = useMutation(api.recordSync.batch);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  async function run() {
    setBusy(true); setFailed(false); setConflicts([]);
    let cursor: string | null = null;
    let checked = 0, updated = 0;
    const skipped = new Set<string>();
    try {
      setMessage("Checking registrations… Keep this page open until the sync finishes.");
      while (true) {
        const result: FunctionReturnType<typeof api.recordSync.batch> = await sync({ cursor });
        checked += result.checked; updated += result.updated;
        result.conflicts.forEach(id => skipped.add(id));
        setConflicts([...skipped]);
        setMessage(`${checked} records checked · ${updated} records updated${result.done ? ". Sync complete." : ". Syncing…"}`);
        if (result.done) break;
        cursor = result.cursor;
      }
    } catch (error) { setFailed(true); setMessage(`${checked} records checked · ${updated} records updated. ${errorMessage(error, "Sync records")} You can run sync again to continue checking.`); }
    finally { setBusy(false); }
  }
  return <div className="record-sync">
    <button type="button" className="button button--soft" disabled={busy} onClick={() => void run()} title="Check all registrations and fill missing photos, files, and signatures from matching Student IDs"><RefreshCw size={15} />{busy ? "Syncing records…" : "Check & sync records"}</button>
    {message && <div className={`notice ${failed ? "notice--error" : "notice--info"}`} role="status">{message}{conflicts.length > 0 && <p>Review needed for {conflicts.length} Student IDs (conflicting files/signatures, missing files, or open corrections): {conflicts.join(", ")}. These records were left unchanged.</p>}</div>}
  </div>;
}
