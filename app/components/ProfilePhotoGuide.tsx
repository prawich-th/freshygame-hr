import Image from "next/image";

export function ProfilePhotoGuide() {
  return (
    <figure className="profile-photo-guide">
      <figcaption>
        <strong>อัปโหลดรูปนักศึกษาเท่านั้น / Student ID photo only</strong>
        <p>สวมชุดนักศึกษา หน้าตรง เห็นใบหน้าชัดเจน พื้นหลังเรียบ ไม่ใช้รูปเซลฟี รูปโพสท่า หรือฟิลเตอร์</p>
        <p>Wear your student uniform, face the camera, and use a plain background. No selfies, playful poses, or filters.</p>
      </figcaption>
      <Image src="/profile-photo-guide.png" width={1376} height={824} sizes="(max-width: 700px) 100vw, 600px" alt="ตัวอย่างรูปที่ใช้ได้: รูปนักศึกษาหน้าตรงในชุดนักศึกษา ตัวอย่างรูปที่ใช้ไม่ได้: รูปเซลฟี รูปโพสท่า รูปใช้ฟิลเตอร์ และรูปหน้าไม่ตรง" />
    </figure>
  );
}
