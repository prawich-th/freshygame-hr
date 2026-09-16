import { ageOnDate } from "@/shared/personalInformation";
import { categoryLabel } from "@/shared/participantCategories";
import { participantKind } from "@/shared/participantKinds";
import type { Doc } from "@/convex/_generated/dataModel";

export type ParticipantPdfEntry = {
  participant: Doc<"participants">;
  photoUrl: string | null;
  nationalIdImageUrl: string | null;
  studentIdImageUrl: string | null;
};

export type FontData = { regular: string; bold: string };

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

export async function loadFonts(supplied?: FontData): Promise<FontData> {
  if (supplied) return supplied;
  const [regular, bold] = await Promise.all([
    fetch("/fonts/THSarabunNew.ttf").then((response) => {
      if (!response.ok) throw new Error("Unable to load TH Sarabun New");
      return response.arrayBuffer();
    }),
    fetch("/fonts/THSarabunNew-Bold.ttf").then((response) => {
      if (!response.ok) throw new Error("Unable to load TH Sarabun New Bold");
      return response.arrayBuffer();
    }),
  ]);
  return { regular: arrayBufferToBase64(regular), bold: arrayBufferToBase64(bold) };
}

export async function imageData(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (typeof document === "undefined") {
      return `data:${blob.type || "image/jpeg"};base64,${arrayBufferToBase64(await blob.arrayBuffer())}`;
    }
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Image decode failed"));
        image.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.92);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

export type ParticipantPdfOptions = {
  fonts?: FontData;
  save?: boolean;
  includeSportSheets?: boolean;
  template?: Uint8Array;
};

