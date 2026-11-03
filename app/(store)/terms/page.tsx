import { getShop } from '@/lib/shop';

export default async function Terms() {
  const shop = (await getShop())!;
  return (
    <div className="card card-pad" style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.9 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>เงื่อนไขการใช้งาน · {shop.name}</h1>
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        <li>สินค้าจากคลังและแบบแบ่งจอ ส่งอัตโนมัติทันทีหลังชำระเงินสำเร็จ ดูได้ที่ &quot;บัญชีของฉัน&quot; และ &quot;ออเดอร์&quot;</li>
        <li>สินค้าแบบสั่งทำ ร้านจะดำเนินการและแจ้งผลในหน้าออเดอร์</li>
        <li>ชำระด้วยพร้อมเพย์ต้องโอนยอดตรงตาม QR และอัปสลิปภายในเวลาที่กำหนด สลิปที่ใช้แล้วใช้ซ้ำไม่ได้</li>
        <li>ใช้เฉพาะโปรไฟล์ของคุณ ห้ามเปลี่ยนรหัสผ่าน / PIN / ชื่อโปรไฟล์ หากฝ่าฝืนร้านอาจยกเลิกโดยไม่คืนเงิน</li>
        <li>รับประกันตลอดอายุแพ็กเกจ มีปัญหาการใช้งานติดต่อร้านทาง LINE พร้อมแจ้งเลขออเดอร์</li>
      </ol>
      <p className="faint" style={{ fontSize: 13, marginTop: 16 }}>เว็บไซต์ให้บริการโดย SysRent · ร้านค้าเป็นผู้รับผิดชอบสินค้าและการให้บริการของตนเอง</p>
    </div>
  );
}
