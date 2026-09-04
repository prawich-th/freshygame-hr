import Link from "next/link";
import { ArrowRight, Camera, CreditCard, LockKeyhole, Phone, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { Brand } from "./components/Brand";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing__nav" aria-label="เมนูหลัก">
        <Brand />
        <Link className="text-link" href="/staff"><LockKeyhole size={16} /><span>สำหรับเจ้าหน้าที่</span></Link>
      </nav>

      <section className="portal">
        <header className="portal__intro">
          <span className="eyebrow"><span /> FRESHY GAME 2026</span>
          <h1>ลงทะเบียนและ<br />ส่งเอกสารผู้เข้าร่วม</h1>
          <p>สำหรับนักกีฬา ผู้เข้าร่วม และนักแสดง Freshy Game 2026 ใช้เวลาประมาณ 3–5 นาที</p>
        </header>

        <div className="portal__workspace">
          <Link className="portal-action" href="/upload">
            <span className="portal-action__icon"><UploadCloud size={28} /></span>
            <span className="portal-action__label">สำหรับนักกีฬาและผู้เข้าร่วม</span>
            <strong>เริ่มส่งเอกสาร</strong>
            <span className="portal-action__description">ใช้รหัสนักศึกษาและเบอร์โทรศัพท์ที่ลงทะเบียนไว้เพื่อยืนยันตัวตน</span>
            <span className="portal-action__button">เริ่มต้นใช้งาน <ArrowRight size={18} /></span>
          </Link>

          <Link className="portal-action portal-action--performer" href="/performers/register">
            <span className="portal-action__icon"><Sparkles size={28} /></span>
            <span className="portal-action__label">สำหรับนักแสดง</span>
            <strong>ลงทะเบียนนักแสดง</strong>
            <span className="portal-action__description">Katakorn และ Cheerleader กรอกข้อมูลส่วนตัวและส่งเอกสารได้ด้วยตนเอง</span>
            <span className="portal-action__button">เริ่มลงทะเบียน <ArrowRight size={18} /></span>
          </Link>

          <aside className="prep-card">
            <div className="prep-card__heading"><span>เตรียมให้พร้อมก่อนเริ่ม</span><small>ต้องใช้ครบทั้ง 3 รายการ</small></div>
            <ul>
              <li><Camera size={19} /><span><strong>รูปโปรไฟล์</strong><small>เห็นใบหน้าชัดเจน</small></span></li>
              <li><CreditCard size={19} /><span><strong>บัตรประชาชน</strong><small>ถ่ายภาพด้านหน้า</small></span></li>
              <li><CreditCard size={19} /><span><strong>บัตรนักศึกษา</strong><small>ข้อมูลบนบัตรอ่านได้</small></span></li>
            </ul>
            <div className="prep-card__note"><Phone size={16} /><span>เตรียมรหัสนักศึกษาและเบอร์โทรศัพท์ที่ใช้ลงทะเบียน</span></div>
          </aside>
        </div>

        <div className="staff-access">
          <div><span className="staff-access__icon"><LockKeyhole size={18} /></span><span><strong>จุดรับลงทะเบียน / เจ้าหน้าที่</strong><small>ค้นหารายชื่อ รับเอกสาร และจัดการข้อมูลผู้เข้าร่วม</small></span></div>
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
