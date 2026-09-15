import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  emergencyContactName: "สมชาย กุลวัฒน์",
  emergencyContactRelationship: "บิดา",
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

const samplePortrait = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360"><rect width="300" height="360" fill="#eae4dc"/><circle cx="150" cy="118" r="64" fill="#b7977d"/><path d="M42 360 L42 305 Q48 212 150 212 Q252 212 258 305 L258 360" fill="#573c2e"/><text x="150" y="325" text-anchor="middle" font-family="sans-serif" font-size="18" fill="white">SAMPLE PROFILE</text></svg>`;
const sampleImage = `data:image/png;base64,${(await sharp(Buffer.from(samplePortrait)).png().toBuffer()).toString("base64")}`;

const sampleCard = `<svg xmlns="http://www.w3.org/2000/svg" width="856" height="540"><rect width="856" height="540" rx="20" fill="#ede7df"/><rect width="856" height="85" fill="#573c2e"/><text x="35" y="54" font-family="sans-serif" font-size="27" fill="white">SAMPLE STUDENT ID</text><rect x="35" y="120" width="200" height="260" fill="#d1c0af"/><circle cx="135" cy="205" r="48" fill="#ab896c"/><path d="M50 360 Q135 230 220 360" fill="#573c2e"/><text x="280" y="195" font-family="sans-serif" font-size="26">Waranya Kunlawat</text><text x="280" y="250" font-family="sans-serif" font-size="24">6709680123</text><text x="35" y="480" font-family="sans-serif" font-size="22">SYNTHETIC SAMPLE - FOR LAYOUT REVIEW</text></svg>`;
const studentIdImage = `data:image/png;base64,${(await sharp(Buffer.from(sampleCard)).png().toBuffer()).toString("base64")}`;

const bytes = await generateParticipantPdf(
  [{ participant, photoUrl: sampleImage, nationalIdImageUrl: null, studentIdImageUrl: studentIdImage }],
  "freshy-game-participant-sample",
  {
    fonts: { regular: regular.toString("base64"), bold: bold.toString("base64") },
    save: false,
    includeSportSheets: true,
    template: await readFile(resolve(projectRoot, "public/templates/athlete-official.pdf")),
  },
);

await mkdir(resolve(projectRoot, "output/pdf"), { recursive: true });
await writeFile(resolve(projectRoot, "output/pdf/freshy-game-athlete-official-sample.pdf"), Buffer.from(bytes));
