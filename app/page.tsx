import Link from "next/link";
import { ArrowRight, BriefcaseMedical, Camera, ClipboardPlus, LockKeyhole, MapPin, QrCode, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { Brand } from "./components/Brand";
import { FirstAidContact } from "./components/FirstAidContact";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing__nav" aria-label="เมนูหลัก">
        <Brand />
        <Link className="text-link" href="/staff"><LockKeyhole size={16} /><span>สำหรับเจ้าหน้าที่</span></Link>
      </nav>

      <section className="portal">
        <header className="portal__intro">
          <span className="eyebrow"><span /> FRESHY GAME 2026 · FIRST AID</span>
          <h1>กล่อง<br />ปฐมพยาบาล</h1>
          <p>ยืม คืน รับต่อ และบันทึกการปฐมพยาบาลจากกล่องของแต่ละกีฬา ไม่ต้องเข้าสู่ระบบ ใช้แค่รหัสนักศึกษา<br />Borrow, return, hand over, and log first aid from the kits. No account needed, just your Student ID.</p>
        </header>

        <div className="portal__workspace">
          <Link className="portal-action" href="/first-aid">
            <span className="portal-action__icon"><BriefcaseMedical size={28} /></span>
            <span className="portal-action__label">ยืม–คืน และบันทึกการปฐมพยาบาล</span>
            <strong>ใช้กล่องปฐมพยาบาล</strong>
            <span className="portal-action__description">เลือกกล่อง แล้วเลือกว่าจะยืม คืน รับต่อจากกีฬาก่อนหน้า หรือบันทึกการใช้ยาและเวชภัณฑ์<br />Borrow, return, or log first aid given from a kit.</span>
            <span className="portal-action__button">เริ่มบันทึก / Start <ArrowRight size={18} /></span>
          </Link>

          <Link className="portal-action portal-action--performer" href="/first-aid/track">
            <span className="portal-action__icon"><MapPin size={28} /></span>
            <span className="portal-action__label">กล่องอยู่ที่ไหน</span>
            <strong>ติดตามกล่อง</strong>
            <span className="portal-action__description">ดูว่าแต่ละกล่องอยู่กับกีฬาไหน ใครถืออยู่ และเบอร์ติดต่อ<br />See which sport has each kit and how to reach whoever holds it.</span>
            <span className="portal-action__button">ดูสถานะ / Track kits <ArrowRight size={18} /></span>
          </Link>

          <aside className="prep-card">
            <div className="prep-card__heading"><span>ใช้งานอย่างไร / How it works</span><small>3 ขั้นตอน ไม่ต้องสมัครสมาชิก</small></div>
            <ul>
              <li><QrCode size={19} /><span><strong>1 · สแกน QR บนกล่อง</strong><small>หรือเลือกกล่องจากรายการ / or pick the kit from the list</small></span></li>
              <li><ClipboardPlus size={19} /><span><strong>2 · ยืม คืน หรือบันทึกการปฐมพยาบาล</strong><small>กรอกรหัสนักศึกษา ระบบจะดึงข้อมูลให้ / Enter your Student ID</small></span></li>
              <li><Camera size={19} /><span><strong>3 · ตอนคืน ถ่ายรูปกล่อง</strong><small>เปิดฝาให้เห็นของข้างใน / Photo with the lid open</small></span></li>
            </ul>
            <FirstAidContact />
          </aside>
        </div>

        <div className="staff-access">
          <div><span className="staff-access__icon"><UploadCloud size={18} /></span><span><strong>ส่งเอกสารผู้เข้าร่วม</strong><small>นักกีฬาและผู้เข้าร่วม ส่งรูปโปรไฟล์ บัตรประชาชน และบัตรนักศึกษา</small></span></div>
          <div className="staff-access__links"><Link href="/performers/register"><Sparkles size={14} /> ลงทะเบียนนักแสดง</Link><Link href="/upload">ส่งเอกสาร <ArrowRight size={16} /></Link></div>
        </div>

        <div className="staff-access">
          <div><span className="staff-access__icon"><LockKeyhole size={18} /></span><span><strong>จุดรับลงทะเบียน / เจ้าหน้าที่</strong><small>ดูบันทึกกล่องปฐมพยาบาล รูปตอนคืน และจัดการข้อมูลผู้เข้าร่วม</small></span></div>
          <Link href="/staff">เข้าสู่ระบบ <ArrowRight size={16} /></Link>
        </div>
      </section>

      <footer className="landing__footer">
        <span><ShieldCheck size={14} /> ข้อมูลส่วนบุคคลได้รับการจัดเก็บอย่างปลอดภัยตาม PDPA</span>
        <span>© 2026 Freshy Game · Brown Team</span>
      </footer>
    </main>
  );
}
