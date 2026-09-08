"use client";

import { errorMessage } from "./lib/errors";

export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="auth-page"><section className="auth-card" role="alert">
    <h1>This page could not load</h1>
    <p>{errorMessage(error, "Load this page")}</p>
    <button className="button button--primary" onClick={retry}>Try again</button>
  </section></main>;
}
