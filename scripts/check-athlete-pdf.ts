import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { jsPDF } from "jspdf";
import { athleteFormGroups } from "../app/lib/athletePdf";
import { drawSignature, generateParticipantPdf, type ParticipantPdfEntry } from "../app/lib/participantPdf";

const options = {
  save: false,
  template: await readFile("public/templates/athlete-official.pdf"),
  fonts: {
    regular: (await readFile("public/fonts/THSarabunNew.ttf")).toString("base64"),
    bold: (await readFile("public/fonts/THSarabunNew-Bold.ttf")).toString("base64"),
  },
};
const entry = (index: number, sport = "Badminton"): ParticipantPdfEntry => ({
  participant: {
    _id: `test-${index}-${sport}`, _creationTime: 0, studentId: String(6900000000 + index),
    fullNameThai: `ทดสอบ นามสกุล${index}`, fullNameEnglish: `Sample Person ${index}`,
    faculty: "คณะศิลปศาสตร์", sport, participantKind: "athlete", status: "pending",
    source: "import", updatedAt: 0, orderNumber: index, jerseyNumber: String(index),
  } as ParticipantPdfEntry["participant"],
  photoUrl: null, nationalIdImageUrl: null, studentIdImageUrl: null,
});
const count = async (bytes: ArrayBuffer) => (await PDFDocument.load(bytes)).getPageCount();
assert.equal(await count(await generateParticipantPdf([entry(1)], "test", options)), 1);
assert.equal(await count(await generateParticipantPdf([entry(1)], "test", { ...options, includeSportSheets: true })), 5);
const multiple = [entry(2), entry(1, "Swimming"), entry(1), entry(1, "BD")];
const groups = athleteFormGroups(multiple);
assert.equal(groups.sports.size, 2);
assert.equal(groups.sports.get("Badminton")?.length, 2);
assert.equal(groups.sports.get("Badminton")?.[0].participant.studentId, "6900000001");
assert.equal(await count(await generateParticipantPdf(multiple, "test", options)), 2);
assert.equal(await count(await generateParticipantPdf(multiple, "test", { ...options, includeSportSheets: true })), 10);
const large = await generateParticipantPdf(Array.from({ length: 31 }, (_, i) => entry(i + 1)), "test", { ...options, includeSportSheets: true });
assert.equal(await count(large), 37); // Four source sheets, two overflow sheets, 31 people.
const performer = entry(40, "Cheerleader");
performer.participant.participantKind = "performer";
assert.equal(await count(await generateParticipantPdf([entry(1), performer], "test", options)), 2);
await assert.rejects(() => generateParticipantPdf([], "test", options), /No participants/);
const long = entry(1);
long.participant.medicalConditions = "Long medical history ".repeat(200);
await assert.rejects(() => generateParticipantPdf([long], "test", options), /too long/);
const broken = entry(1);
broken.photoUrl = "data:image/png;base64,invalid";
await assert.rejects(() => generateParticipantPdf([broken], "test", { ...options, includeSportSheets: true }));
const brokenCard = entry(1);
brokenCard.studentIdImageUrl = "data:image/png;base64,invalid";
await assert.rejects(() => generateParticipantPdf([brokenCard], "test", options));
const signed = entry(1);
signed.participant.signedName = "SAVED SIGNER";
signed.participant.signature = [[{ x: 40, y: 120 }, { x: 80, y: 30 }, { x: 180, y: 100 }]];
for (const unit of ["pt", "mm"] as const) {
  const pdf = new jsPDF({ unit });
  assert.equal(drawSignature(pdf, signed.participant, 20, 20, 50, 20), true);
  assert.ok(Math.abs(pdf.getLineWidth() * pdf.internal.scaleFactor - 1) < 0.001);
  assert.equal(drawSignature(pdf, entry(1).participant, 20, 20, 50, 20), false);
  assert.equal(drawSignature(pdf, { ...signed.participant, signature: [[{ x: 1, y: 1 }], [{ x: 5, y: 5 }]] }, 20, 20, 50, 20), false);
  assert.equal(drawSignature(pdf, { ...signed.participant, signature: [[{ x: NaN, y: 1 }, { x: 5, y: 5 }]] }, 20, 20, 50, 20), false);
}
await mkdir("tmp/pdfs", { recursive: true });
await writeFile("tmp/pdfs/athlete-overflow-check.pdf", new Uint8Array(large));
await writeFile("tmp/pdfs/athlete-signed-no-card.pdf", new Uint8Array(await generateParticipantPdf([signed], "test", options)));
await writeFile("tmp/pdfs/athlete-unsigned.pdf", new Uint8Array(await generateParticipantPdf([entry(1)], "test", options)));
console.log("Athlete PDF checks passed: signatures with missing cards, unit-independent ink thickness, missing/invalid ink, original pages, overflow, deduplication, sorting, mixed roles, empty input, oversized fields, and image failures.");
