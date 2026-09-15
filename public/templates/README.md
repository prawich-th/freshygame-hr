# Official athlete form

`athlete-official.pdf` is the original five-page `Format_ข้อมูลรายชื่อนักกีฬา.pdf` supplied for Freshy Games 2569. It has no interactive form fields. Keep this file unchanged: `app/lib/athletePdf.ts` copies its vector pages and adds text/photo overlays in its native 595 × 842 point coordinate system.

- Sport export: pages 1–3 (12 + 12 + 6 photo slots), page 4 (25 roster rows), continuation sheets when needed, then page 5 once per Student ID.
- Individual/bulk personal export: page 5 once per Student ID; the sport blank contains sport names with categories in parentheses. The bottom contains the student ID image with crossing lines, สำเนาถูกต้อง, and the saved signature when available. Selected sports are combined for people with multiple registrations.
- Missing values remain blank. Coach/coordinator details are not currently stored and are left for manual completion. No signatures or qualifications are inferred.
- Other participant roles keep the existing participant report.

Run `bun scripts/check-athlete-pdf.ts` for generation checks and `bun scripts/render-pdf-sample.ts` for the synthetic visual sample. The original form and fonts are served from public assets; participant data stays in the existing staff export flow.
