import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Doc } from "../convex/_generated/dataModel";
import { generateParticipantPdf } from "../app/lib/participantPdf";

const projectRoot = resolve(import.meta.dirname, "..");
const [regular, bold] = await Promise.all([
  readFile(resolve(projectRoot, "public/fonts/THSarabunNew.ttf")),
  readFile(resolve(projectRoot, "public/fonts/THSarabunNew-Bold.ttf")),
]);

const participant = {
  _id: "sample-participant",
  _creationTime: Date.now(),
  studentId: "6709680123",
  orderNumber: 1,
  fullNameThai: "วรัญญา กุลวัฒน์",
  fullNameEnglish: "Waranya Kunlawat",
  nicknameThai: "วา",
  nicknameEnglish: "Wa",
  sex: "Female",
  nationalIdNumber: "1234567890123",
  birthDate: "2007-03-15",
  guardianPhone: "0812345678",
  jerseyNumber: "92",
  drugAllergies: "แพ้ยาเพนิซิลลิน มีผื่นและบวม",
  foodAllergies: "แพ้ถั่วลิสง",
  medicalConditions: "โรคหอบหืด มียาพ่นประจำตัว",
  hospitalizationHistory: "ผ่าตัดไส้ติ่งเมื่อปี 2564 ไม่มีภาวะแทรกซ้อน",
  signedName: "ตัวอย่างลายมือชื่อ / SAMPLE",
  signedAt: Date.now(),
  signature: [[{x:40,y:120},{x:80,y:30},{x:65,y:130},{x:140,y:70},{x:115,y:120},{x:230,y:65},{x:210,y:115},{x:390,y:75}]],
  faculty: "คณะพาณิชยศาสตร์และการบัญชี",
  sport: "Badminton",
  category: "Women’s Doubles",
  phone: "0812345678",
  email: "participant@example.com",
  status: "pending",
  source: "import",
  updatedAt: Date.now(),
} as unknown as Doc<"participants">;

const sampleCard = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630"><rect width="1000" height="630" rx="24" fill="#f3ece1"/><rect width="1000" height="100" fill="#573c2e"/><text x="45" y="66" font-family="sans-serif" font-size="35" fill="white">TU FRESHY GAMES 2026</text><rect x="45" y="155" width="245" height="330" rx="12" fill="#d8c9b5"/><circle cx="168" cy="262" r="55" fill="#95785f"/><path d="M75 435 Q168 295 260 435" fill="#95785f"/><text x="340" y="220" font-family="sans-serif" font-size="30" fill="#573c2e">SAMPLE DOCUMENT</text><text x="340" y="295" font-family="sans-serif" font-size="25">Name: Sample Participant</text><text x="340" y="345" font-family="sans-serif" font-size="25">Student ID: 6709680123</text><text x="340" y="395" font-family="sans-serif" font-size="25">For layout preview only</text><text x="45" y="560" font-family="sans-serif" font-size="24" fill="#573c2e">FICTIONAL EXAMPLE - NOT AN IDENTITY DOCUMENT</text></svg>`;
const sampleImage = `data:image/png;base64,${(await sharp(Buffer.from(sampleCard)).png().toBuffer()).toString("base64")}`;

const bytes = await generateParticipantPdf(
  [{ participant, photoUrl: null, nationalIdImageUrl: sampleImage, studentIdImageUrl: sampleImage }],
  "freshy-game-participant-sample",
  {
    fonts: { regular: regular.toString("base64"), bold: bold.toString("base64") },
    save: false,
  },
);

await writeFile(resolve(projectRoot, "output/pdf/freshy-game-participant-sample.pdf"), Buffer.from(bytes));
