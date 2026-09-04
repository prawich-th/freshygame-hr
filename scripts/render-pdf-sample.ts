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
  faculty: "คณะพาณิชยศาสตร์และการบัญชี",
  sport: "Badminton",
  category: "Women’s Doubles",
  phone: "0812345678",
  email: "participant@example.com",
  status: "pending",
  source: "import",
  updatedAt: Date.now(),
} as unknown as Doc<"participants">;

const bytes = await generateParticipantPdf(
  [{ participant, photoUrl: null, nationalIdImageUrl: null, studentIdImageUrl: null }],
  "freshy-game-participant-sample",
  {
    fonts: { regular: regular.toString("base64"), bold: bold.toString("base64") },
    save: false,
  },
);

await writeFile(resolve(projectRoot, "output/pdf/freshy-game-participant-sample.pdf"), Buffer.from(bytes));