export async function generateParticipantPdf(entries: ParticipantPdfEntry[], filename: string, options?: ParticipantPdfOptions) {
  if (!entries.length) throw new Error("No participants to export.");
  const athletes = entries.filter(entry => participantKind(entry.participant) === "athlete");
  if (!athletes.length) return generateLegacyParticipantPdf(entries, filename, options);
  const { generateAthletePdf } = await import("./athletePdf");
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await generateAthletePdf(athletes, options);
  const others = entries.filter(entry => participantKind(entry.participant) !== "athlete");
  let result = bytes;
  if (others.length) {
    const document = await PDFDocument.load(bytes);
    const other = await PDFDocument.load(await generateLegacyParticipantPdf(others, filename, { ...options, save: false }));
    for (const page of await document.copyPages(other, other.getPageIndices())) document.addPage(page);
    result = await document.save();
  }
  const buffer = new Uint8Array(result).buffer;
  if (options?.save !== false) {
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename.replace(/[^a-zA-Z0-9ก-๙_-]+/g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return buffer;
}

async function generateLegacyParticipantPdf(
  entries: ParticipantPdfEntry[],
  filename: string,
  options?: { fonts?: FontData; save?: boolean },
) {
  const [{ jsPDF }, fonts] = await Promise.all([import("jspdf"), loadFonts(options?.fonts)]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addFileToVFS("THSarabunNew.ttf", fonts.regular);
  pdf.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
  pdf.addFileToVFS("THSarabunNew-Bold.ttf", fonts.bold);
  pdf.addFont("THSarabunNew-Bold.ttf", "THSarabunNew", "bold");
  pdf.setProperties({ title: filename, subject: "Freshy Game 2026 participant record", creator: "Freshy Game Human Resource" });
  const orderedEntries = entries
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .sort((left, right) => {
      const leftOrder = left.entry.participant.orderNumber;
      const rightOrder = right.entry.participant.orderNumber;
      if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
      if (leftOrder !== undefined) return -1;
      if (rightOrder !== undefined) return 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ entry }) => entry);

  for (let index = 0; index < orderedEntries.length; index += 1) {
    if (index > 0) pdf.addPage("a4", "portrait");
    const entry = orderedEntries[index];
    const participant = entry.participant;
    const [profile, nationalId, studentId] = await Promise.all([
      imageData(entry.photoUrl), imageData(entry.nationalIdImageUrl), imageData(entry.studentIdImageUrl),
    ]);

    const kind = participantKind(participant);
    const title = kind === "athlete" ? "รายงานข้อมูลนักกีฬา" : kind === "performer" ? "รายงานข้อมูลผู้แสดง" : "รายงานข้อมูลทีมสนับสนุน";
    pdf.setDrawColor(175, 175, 175); pdf.setLineWidth(0.15);
    pdf.rect(14, 9, 182, 17);
    pdf.line(153, 9, 153, 26);
    textBox(pdf, `${title} Freshy Game 2026`, 17, 10, 133, 8, 18, true, "center");
    textBox(pdf, "คณะสีน้ำตาล", 17, 18, 133, 7, 15, false, "center");
    textBox(pdf, `เอกสาร อส.บ.0${kind === "athlete" ? 1 : kind === "performer" ? 2 : 3}`, 154, 10, 41, 7, 13, false, "center");
    textBox(pdf, `ลำดับในคณะสี ${String(participant.orderNumber ?? index + 1).padStart(2, "0")}`, 154, 18, 41, 7, 13, false, "center");
    textBox(pdf, kind === "athlete" ? "1. ข้อมูลนักกีฬา" : "1. ข้อมูลผู้เข้าร่วม", 14, 27, 182, 7, 15, true);
    let y = 35;
    const row = (cells: [string, number][], height = 8, shaded = false) => {
      let x = 14;
      for (const [value, width] of cells) { cell(pdf, value, x, y, width, height, shaded); x += width; }
      y += height;
    };
    row([["ชื่อ-สกุล", 27], [participant.fullNameThai || "-", 92], ["ชื่อเล่น", 21], [participant.nicknameThai || "-", 42]]);
    row([["Full name", 27], [participant.fullNameEnglish || "-", 92], ["Nickname", 21], [participant.nicknameEnglish || "-", 42]], 8, true);
    row([["รหัสนักศึกษา", 27], [participant.studentId, 64], ["เพศ", 25], [participant.sex || "-", 66]]);
    row([["รหัสประชาชน", 27], [participant.nationalIdNumber || "-", 155]], 8, true);
    const birthDate = participant.birthDate ? participant.birthDate.split("-").reverse().join("/") + " (ค.ศ.)" : "-";
    const age = participant.birthDate ? ageOnDate(participant.birthDate) : participant.age;
    row([["เกิดวันที่", 27], [birthDate, 64], ["อายุ", 25], [age == null ? "-" : `${age} ปี`, 66]]);
    row([["คณะ", 27], [participant.faculty || "-", 92], ["โทร", 21], [participant.phone || "-", 42]], 8, true);
    y += 2;
    row([["ประเภทนักกีฬา", 34], [participant.qualificationCriteria || "ยังไม่ได้ระบุ", 148]]);
    row([["เข้าข่ายเนื่องจาก", 34], [[participant.qualificationDetails, participant.eligibilityCertification].filter(Boolean).join(" / ") || "ยังไม่ได้ระบุ", 148]], 8, true);
    y += 2;
    row([[kind === "athlete" ? "กีฬา" : "กิจกรรม", 21], [participant.sport || "-", 48], ["ประเภท", 21], [categoryLabel(participant) || "-", 60], ["เลขเสื้อ", 17], [participant.jerseyNumber || "-", 15]]);
    textBox(pdf, "2. ข้อมูลผู้ติดต่อฉุกเฉิน", 14, y + 3, 182, 7, 15, true);
    y += 11;
    // Contact name and relationship have not been collected; never infer them from the participant.
    row([["ชื่อผู้ติดต่อ", 27], ["ยังไม่ได้ระบุ", 74], ["เกี่ยวข้อง", 26], ["ผู้ปกครอง", 55]]);
    row([["โทรผู้ปกครอง", 27], [participant.guardianPhone || "ยังไม่ได้ระบุ", 155]], 8, true);

    y += 2;
    const health: [string, string][] = [
      ["โรคประจำตัว", participant.medicalConditions || "ยังไม่ได้ระบุ"],
      ["ประวัติการแพ้ยา", participant.drugAllergies || "ยังไม่ได้ระบุ"],
      ["ประวัติการแพ้อาหาร", participant.foodAllergies || "ยังไม่ได้ระบุ"],
      ["ประวัติการเข้าโรงพยาบาล / การผ่าตัด", participant.hospitalizationHistory || "ยังไม่ได้ระบุ"],
      ...(participant.allergies ? [["ข้อมูลการแพ้ที่บันทึกไว้เดิม", participant.allergies] as [string, string]] : []),
    ];
    // Share the available space between medical rows, keeping every value intact.
    const available = 180 - y;
    let fontSize = 13;
    let heights: number[] = [];
    for (; fontSize >= 8; fontSize -= 0.5) {
      pdf.setFont("THSarabunNew", "normal"); pdf.setFontSize(fontSize);
      heights = health.map(([label, value]) => Math.max(8, Math.max(pdf.splitTextToSize(label, 54).length, pdf.splitTextToSize(value, 122).length) * fontSize * 0.3528 * 1.1 + 3));
      if (heights.reduce((sum, height) => sum + height, 0) <= available) break;
    }
    if (fontSize < 8) throw new Error(`Medical history for ${participant.studentId} is too long for a readable one-page form. Please shorten the medical notes before exporting.`);
    health.forEach(([label, value], rowIndex) => {
      cell(pdf, label, 14, y, 58, heights[rowIndex], rowIndex % 2 === 1, fontSize);
      cell(pdf, value, 72, y, 124, heights[rowIndex], rowIndex % 2 === 1, fontSize);
      y += heights[rowIndex];
    });

    // Keep the reference form's photo / document copies / applicant certification
    // together in three columns, with ample room reserved for the evidence images.
    const imageY = 189;
    textBox(pdf, "รูปถ่าย", 14, imageY - 8, 32, 8, 14, false, "center");
    if (profile) addContainedImage(pdf, profile, 14, imageY, 32, 45);
    else profilePlaceholder(pdf, 14, imageY, 32, 45);
    compactDocument(pdf, "บัตรนักศึกษา", studentId, 51, imageY, 79, 42);
    compactDocument(pdf, "บัตรประชาชน", nationalId, 51, 239, 79, 42);
    const signatureX = 135;
    const signatureWidth = 61;
    pdf.setDrawColor(175, 175, 175); pdf.setLineWidth(0.15);
    pdf.rect(signatureX, imageY, signatureWidth, 92);
    pdf.setFillColor(245, 245, 245); pdf.rect(signatureX, imageY, signatureWidth, 10, "FD");
    textBox(pdf, "การรับรองข้อมูลและสำเนา", signatureX + 2, imageY + 1, signatureWidth - 4, 8, 15, true, "center");
    textBox(pdf, "ขอรับรองว่าเป็นความจริงทุกประการ", signatureX + 3, 202, signatureWidth - 6, 12, 14, false, "center");
    textBox(pdf, "สำเนาถูกต้อง\nใช้สำหรับการแข่งขันกีฬา\nTU Freshy Games 2026", signatureX + 3, 215, signatureWidth - 6, 19, 14, false, "center");
    drawSignature(pdf, participant, 140, 237, 51, 16);
    pdf.setDrawColor(175, 175, 175); pdf.setLineWidth(0.15);
    pdf.line(signatureX + 6, 255, signatureX + signatureWidth - 6, 255);
    textBox(pdf, `(${participant.signedName || participant.fullNameThai || "-"})`, signatureX + 2, 257, signatureWidth - 4, 9, 14, false, "center");
    textBox(pdf, participant.signature?.length ? "ผู้สมัคร / ผู้รับรองสำเนา" : "ยังไม่ได้ลงลายมือชื่อ", signatureX + 2, 266, signatureWidth - 4, 7, 13, false, "center");
    const signedDate = participant.signedAt ? new Date(participant.signedAt).toLocaleDateString("th-TH", {timeZone: "Asia/Bangkok"}) : "";
    if (signedDate) textBox(pdf, signedDate, signatureX + 2, 273, signatureWidth - 4, 7, 13, false, "center");
    textBox(pdf, "ออกโดยกองอำนวยการคณะสีน้ำตาล", 14, 283, 182, 7, 13, false, "center");
  }

  if (options?.save !== false) {
    pdf.save(`${filename.replace(/[^a-zA-Z0-9ก-๙_-]+/g, "-")}.pdf`);
  }
  return pdf.output("arraybuffer");
}

type Pdf = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

// Fit text without clipping or silently dropping information. Oversized inputs fail
// with an actionable message rather than creating extra pages or unreadable text.
function textBox(pdf: Pdf, value: string, x: number, y: number, width: number, height: number, size = 13, bold = false, align: "left" | "center" = "left") {
  pdf.setFont("THSarabunNew", bold ? "bold" : "normal");
  let lines: string[] = [];
  for (; size >= 8; size -= 0.5) {
    pdf.setFontSize(size);
    lines = pdf.splitTextToSize(value, width - 3);
    if (lines.length * size * 0.3528 * 1.1 <= height - 2) break;
  }
  if (size < 8) throw new Error("A field is too long for the one-page form. Please shorten the record before exporting.");
  pdf.setTextColor(0, 0, 0);
  const lineHeight = size * 0.3528 * 1.1;
  const firstBaseline = y + (height - lines.length * lineHeight) / 2 + lineHeight * 0.78;
  lines.forEach((line, index) => pdf.text(line, align === "center" ? x + width / 2 : x + 1.5, firstBaseline + index * lineHeight, {align}));
}

function cell(pdf: Pdf, value: string, x: number, y: number, width: number, height: number, shaded: boolean, size = 13) {
  pdf.setDrawColor(175, 175, 175); pdf.setLineWidth(0.15);
  if (shaded) { pdf.setFillColor(245, 245, 245); pdf.rect(x, y, width, height, "FD"); }
  else pdf.rect(x, y, width, height);
  textBox(pdf, value, x, y, width, height, size);
}

export function drawSignature(pdf: Pdf, participant: Doc<"participants">, x: number, y: number, width: number, height = width * 0.3) {
  const strokes = (participant.signature ?? []).filter(stroke =>
    stroke.length > 1 && stroke.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)) &&
    stroke.some(point => point.x !== stroke[0].x || point.y !== stroke[0].y),
  );
  const points = strokes.flat();
  if (points.length < 2) return false;
  // Center the actual ink, rather than the blank margins of the capture canvas.
  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const inkWidth = Math.max(1, Math.max(...points.map(point => point.x)) - minX);
  const inkHeight = Math.max(1, Math.max(...points.map(point => point.y)) - minY);
  const scale = Math.min(width / inkWidth, height / inkHeight);
  const left = x + (width - inkWidth * scale) / 2;
  const top = y + (height - inkHeight * scale) / 2;
  // Keep the same visible stroke thickness in the mm report and the pt official form.
  pdf.setDrawColor(25, 25, 25); pdf.setLineWidth(1 / pdf.internal.scaleFactor);
  pdf.setLineCap("round"); pdf.setLineJoin("round");
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) pdf.line(left + (stroke[i - 1].x - minX) * scale, top + (stroke[i - 1].y - minY) * scale, left + (stroke[i].x - minX) * scale, top + (stroke[i].y - minY) * scale);
  }
  return true;
}

