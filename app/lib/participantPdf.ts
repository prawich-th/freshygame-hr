import { participantKind } from "@/shared/participantKinds";
import type { Doc } from "@/convex/_generated/dataModel";

export type ParticipantPdfEntry = {
  participant: Doc<"participants">;
  photoUrl: string | null;
  nationalIdImageUrl: string | null;
  studentIdImageUrl: string | null;
};

type FontData = { regular: string; bold: string };

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

async function loadFonts(supplied?: FontData): Promise<FontData> {
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

async function imageData(url: string | null) {
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

export async function generateParticipantPdf(
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

    pdf.setTextColor(0, 0, 0);
    pdf.setDrawColor(155, 155, 155);
    pdf.setLineWidth(0.18);

    pdf.setFont("THSarabunNew", "normal");
    pdf.setFontSize(17);
    pdf.text("คณะทำงานทีมสีน้ำตาล", 105, 16, { align: "center" });
    pdf.text(`เอกสารหมายเลข ${participantKind(participant) === "support" ? 3 : participantKind(participant) === "performer" ? 2 : 1}`, 192, 16, { align: "right" });
    pdf.text("โครงการ TU Freshy Game 2026", 105, 24, { align: "center" });
    pdf.setFont("THSarabunNew", "bold");
    pdf.setFontSize(20);
    pdf.text(participantKind(participant) === "support" ? "แบบรายงานบันทึกข้อมูลทีมสนับสนุน" : participant.participantKind === "performer" ? "แบบรายงานบันทึกข้อมูลผู้แสดง" : "แบบรายงานบันทึกข้อมูลผู้เข้าร่วมการแข่งขัน", 105, 36, { align: "center" });

    const profileX = 18;
    const profileY = 46;
    const profileWidth = 39;
    const profileHeight = 52;
    pdf.rect(profileX, profileY, profileWidth, profileHeight);
    if (profile) addContainedImage(pdf, profile, profileX + 0.8, profileY + 0.8, profileWidth - 1.6, profileHeight - 1.6);
    else profilePlaceholder(pdf, profileX, profileY, profileWidth, profileHeight);

    const tableX = 59.5;
    const tableY = 46;
    const tableWidth = 132.5;
    const rowHeight = 10.4;
    pdf.rect(tableX, tableY, tableWidth, rowHeight * 5);
    for (let row = 1; row < 5; row += 1) pdf.line(tableX, tableY + rowHeight * row, tableX + tableWidth, tableY + rowHeight * row);

    const labelWidth = 24;
    const thaiNameWidth = 61;
    const nicknameLabelWidth = 23;
    pdf.line(tableX + labelWidth, tableY, tableX + labelWidth, tableY + rowHeight * 5);
    pdf.line(tableX + labelWidth + thaiNameWidth, tableY, tableX + labelWidth + thaiNameWidth, tableY + rowHeight * 3);
    pdf.line(tableX + labelWidth + thaiNameWidth + nicknameLabelWidth, tableY, tableX + labelWidth + thaiNameWidth + nicknameLabelWidth, tableY + rowHeight * 3);

    tableText(pdf, "รหัสนักศึกษา", tableX + 1.5, tableY + 6.9, labelWidth - 3);
    tableText(pdf, participant.studentId, tableX + labelWidth + 1.5, tableY + 6.9, thaiNameWidth - 3);
    tableText(pdf, "ลำดับที่", tableX + labelWidth + thaiNameWidth + 1.5, tableY + 6.9, nicknameLabelWidth - 3);
    tableText(pdf, String(participant.orderNumber ?? index + 1), tableX + labelWidth + thaiNameWidth + nicknameLabelWidth + 1.5, tableY + 6.9, tableWidth - labelWidth - thaiNameWidth - nicknameLabelWidth - 3);

    tableText(pdf, "ชื่อ-สกุล", tableX + 1.5, tableY + rowHeight + 6.9);
    tableText(pdf, participant.fullNameThai || "-", tableX + labelWidth + 1.5, tableY + rowHeight + 6.9, thaiNameWidth - 3);
    tableText(pdf, "ชื่อเล่น", tableX + labelWidth + thaiNameWidth + 1.5, tableY + rowHeight + 6.9);
    tableText(pdf, participant.nicknameThai || "-", tableX + labelWidth + thaiNameWidth + nicknameLabelWidth + 1.5, tableY + rowHeight + 6.9, tableWidth - labelWidth - thaiNameWidth - nicknameLabelWidth - 3);

    tableText(pdf, "Full Name", tableX + 1.5, tableY + rowHeight * 2 + 6.9);
    tableText(pdf, participant.fullNameEnglish || "-", tableX + labelWidth + 1.5, tableY + rowHeight * 2 + 6.9, thaiNameWidth - 3);
    tableText(pdf, "Nickname", tableX + labelWidth + thaiNameWidth + 1.5, tableY + rowHeight * 2 + 6.9);
    tableText(pdf, participant.nicknameEnglish || "-", tableX + labelWidth + thaiNameWidth + nicknameLabelWidth + 1.5, tableY + rowHeight * 2 + 6.9, tableWidth - labelWidth - thaiNameWidth - nicknameLabelWidth - 3);

    tableText(pdf, "โทร", tableX + 1.5, tableY + rowHeight * 3 + 6.9);
    tableText(pdf, participant.phone || "-", tableX + labelWidth + 1.5, tableY + rowHeight * 3 + 6.9, tableWidth - labelWidth - 3);
    tableText(pdf, "คณะ", tableX + 1.5, tableY + rowHeight * 4 + 6.9);
    tableText(pdf, participant.faculty || "-", tableX + labelWidth + 1.5, tableY + rowHeight * 4 + 6.9, tableWidth - labelWidth - 3);

    simpleTableRow(pdf, participantKind(participant) === "support" ? "ทีมสนับสนุน" : participant.participantKind === "performer" ? "รายการแสดง" : "รายการกีฬา", participantKind(participant) === "support" ? "Support team" : participant.sport || "-", 18, 108, 174, 10.5, 36);
    simpleTableRow(pdf, "ประเภทผู้เข้าร่วม", participantKind(participant) === "support" ? participant.category || "Support team" : participant.participantKind === "performer" ? "Performer" : participant.category || "Athlete / Participant", 18, 118.5, 174, 10.5, 36);

    pdf.setFont("THSarabunNew", "normal");
    pdf.setFontSize(17);
    pdf.text("เอกสารยืนยันตัวตน", 105, 137, { align: "center" });
    documentPanel(pdf, "บัตรประจำตัวประชาชน", nationalId, 18, 141, 87, 109);
    documentPanel(pdf, "บัตรประจำตัวนักศึกษา", studentId, 105, 141, 87, 109);

    pdf.setFont("THSarabunNew", "normal");
    pdf.setFontSize(15);
    pdf.setTextColor(0, 0, 0);
    pdf.text("เอกสารนี้ออกโดยระบบอัตโนมัติ ไม่ต้องมีลายมือชื่อกำกับ", 105, 285, { align: "center" });
  }

  if (options?.save !== false) {
    pdf.save(`${filename.replace(/[^a-zA-Z0-9ก-๙_-]+/g, "-")}.pdf`);
  }
  return pdf.output("arraybuffer");
}

type Pdf = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

function tableText(pdf: Pdf, value: string, x: number, y: number, maxWidth = 100) {
  pdf.setFont("THSarabunNew", "normal");
  const baseSize = 14;
  pdf.setFontSize(baseSize);
  const measuredWidth = pdf.getTextWidth(value);
  if (measuredWidth > maxWidth) pdf.setFontSize(Math.max(9, baseSize * maxWidth / measuredWidth));
  pdf.setTextColor(0, 0, 0);
  pdf.text(value, x, y);
}

function simpleTableRow(pdf: Pdf, label: string, value: string, x: number, y: number, width: number, height: number, labelWidth: number) {
  pdf.setDrawColor(155, 155, 155);
  pdf.rect(x, y, width, height);
  pdf.line(x + labelWidth, y, x + labelWidth, y + height);
  tableText(pdf, label, x + 1.5, y + 7, labelWidth - 3);
  tableText(pdf, value, x + labelWidth + 1.5, y + 7, width - labelWidth - 3);
}

function documentPanel(pdf: Pdf, label: string, data: string | null, x: number, y: number, width: number, height: number) {
  const headerHeight = 10;
  pdf.setDrawColor(155, 155, 155);
  pdf.rect(x, y, width, height);
  pdf.line(x, y + headerHeight, x + width, y + headerHeight);
  pdf.setFont("THSarabunNew", "normal");
  pdf.setFontSize(15);
  pdf.setTextColor(0, 0, 0);
  pdf.text(label, x + width / 2, y + 6.8, { align: "center" });
  if (data) addContainedImage(pdf, data, x + 1.5, y + headerHeight + 1.5, width - 3, height - headerHeight - 3);
  else placeholder(pdf, "ยังไม่ได้ส่งเอกสาร", x, y + headerHeight, width, height - headerHeight);
}

function placeholder(pdf: Pdf, label: string, x: number, y: number, width: number, height: number) {
  pdf.setFont("THSarabunNew", "normal");
  pdf.setFontSize(14);
  pdf.setTextColor(105, 105, 105);
  pdf.text(label, x + width / 2, y + height / 2, { align: "center" });
}

function profilePlaceholder(pdf: Pdf, x: number, y: number, width: number, height: number) {
  pdf.setFillColor(0, 0, 0);
  pdf.rect(x, y, width, height, "F");
  pdf.setFont("THSarabunNew", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Profile picture", x + width / 2, y + height / 2, { align: "center" });
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
