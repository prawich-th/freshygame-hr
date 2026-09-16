import { PDFDocument } from "pdf-lib";
import { jsPDF } from "jspdf";
import { ageOnDate } from "@/shared/personalInformation";
import { findSport, normalizeSport } from "@/shared/sports";
import { categoryLabel } from "@/shared/participantCategories";
import { drawSignature, imageData, loadFonts, type ParticipantPdfEntry, type ParticipantPdfOptions } from "./participantPdf";

// Coordinates use the supplied PDF's native 595 × 842 pt page, measured from the top.
const WIDTH = 595;
const HEIGHT = 842;
const sportName = (value: string) => findSport(value)?.thai ?? value;
const name = (entry: ParticipantPdfEntry) => entry.participant.fullNameThai || entry.participant.fullNameEnglish || "";

export function athleteFormGroups(entries: ParticipantPdfEntry[]) {
  const ordered = [...entries].sort((a, b) => (a.participant.orderNumber ?? Infinity) - (b.participant.orderNumber ?? Infinity));
  const sports = new Map<string, ParticipantPdfEntry[]>();
  const people = new Map<string, ParticipantPdfEntry[]>();
  for (const entry of ordered) {
    const sport = normalizeSport(entry.participant.sport);
    const team = sports.get(sport) ?? [];
    if (!team.some(person => person.participant.studentId === entry.participant.studentId)) team.push(entry);
    sports.set(sport, team);
    const registrations = people.get(entry.participant.studentId) ?? [];
    registrations.push(entry);
    people.set(entry.participant.studentId, registrations);
  }
  return { sports, people };
}