function compactDocument(pdf: Pdf, label: string, data: string | null, x: number, y: number, width: number, height: number) {
  textBox(pdf, label, x, y - 8, width, 8, 14, false, "center");
  pdf.setDrawColor(175, 175, 175); pdf.setLineWidth(0.15); pdf.rect(x, y, width, height);
  if (data) addContainedImage(pdf, data, x + 0.5, y + 0.5, width - 1, height - 1);
  else textBox(pdf, "ยังไม่ได้ส่งเอกสาร", x, y + height / 2 - 4, width, 8, 12, false, "center");
  if (data) {
    pdf.setDrawColor(30, 30, 30); pdf.setLineWidth(0.3);
    pdf.line(x + width * 0.63, y + height, x + width * 0.87, y);
    pdf.line(x + width * 0.70, y + height, x + width * 0.94, y);
  }
}

function profilePlaceholder(pdf: Pdf, x: number, y: number, width: number, height: number) {
  pdf.setFillColor(0, 0, 0);
  pdf.rect(x, y, width, height, "F");
  pdf.setFont("THSarabunNew", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Profile", x + width / 2, y + height / 2, { align: "center" });
}

function addContainedImage(pdf: Pdf, data: string, x: number, y: number, width: number, height: number) {
  try {
    const properties = pdf.getImageProperties(data);
    const scale = Math.min(width / properties.width, height / properties.height);
    const imageWidth = properties.width * scale;
    const imageHeight = properties.height * scale;
    pdf.addImage(data, x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight, undefined, "NONE");
  } catch {
    // Keep the official document usable even when a remote image is unavailable.
  }
}