export async function generateAthletePdf(entries: ParticipantPdfEntry[], options?: ParticipantPdfOptions) {
  const [templateBytes, fonts] = await Promise.all([
    options?.template ?? fetch("/templates/athlete-official.pdf").then(response => {
      if (!response.ok) throw new Error("Unable to load the official athlete form. Please retry.");
      return response.arrayBuffer();
    }),
    loadFonts(options?.fonts),
  ]);
  const template = await PDFDocument.load(templateBytes);
  if (template.getPageCount() !== 5) throw new Error("The official athlete template must have five pages.");
  const output = await PDFDocument.create();
  output.setTitle("Freshy Games 2569 - official athlete forms");
  const { sports, people } = athleteFormGroups(entries);

  async function page(index: number, fill: (overlay: jsPDF) => void | Promise<void>) {
    const [background] = await output.copyPages(template, [index]);
    const overlay = new jsPDF({ unit: "pt", format: [WIDTH, HEIGHT], compress: true });
    overlay.addFileToVFS("THSarabunNew.ttf", fonts.regular);
    overlay.addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
    overlay.setFont("THSarabunNew", "normal");
    await fill(overlay);
    const [ink] = await output.embedPdf(overlay.output("arraybuffer"));
    background.drawPage(ink, { x: 0, y: 0, width: WIDTH, height: HEIGHT });
    output.addPage(background);
  }

  async function photos(templateIndex: number, team: ParticipantPdfEntry[], sport: string) {
    await page(templateIndex, async pdf => {
      field(pdf, sportName(sport), 182, 136, 105);
      field(pdf, "น้ำตาล", 323, 136, 111);
      // The source has slightly different positions in each row and column.
      const photoX = [[68, 262.8, 445.4], [68.2, 262.9, 446.4], [68.4, 263.6, 446.6], [68.8, 263.1, 455.4]];
      const photoY = [170.7, 331.8, 495.8, 661.5];
      const textX = [[67, 241, 432], [67, 251, 432], [67, 248, 432], [67, 248, 432]];
      const nameY = [272, 436, 602, 764];
      for (const [index, entry] of team.entries()) {
        const row = Math.floor(index / 3), col = index % 3;
        const data = await imageData(entry.photoUrl);
        if (entry.photoUrl && !data) throw new Error(`Could not load the photo for ${entry.participant.studentId}. Please retry.`);
        if (data) {
          const image = pdf.getImageProperties(data);
          const scale = Math.min(77 / image.width, 86 / image.height);
          const w = image.width * scale, h = image.height * scale;
          pdf.addImage(data, photoX[row][col] + 1 + (77 - w) / 2, photoY[row] + 1 + (86 - h) / 2, w, h);
        }
        field(pdf, name(entry), textX[row][col], nameY[row], col === 2 ? 121 : 122, 13);
        field(pdf, entry.participant.jerseyNumber, textX[row][col], nameY[row] + 26.5, 121, 13);
      }
    });
  }

  async function roster(team: ParticipantPdfEntry[], sport: string, offset: number) {
    await page(3, pdf => {
      field(pdf, `น้ำตาล     กีฬา ${sportName(sport)}`, 68, 135, 477, 16, 19, "cell");
      // Renumber every row of a continuation sheet, including unused rows.
      if (offset) {
        for (let index = 0; index < 25; index++) {
          const y = 173 + index * 18.84;
          pdf.setFillColor(255, 255, 255); pdf.rect(32, y, 28, 15, "F");
          field(pdf, String(offset + index + 1), 38, y, 22, 13, 19, "cell");
        }
      }
      team.forEach((entry, index) => {
        const y = 173 + index * 18.84;
        field(pdf, name(entry), 70, y, 265, 14, 19, "cell");
        field(pdf, entry.participant.studentId, 351, y, 110, 14, 19, "cell");
        field(pdf, entry.participant.jerseyNumber, 482, y, 70, 14, 19, "cell");
      });
    });
  }

  if (options?.includeSportSheets) {
    for (const [sport, team] of sports) {
      // Always include source pages 1–4 for each sport, then overflow sheets.
      await photos(0, team.slice(0, 12), sport);
      await photos(1, team.slice(12, 24), sport);
      await photos(2, team.slice(24, 30), sport);
      await roster(team.slice(0, 25), sport, 0);
      for (let offset = 30; offset < team.length; offset += 12) await photos(0, team.slice(offset, offset + 12), sport);
      for (let offset = 25; offset < team.length; offset += 25) await roster(team.slice(offset, offset + 25), sport, offset);
    }
  }

  for (const registrations of people.values()) {
    await page(4, async pdf => {
      const p = registrations[0].participant;
      const fullName = name(registrations[0]).trim().split(/\s+/);
      field(pdf, "น้ำตาล", 270, 116, 82);
      field(pdf, fullName[0], 88, 176, 200);
      field(pdf, fullName.slice(1).join(" "), 334, 176, 187);
      field(pdf, p.studentId, 132, 203, 155);
      const activities = [...new Set(registrations.map(entry => {
        const category = categoryLabel(entry.participant);
        return `${sportName(entry.participant.sport)}${category ? ` (${category})` : ""}`;
      }))].join(" / ");
      field(pdf, activities, 349, 203, 172);
      const jerseys = [...new Set(registrations.map(entry => entry.participant.jerseyNumber).filter(Boolean))];
      field(pdf, jerseys.length <= 1 ? jerseys[0] : registrations.map(entry => `${sportName(entry.participant.sport)}: ${entry.participant.jerseyNumber || "-"}`).join(" / "), 111, 236, 410);
      const qualification = p.qualificationCriteria?.trim();
      const checkboxes: Record<string, number> = { "นักกีฬาทีมชาติ": 69.6, "นักกีฬาโควต้าช้างกีฬา": 158.1, "นักกีฬาโคต้าช้างกีฬา": 158.1, "นักกีฬาสโมสรต่าง ๆ": 271.9 };
      if (qualification) {
        const x = checkboxes[qualification] ?? 385.6;
        pdf.setDrawColor(0); pdf.setLineWidth(1);
        pdf.line(x + 2, 275, x + 5, 279); pdf.line(x + 5, 279, x + 10, 271);
        if (!checkboxes[qualification]) field(pdf, qualification, 429, 269, 92, 13);
      }
      if (p.birthDate && ageOnDate(p.birthDate) !== null) {
        const [year, month, day] = p.birthDate.split("-").map(Number);
        const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        field(pdf, String(day), 111, 296, 99);
        field(pdf, months[month - 1], 244, 296, 118);
        field(pdf, String(year + 543), 389, 296, 132);
      }
      field(pdf, p.nationalIdNumber, 192, 323, 130);
      const sex = p.sex ? ({ male: "ชาย", female: "หญิง" }[p.sex.toLowerCase()] ?? p.sex) : "";
      field(pdf, sex, 350, 323, 54);
      const age = p.birthDate ? ageOnDate(p.birthDate) : p.age;
      field(pdf, age == null ? "" : String(age), 431, 323, 90);
      field(pdf, p.emergencyContactName, 288, 350, 232);
      field(pdf, p.emergencyContactRelationship, 114, 377, 172);
      field(pdf, p.guardianPhone, 355, 377, 166);
      field(pdf, p.medicalConditions, 131, 431, 390);
      field(pdf, p.drugAllergies, 146, 458, 375);
      field(pdf, p.hospitalizationHistory, 230, 485, 291);
      const other = [p.foodAllergies && `แพ้อาหาร: ${p.foodAllergies}`, p.allergies && `ข้อมูลการแพ้เดิม: ${p.allergies}`, p.qualificationDetails, p.eligibilityCertification].filter(Boolean).join(" / ");
      field(pdf, other, 99, 512, 422);
      const documentEntry = registrations.find(entry => entry.studentIdImageUrl);
      field(pdf, "บัตรนักศึกษา", 258, 548, 100, 15);
      if (documentEntry) {
        const card = await imageData(documentEntry.studentIdImageUrl);
        if (!card) throw new Error(`Could not load the student ID card for ${p.studentId}. Please retry.`);
        const image = pdf.getImageProperties(card);
        const scale = Math.min(270 / image.width, 170 / image.height);
        const width = image.width * scale, height = image.height * scale;
        const left = (WIDTH - width) / 2, top = 565 + (170 - height) / 2;
        pdf.addImage(card, left, top, width, height);
        pdf.setDrawColor(30); pdf.setLineWidth(0.8);
        // Continue both strokes beyond the card while preserving their diagonal angle.
        const overhang = 8;
        const horizontalOverhang = overhang * width * 0.66 / height;
        pdf.line(left + width * 0.12 - horizontalOverhang, top + height + overhang, left + width * 0.78 + horizontalOverhang, top - overhang);
        pdf.line(left + width * 0.22 - horizontalOverhang, top + height + overhang, left + width * 0.88 + horizontalOverhang, top - overhang);
        pdf.setFontSize(17);
        pdf.text("สำเนาถูกต้อง", WIDTH / 2, 752, { align: "center" });
        pdf.setFontSize(14);
        pdf.text("ใช้สําหรับการแข่งขันกีฬา TU Freshy Games 2026 เท่านั้น", WIDTH / 2, 768, { align: "center" });
      }
      // Certification belongs to the profile being printed, not whichever registration
      // supplied an image. Never borrow a signature from a different/older registration.
      const renderedSignature = drawSignature(pdf, p, 232, 775, 130, 24);
      pdf.setFontSize(14);
      if (renderedSignature) {
        pdf.text(`(${p.signedName || name(registrations[0])})`, WIDTH / 2, 815, { align: "center" });
      } else {
        pdf.text("ยังไม่มีลายมือชื่อที่บันทึกไว้ กรุณาลงนามอีกครั้ง", WIDTH / 2, 792, { align: "center" });
      }

    });
  }
  return output.save();
}

/** Fit every character; never truncate data silently or draw over adjacent labels. */
function field(pdf: jsPDF, value: string | undefined, x: number, y: number, width: number, size = 16, height = 19, layout: "underline" | "cell" = "underline") {
  if (!value) return;
  // Leave a visible gap after the printed label without extending the field's right edge.
  const inset = layout === "underline" ? 6 : 3;
  pdf.setTextColor(0);
  for (let fontSize = size; fontSize >= 9; fontSize -= 0.5) {
    pdf.setFontSize(fontSize);
    const lines: string[] = pdf.splitTextToSize(value, width - inset);
    if (lines.length * fontSize * 0.9 <= height && (layout !== "cell" || lines.length === 1)) {
      const lineHeight = fontSize * 0.9;
      // Underlined values sit above the dots, including the final line of wrapped text.
      // Roster cells instead need clearance from their top border.
      const baseline = y + fontSize * 0.55 + (layout === "cell" ? 2.5 : -2 - (lines.length - 1) * lineHeight);
      pdf.text(lines, x + inset, baseline, { lineHeightFactor: 0.9 });
      return;
    }
  }
  throw new Error(`A value is too long for the official form: ${value.slice(0, 35)}… Please shorten this field before exporting.`);
}
