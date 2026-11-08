'use client';
/**
 * คู่มือเชื่อมอีเมลเข้าเว็บร้าน (ภาพประกอบเป็น SVG จำลองหน้าจอ — ไม่ใช่ภาพหน้าจอจริง)
 * กรอบสีแดง + ตัวเลข = จุดที่ต้องกดตามลำดับ · ลูกศร "กดตรงนี้" ชี้ปุ่มสำคัญ
 * - GmailGuide: สร้าง App Password (รหัสผ่านแอป 16 ตัว) แล้วใส่ในหลังบ้าน
 * - HotmailGuide: กด "เชื่อมต่อ" → ล็อกอิน Microsoft → ยอมรับสิทธิ์อ่านเมล
 * - MsAppGuide: สร้าง Microsoft App ใน Azure (เฉพาะร้านที่ต้องใช้ App ของตัวเอง)
 */

const FONT = 'IBM Plex Sans Thai, Mitr, sans-serif';
const HL = '#e11d48';
const G = { blue: '#1a73e8', text: '#202124', muted: '#5f6368', line: '#dadce0', soft: '#e8f0fe' };
const M = { blue: '#0067b8', text: '#1b1b1b', muted: '#605e5c', line: '#c8c6c4' };
const P = { purple: '#7c3aed', soft: '#ede9fe', text: '#111827', muted: '#6b7280', line: '#e5e7eb' };

type Step = { title: string; detail: React.ReactNode; img: React.ReactNode };

const T = ({ x, y, s = 9, c = G.text, w = 500, a, children }: { x: number; y: number; s?: number; c?: string; w?: number; a?: 'middle' | 'end'; children: React.ReactNode }) => (
  <text x={x} y={y} fontSize={s} fill={c} fontWeight={w} fontFamily={FONT} textAnchor={a}>{children}</text>
);

/** กรอบไฮไลต์ + ตัวเลขลำดับ */
function Mark({ x, y, w, h, n }: { x: number; y: number; w: number; h: number; n: number }) {
  return (
    <g>
      <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx={7} fill="none" stroke={HL} strokeWidth={2.4} />
      <circle cx={x + w + 1} cy={y - 1} r={8.5} fill={HL} />
      <text x={x + w + 1} y={y + 2.8} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="#fff" fontFamily={FONT}>{n}</text>
    </g>
  );
}

/** ลูกศรโค้ง + ป้าย "กดตรงนี้" (จาก (x1,y1) ชี้ไปที่ (x2,y2)) */
function Arrow({ x1, y1, x2, y2, label = 'กดตรงนี้', bend = 30 }: { x1: number; y1: number; x2: number; y2: number; label?: string; bend?: number }) {
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2 - bend / 2;
  const ang = Math.atan2(y2 - my, x2 - mx);
  const ah = (d: number) => `${x2 - 8 * Math.cos(ang + d)},${y2 - 8 * Math.sin(ang + d)}`;
  const tw = label.length * 6.4 + 14;
  return (
    <g>
      <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke={HL} strokeWidth={2} strokeDasharray="4 3" />
      <polygon points={`${x2},${y2} ${ah(0.45)} ${ah(-0.45)}`} fill={HL} />
      <rect x={x1 - tw / 2} y={y1 - 9} width={tw} height={17} rx={8.5} fill={HL} />
      <T x={x1} y={y1 + 3} s={8.5} c="#fff" w={700} a="middle">{label}</T>
    </g>
  );
}

/** หน้าต่างเบราว์เซอร์ + แถบที่อยู่เว็บ */
const Browser = ({ url, children, bg = '#ffffff' }: { url: string; children: React.ReactNode; bg?: string }) => (
  <svg viewBox="0 0 320 190" className="mg-shot" role="img" aria-hidden="true">
    <rect width="320" height="190" rx="10" fill={bg} />
    <rect width="320" height="22" rx="10" fill="#eef0f3" /><rect y="12" width="320" height="10" fill="#eef0f3" />
    {[12, 22, 32].map((cx) => <circle key={cx} cx={cx} cy={11} r={3} fill="#c9ccd3" />)}
    <rect x="46" y="5" width="228" height="12" rx="6" fill="#fff" />
    <T x={54} y={14} s={7.5} c="#6b7280">🔒 {url}</T>
    {children}
  </svg>
);

/** โลโก้ Microsoft แบบสี่ช่อง (สัญลักษณ์ประกอบภาพ) */
const MsLogo = ({ x, y, s = 7 }: { x: number; y: number; s?: number }) => (
  <g>
    <rect x={x} y={y} width={s} height={s} fill="#f25022" /><rect x={x + s + 1} y={y} width={s} height={s} fill="#7fba00" />
    <rect x={x} y={y + s + 1} width={s} height={s} fill="#00a4ef" /><rect x={x + s + 1} y={y + s + 1} width={s} height={s} fill="#ffb900" />
  </g>
);

/** แท็บหลังบ้านร้าน (จำลอง) */
const ShopTabs = ({ on }: { on: number }) => (
  <>
    {['บัญชีอีเมล', 'แอปพลิเคชัน', 'ตั้งค่า API'].map((t, i) => (
      <g key={t}><rect x={12 + i * 100} y={30} width={94} height={20} rx={8} fill={i === on ? P.purple : '#fff'} stroke={i === on ? P.purple : P.line} />
        <T x={59 + i * 100} y={44} s={8.5} c={i === on ? '#fff' : '#4b5563'} w={700} a="middle">{t}</T></g>
    ))}
  </>
);
/** การ์ดเพิ่มอีเมล 3 แบบ (จำลอง) */
const AddCards = () => (
  <>
    {[['Gmail', 'เพิ่ม', '#ea4335'], ['Hotmail', 'เชื่อมต่อ', '#0284c7'], ['Maily', 'เพิ่ม', P.purple]].map(([n, b, c], i) => (
      <g key={n}><rect x={12 + i * 100} y={58} width={94} height={46} rx={10} fill="#fff" stroke={P.line} />
        <circle cx={59 + i * 100} cy={72} r={7} fill={c} opacity={0.15} /><circle cx={59 + i * 100} cy={72} r={3.5} fill={c} />
        <T x={59 + i * 100} y={90} s={8.5} c={P.text} w={800} a="middle">{n}</T>
        <rect x={39 + i * 100} y={94} width={40} height={0.01} fill="none" /><T x={59 + i * 100} y={101} s={6.5} c={c} w={700} a="middle">{b}</T></g>
    ))}
  </>
);

/* ====================== Gmail: App Password ====================== */
const GMAIL_STEPS: Step[] = [
  {
    title: 'เปิดการยืนยันแบบ 2 ขั้นตอน',
    detail: <>ล็อกอิน Gmail ที่จะใช้ → เปิด <b>myaccount.google.com</b> → เมนู <b>ความปลอดภัย</b> <b>①</b> → เปิด <b>การยืนยันแบบ 2 ขั้นตอน</b> <b>②</b> (ถ้าขึ้น "เปิดอยู่" แล้วข้ามได้)</>,
    img: (
      <Browser url="myaccount.google.com/security">
        {['หน้าแรก', 'ข้อมูลส่วนตัว', 'ความปลอดภัย', 'การชำระเงิน'].map((m, i) => (
          <g key={m}>{i === 2 && <rect x={8} y={36 + i * 22} width={90} height={18} rx={9} fill={G.soft} />}<T x={18} y={49 + i * 22} s={8.5} c={i === 2 ? G.blue : G.text} w={i === 2 ? 700 : 500}>{m}</T></g>
        ))}
        <Mark x={8} y={80} w={90} h={18} n={1} />
        <rect x={110} y={36} width={200} height={140} rx={8} fill="#fff" stroke={G.line} />
        <T x={120} y={54} s={9.5} w={700}>วิธีลงชื่อเข้าใช้ Google</T>
        <line x1={110} y1={64} x2={310} y2={64} stroke={G.line} />
        <T x={120} y={82} s={8.5}>การยืนยันแบบ 2 ขั้นตอน</T>
        <T x={120} y={95} s={7.5} c="#188038" w={700}>✓ เปิดอยู่</T>
        <Mark x={116} y={72} w={188} h={28} n={2} />
        <line x1={110} y1={108} x2={310} y2={108} stroke={G.line} />
        <T x={120} y={126} s={8.5}>รหัสผ่าน</T><T x={120} y={138} s={7.5} c={G.muted}>เปลี่ยนล่าสุด 3 เดือนที่แล้ว</T>
        <Arrow x1={210} y1={166} x2={250} y2={104} bend={-24} label="ต้องเปิดก่อน" />
      </Browser>
    ),
  },
  {
    title: 'สร้างรหัสผ่านสำหรับแอป',
    detail: <>เปิด <b>myaccount.google.com/apppasswords</b> <b>①</b> (หรือพิมพ์ค้นหา <b>App passwords</b> ในหน้าบัญชี Google) → ตั้งชื่อแอป เช่น <b>SysRent OTP</b> <b>②</b> → กด <b>สร้าง</b> <b>③</b></>,
    img: (
      <Browser url="myaccount.google.com/apppasswords">
        <Mark x={46} y={5} w={150} h={12} n={1} />
        <T x={14} y={48} s={11} w={500}>รหัสผ่านสำหรับแอป</T>
        <T x={14} y={64} s={7.5} c={G.muted}>ใช้ลงชื่อเข้าใช้ในแอปที่ไม่รองรับการยืนยัน 2 ขั้นตอน</T>
        <T x={14} y={92} s={8} c={G.muted}>พิมพ์ชื่อแอปเพื่อสร้างรหัสผ่านใหม่</T>
        <rect x={14} y={102} width={200} height={28} rx={4} fill="#fff" stroke={G.blue} strokeWidth={1.6} />
        <T x={22} y={113} s={6.5} c={G.blue}>ชื่อแอป</T><T x={22} y={124} s={9}>SysRent OTP</T>
        <Mark x={14} y={102} w={200} h={28} n={2} />
        <rect x={230} y={146} width={74} height={26} rx={13} fill={G.blue} /><T x={267} y={163} s={9.5} c="#fff" w={700} a="middle">สร้าง</T>
        <Mark x={230} y={146} w={74} h={26} n={3} />
        <Arrow x1={150} y1={164} x2={226} y2={159} bend={10} />
      </Browser>
    ),
  },
  {
    title: 'คัดลอกรหัส 16 ตัว',
    detail: <>Google แสดงรหัส <b>16 ตัว</b> ในกรอบสีเหลือง <b>①</b> → คัดลอกเก็บไว้ (มีเว้นวรรคหรือไม่ก็ได้) แล้วกด <b>เสร็จสิ้น</b><br /><span className="mg-warn">รหัสนี้แสดงครั้งเดียว — ถ้าปิดไปแล้วให้สร้างใหม่</span></>,
    img: (
      <Browser url="myaccount.google.com/apppasswords">
        <rect x={0} y={22} width={320} height={168} fill="#000" opacity={0.35} />
        <rect x={50} y={36} width={220} height={140} rx={10} fill="#fff" />
        <T x={160} y={60} s={10} w={700} a="middle">รหัสผ่านสำหรับแอปที่สร้างขึ้น</T>
        <rect x={70} y={74} width={180} height={32} rx={6} fill="#fef7e0" />
        <T x={160} y={95} s={13} w={700} a="middle">abcd efgh ijkl mnop</T>
        <Mark x={70} y={74} w={180} h={32} n={1} />
        <T x={160} y={124} s={7} c={G.muted} a="middle">นำรหัสนี้ไปใส่ในแอปที่ต้องการเชื่อมต่อ</T>
        <T x={246} y={160} s={9} c={G.blue} w={700} a="end">เสร็จสิ้น</T>
        <Arrow x1={104} y1={160} x2={68} y2={102} bend={-12} label="คัดลอกรหัสนี้" />
      </Browser>
    ),
  },
  {
    title: 'ใส่ในหลังบ้านร้าน',
    detail: <>หลังบ้านร้าน → เมนู <b>ค้นหา OTP</b> → แท็บ <b>บัญชีอีเมล</b> <b>①</b> → การ์ด <b>Gmail</b> กด <b>เพิ่ม</b> <b>②</b> → กรอก <b>อีเมล</b> + <b>App Password</b> ที่คัดลอกมา <b>③</b> → บันทึก</>,
    img: (
      <svg viewBox="0 0 320 190" className="mg-shot" role="img" aria-hidden="true">
        <rect width="320" height="190" rx="10" fill="#f5f3ff" />
        <T x={12} y={20} s={9} c={P.text} w={800}>หลังบ้านร้าน</T>
        <ShopTabs on={0} />
        <Mark x={12} y={30} w={94} h={20} n={1} />
        <rect x={12} y={58} width={94} height={46} rx={10} fill="#fff" stroke={P.line} />
        <circle cx={59} cy={72} r={7} fill="#ea4335" opacity={0.15} /><circle cx={59} cy={72} r={3.5} fill="#ea4335" />
        <T x={59} y={90} s={8.5} c={P.text} w={800} a="middle">Gmail</T><T x={59} y={101} s={6.5} c={P.purple} w={700} a="middle">+ เพิ่ม</T>
        <Mark x={12} y={58} w={94} h={46} n={2} />
        <rect x={120} y={58} width={188} height={124} rx={12} fill="#fff" stroke={P.line} />
        <T x={132} y={76} s={9.5} c={P.text} w={800}>เพิ่มอีเมล Gmail</T>
        <T x={132} y={92} s={7} c={P.muted} w={700}>อีเมล</T>
        <rect x={132} y={96} width={164} height={18} rx={5} fill="#fff" stroke={P.line} /><T x={138} y={108} s={8.5} c={P.text}>myshop@gmail.com</T>
        <T x={132} y={126} s={7} c={P.muted} w={700}>App Password (16 หลัก)</T>
        <rect x={132} y={130} width={164} height={18} rx={5} fill="#fff" stroke={P.line} /><T x={138} y={142} s={8.5} c={P.text}>abcd efgh ijkl mnop</T>
        <Mark x={132} y={92} w={164} h={56} n={3} />
        <rect x={236} y={156} width={60} height={20} rx={8} fill={P.purple} /><T x={266} y={169} s={8} c="#fff" w={700} a="middle">บันทึก</T>
        <Arrow x1={60} y1={150} x2={128} y2={138} bend={14} label="วางรหัส 16 ตัว" />
      </svg>
    ),
  },
];

/* ====================== Hotmail: เชื่อมต่อด้วยบัญชี Microsoft ====================== */
const HOTMAIL_STEPS: Step[] = [
  {
    title: 'กด "เชื่อมต่อ" ที่การ์ด Hotmail',
    detail: <>หลังบ้านร้าน → เมนู <b>ค้นหา OTP</b> → แท็บ <b>บัญชีอีเมล</b> <b>①</b> → การ์ด <b>Hotmail</b> กด <b>เชื่อมต่อ</b> <b>②</b><br /><span className="mg-warn">ถ้าการ์ดขึ้น "ปิดอยู่" 🔒</span> ให้ตั้งค่า Microsoft App ในแท็บ <b>ตั้งค่า API</b> ก่อน (ดูหัวข้อ "วิธีสร้าง Microsoft App" ด้านล่าง)</>,
    img: (
      <svg viewBox="0 0 320 190" className="mg-shot" role="img" aria-hidden="true">
        <rect width="320" height="190" rx="10" fill="#f5f3ff" />
        <T x={12} y={20} s={9} c={P.text} w={800}>หลังบ้านร้าน</T>
        <ShopTabs on={0} />
        <Mark x={12} y={30} w={94} h={20} n={1} />
        <AddCards />
        <Mark x={112} y={58} w={94} h={46} n={2} />
        <rect x={12} y={116} width={296} height={62} rx={10} fill="#fff" stroke={P.line} />
        <T x={24} y={136} s={8} c={P.muted}>อีเมลของร้าน</T>
        <T x={24} y={154} s={8.5} c={P.text} w={700}>shop01@gmail.com</T><T x={24} y={168} s={7} c="#0284c7">ยังไม่มี Hotmail — กดเชื่อมต่อด้านบน</T>
        <Arrow x1={250} y1={142} x2={200} y2={92} bend={-20} />
      </svg>
    ),
  },
  {
    title: 'ล็อกอินบัญชี Hotmail / Outlook',
    detail: <>ระบบพาไปหน้าของ <b>Microsoft</b> (login.live.com — ของจริง ปลอดภัย) → พิมพ์อีเมล Hotmail ที่จะใช้ <b>①</b> → <b>ถัดไป</b> <b>②</b> → ใส่รหัสผ่านของอีเมลนั้น → <b>ลงชื่อเข้าใช้</b><br /><span className="mg-legend">รหัสผ่านพิมพ์ที่หน้า Microsoft เท่านั้น เว็บร้านไม่เห็นและไม่เก็บรหัสผ่าน</span></>,
    img: (
      <Browser url="login.live.com" bg="#f2f2f2">
        <rect x={70} y={34} width={180} height={146} fill="#fff" />
        <MsLogo x={84} y={48} s={6} /><T x={100} y={58} s={9} c={M.muted} w={700}>Microsoft</T>
        <T x={84} y={82} s={12} c={M.text} w={700}>ลงชื่อเข้าใช้</T>
        <line x1={84} y1={112} x2={236} y2={112} stroke={M.blue} strokeWidth={1.4} />
        <T x={84} y={107} s={9} c={M.text}>shop02@hotmail.com</T>
        <Mark x={82} y={94} w={156} h={20} n={1} />
        <T x={84} y={130} s={7} c={M.blue}>ไม่มีบัญชีใช่หรือไม่ สร้างบัญชี</T>
        <rect x={190} y={146} width={48} height={20} fill={M.blue} /><T x={214} y={159} s={8.5} c="#fff" w={700} a="middle">ถัดไป</T>
        <Mark x={190} y={146} w={48} h={20} n={2} />
        <Arrow x1={40} y1={170} x2={186} y2={160} bend={18} />
      </Browser>
    ),
  },
  {
    title: 'กด "ยอมรับ" ให้สิทธิ์อ่านเมล',
    detail: <>Microsoft จะถามว่าให้แอปของร้าน <b>อ่านอีเมล</b> ได้ไหม → กด <b>ยอมรับ</b> (Accept) <b>①</b><br /><span className="mg-warn">ต้องกดยอมรับให้ครบ</span> ถ้ากดยกเลิก ระบบจะอ่านรหัส OTP จากกล่องนี้ไม่ได้</>,
    img: (
      <Browser url="login.live.com/oauth20_authorize" bg="#f2f2f2">
        <rect x={60} y={32} width={200} height={150} fill="#fff" />
        <MsLogo x={74} y={44} s={6} /><T x={90} y={54} s={8} c={M.muted}>shop02@hotmail.com</T>
        <T x={74} y={76} s={10.5} c={M.text} w={700}>ให้แอปนี้เข้าถึงข้อมูลของคุณ?</T>
        <T x={74} y={92} s={8} c={M.muted}>SysRent OTP ต้องการสิทธิ์:</T>
        <T x={78} y={108} s={8} c={M.text}>✉ อ่านอีเมลของคุณ</T>
        <T x={78} y={122} s={8} c={M.text}>↻ เข้าถึงต่อเนื่อง (ไม่ต้องล็อกอินซ้ำ)</T>
        <rect x={136} y={152} width={52} height={20} fill="#fff" stroke={M.line} /><T x={162} y={165} s={8} c={M.text} a="middle">ยกเลิก</T>
        <rect x={194} y={152} width={52} height={20} fill={M.blue} /><T x={220} y={165} s={8.5} c="#fff" w={700} a="middle">ยอมรับ</T>
        <Mark x={194} y={152} w={52} h={20} n={1} />
        <Arrow x1={276} y1={132} x2={242} y2={150} bend={-10} />
      </Browser>
    ),
  },
  {
    title: 'กลับมาที่หลังบ้าน — เสร็จแล้ว',
    detail: <>ระบบพากลับมาหลังบ้าน ขึ้นข้อความ <b>เชื่อมต่อเรียบร้อย</b> และอีเมลขึ้นในรายการ <b>①</b><br />เว็บแบบตัวแทน: กดปุ่ม <b>สีแดง</b> เพื่อ <b>ตั้งรหัส 4 หลัก</b> ให้อีเมลนี้ <b>②</b> แล้วส่งอีเมล + รหัสให้ลูกค้า<br /><span className="mg-legend">ถ้าภายหลังขึ้น "ต้องเชื่อมใหม่" ให้กดปุ่มเชื่อมใหม่ที่อีเมลนั้น แล้วใส่รหัสผ่านอีกครั้ง</span></>,
    img: (
      <svg viewBox="0 0 320 190" className="mg-shot" role="img" aria-hidden="true">
        <rect width="320" height="190" rx="10" fill="#f5f3ff" />
        <rect x={40} y={14} width={240} height={24} rx={12} fill="#065f46" /><T x={160} y={30} s={8.5} c="#fff" w={700} a="middle">✓ เชื่อมต่อบัญชี Hotmail เรียบร้อยแล้ว</T>
        <rect x={12} y={50} width={296} height={128} rx={12} fill="#fff" stroke={P.line} />
        <T x={24} y={70} s={8} c={P.muted} w={700}>อีเมลของร้าน</T>
        {[['shop01@gmail.com', 'G', '#ea4335', '4821'], ['shop02@hotmail.com', 'M', '#0284c7', '']].map(([e, ic, c, pin], i) => (
          <g key={e}>
            <rect x={24} y={80 + i * 42} width={272} height={34} rx={8} fill={i === 1 ? '#f0f9ff' : '#fafafa'} />
            <rect x={32} y={88 + i * 42} width={18} height={18} rx={5} fill={c} /><T x={41} y={101 + i * 42} s={8} c="#fff" w={800} a="middle">{ic}</T>
            <T x={58} y={101 + i * 42} s={8.5} c={P.text} w={700}>{e}</T>
            {pin ? <><rect x={226} y={88 + i * 42} width={62} height={18} rx={6} fill="#ecfdf5" /><T x={257} y={100 + i * 42} s={7.5} c="#047857" w={700} a="middle">รหัส {pin}</T></>
              : <><rect x={226} y={88 + i * 42} width={62} height={18} rx={6} fill="#e11d48" /><T x={257} y={100 + i * 42} s={7.5} c="#fff" w={700} a="middle">ตั้งรหัส 4 หลัก</T></>}
          </g>
        ))}
        <Mark x={24} y={122} w={190} h={34} n={1} />
        <Mark x={226} y={130} w={62} h={18} n={2} />
        <Arrow x1={160} y1={172} x2={228} y2={150} bend={12} label="ตัวแทน: ตั้งรหัส" />
      </svg>
    ),
  },
];

/* ====================== Microsoft App (ตั้งครั้งเดียว ใน Azure) ====================== */
const AZ = { bg: '#faf9f8', side: '#f3f2f1', blue: '#0078d4', text: '#323130', muted: '#605e5c', line: '#edebe9' };
const Azure = ({ url = 'entra.microsoft.com', menu, on, children }: { url?: string; menu: string[]; on: number; children: React.ReactNode }) => (
  <Browser url={url} bg={AZ.bg}>
    <rect y={22} width={320} height={16} fill="#0f1a2b" /><T x={10} y={33} s={7.5} c="#fff" w={700}>Microsoft Entra admin center</T>
    <rect y={38} width={92} height={152} fill={AZ.side} />
    {menu.map((m, i) => (
      <g key={m}>{i === on && <rect x={4} y={44 + i * 18} width={84} height={15} rx={3} fill="#deecf9" />}<T x={10} y={55 + i * 18} s={7.5} c={i === on ? AZ.blue : AZ.text} w={i === on ? 700 : 500}>{m}</T></g>
    ))}
    {children}
  </Browser>
);
const APP_MENU = ['Overview', 'Authentication', 'Certificates & secrets', 'API permissions'];

const MSAPP_STEPS: Step[] = [
  {
    title: 'สร้าง App registration ใหม่',
    detail: <>เข้า <b>entra.microsoft.com</b> (ล็อกอินด้วยบัญชี Microsoft ของร้าน) → <b>App registrations</b> <b>①</b> → <b>New registration</b> <b>②</b></>,
    img: (
      <Azure menu={['Home', 'Identity', 'App registrations', 'Enterprise apps']} on={2}>
        <Mark x={4} y={80} w={84} h={15} n={1} />
        <T x={104} y={58} s={11} c={AZ.text} w={700}>App registrations</T>
        <rect x={104} y={68} width={84} height={18} rx={2} fill="#fff" stroke={AZ.line} /><T x={112} y={80} s={8} c={AZ.blue} w={700}>+ New registration</T>
        <Mark x={104} y={68} w={84} h={18} n={2} />
        <rect x={104} y={96} width={204} height={84} fill="#fff" stroke={AZ.line} />
        <T x={112} y={112} s={7.5} c={AZ.muted} w={700}>Display name</T>
        {['(ยังไม่มีแอป)'].map((t) => <T key={t} x={112} y={130} s={8} c={AZ.muted}>{t}</T>)}
        <Arrow x1={250} y1={60} x2={192} y2={76} bend={-10} />
      </Azure>
    ),
  },
  {
    title: 'ตั้งชื่อ + ประเภทบัญชี + Redirect URI',
    detail: <>ตั้งชื่อ เช่น <b>SysRent OTP</b> → Supported account types เลือก <b>Personal Microsoft accounts only</b> <b>①</b> → Redirect URI เลือก <b>Web</b> แล้ววางลิงก์จากกล่อง <b>Redirect URI</b> ในหน้าตั้งค่า API ของร้าน <b>②</b> → กด <b>Register</b> <b>③</b></>,
    img: (
      <Browser url="entra.microsoft.com · Register an application" bg={AZ.bg}>
        <T x={12} y={42} s={10.5} c={AZ.text} w={700}>Register an application</T>
        <T x={12} y={58} s={7} c={AZ.muted} w={700}>Name</T>
        <rect x={12} y={62} width={140} height={15} fill="#fff" stroke={AZ.line} /><T x={17} y={73} s={8}>SysRent OTP</T>
        <T x={12} y={92} s={7} c={AZ.muted} w={700}>Supported account types</T>
        <circle cx={17} cy={103} r={3.5} fill="#fff" stroke={AZ.muted} /><T x={25} y={106} s={7.5}>Accounts in this directory only</T>
        <circle cx={17} cy={117} r={3.5} fill="#fff" stroke={AZ.blue} strokeWidth={1.5} /><circle cx={17} cy={117} r={1.8} fill={AZ.blue} /><T x={25} y={120} s={7.5} w={700}>Personal Microsoft accounts only</T>
        <Mark x={10} y={110} w={150} h={14} n={1} />
        <T x={12} y={140} s={7} c={AZ.muted} w={700}>Redirect URI</T>
        <rect x={12} y={144} width={40} height={15} fill="#fff" stroke={AZ.line} /><T x={17} y={155} s={7.5}>Web ▾</T>
        <rect x={56} y={144} width={170} height={15} fill="#fff" stroke={AZ.line} /><T x={60} y={155} s={7}>https://ร้าน.sysrent.shop/api/manage/…</T>
        <Mark x={12} y={144} w={214} h={15} n={2} />
        <rect x={250} y={164} width={58} height={18} fill={AZ.blue} /><T x={279} y={176} s={8.5} c="#fff" w={700} a="middle">Register</T>
        <Mark x={250} y={164} w={58} h={18} n={3} />
        <Arrow x1={262} y1={100} x2={226} y2={142} bend={-14} label="วางลิงก์ร้าน" />
      </Browser>
    ),
  },
  {
    title: 'คัดลอก Application (client) ID',
    detail: <>หน้า <b>Overview</b> <b>①</b> → คัดลอก <b>Application (client) ID</b> <b>②</b> → วางในช่อง <b>Application (client) ID</b> ที่หน้าตั้งค่า API ของร้าน</>,
    img: (
      <Azure url="entra.microsoft.com · SysRent OTP" menu={APP_MENU} on={0}>
        <Mark x={4} y={44} w={84} h={15} n={1} />
        <T x={104} y={58} s={11} c={AZ.text} w={700}>SysRent OTP</T>
        <rect x={104} y={68} width={204} height={110} fill="#fff" stroke={AZ.line} />
        <T x={112} y={86} s={7.5} c={AZ.muted}>Display name</T><T x={196} y={86} s={7.5}>SysRent OTP</T>
        <T x={112} y={104} s={7.5} c={AZ.muted}>Application (client) ID</T><T x={196} y={104} s={7.5} w={700}>13b065c6-37bc-…</T>
        <Mark x={192} y={95} w={110} h={13} n={2} />
        <T x={112} y={122} s={7.5} c={AZ.muted}>Directory (tenant) ID</T><T x={196} y={122} s={7.5} c={AZ.muted}>(ไม่ต้องใช้)</T>
        <Arrow x1={210} y1={160} x2={240} y2={112} bend={-18} label="คัดลอกอันนี้" />
      </Azure>
    ),
  },
  {
    title: 'สร้าง Client secret',
    detail: <><b>Certificates &amp; secrets</b> <b>①</b> → <b>New client secret</b> <b>②</b> → กด Add → คัดลอกช่อง <b>Value</b> <b>③</b> (ไม่ใช่ Secret ID) → วางในช่อง <b>Client Secret</b> ที่หน้าตั้งค่า API<br /><span className="mg-warn">Value แสดงครั้งเดียว — ปิดหน้าไปแล้วต้องสร้างใหม่</span></>,
    img: (
      <Azure url="entra.microsoft.com · Certificates & secrets" menu={APP_MENU} on={2}>
        <Mark x={4} y={80} w={84} h={15} n={1} />
        <T x={104} y={58} s={10} c={AZ.text} w={700}>Certificates &amp; secrets</T>
        <rect x={104} y={66} width={86} height={16} fill="#fff" stroke={AZ.line} /><T x={110} y={77} s={7.5} c={AZ.blue} w={700}>+ New client secret</T>
        <Mark x={104} y={66} w={86} h={16} n={2} />
        <rect x={104} y={92} width={204} height={86} fill="#fff" stroke={AZ.line} />
        <T x={112} y={106} s={7} c={AZ.muted} w={700}>Description</T><T x={170} y={106} s={7} c={AZ.muted} w={700}>Value</T><T x={250} y={106} s={7} c={AZ.muted} w={700}>Secret ID</T>
        <line x1={104} y1={112} x2={308} y2={112} stroke={AZ.line} />
        <T x={112} y={126} s={7.5}>otp</T><T x={170} y={126} s={7.5} w={700}>WwW8Q~gZ0g…</T><T x={250} y={126} s={7.5} c={AZ.muted}>9c1e…</T>
        <Mark x={166} y={117} w={74} h={13} n={3} />
        <Arrow x1={170} y1={164} x2={204} y2={134} bend={-12} label="คัดลอก Value" />
      </Azure>
    ),
  },
  {
    title: 'เพิ่มสิทธิ์อ่านเมล',
    detail: <><b>API permissions</b> <b>①</b> → <b>Add a permission</b> → <b>Microsoft Graph</b> → <b>Delegated permissions</b> → ติ๊ก <b>Mail.Read</b> และ <b>offline_access</b> <b>②</b> → Add permissions</>,
    img: (
      <Azure url="entra.microsoft.com · API permissions" menu={APP_MENU} on={3}>
        <Mark x={4} y={98} w={84} h={15} n={1} />
        <T x={104} y={58} s={10} c={AZ.text} w={700}>API permissions</T>
        <rect x={104} y={66} width={204} height={112} fill="#fff" stroke={AZ.line} />
        <T x={112} y={82} s={7} c={AZ.muted} w={700}>Microsoft Graph · Delegated</T>
        {[['User.Read', true, false], ['Mail.Read', true, true], ['offline_access', true, true], ['Mail.Send', false, false]].map(([n, on, mark], i) => (
          <g key={String(n)}>
            <rect x={112} y={90 + i * 18} width={9} height={9} rx={2} fill={on ? AZ.blue : '#fff'} stroke={on ? AZ.blue : AZ.muted} />
            {on && <T x={116.5} y={97.5 + i * 18} s={7} c="#fff" w={800} a="middle">✓</T>}
            <T x={128} y={98 + i * 18} s={8} w={mark ? 700 : 500}>{String(n)}</T>
          </g>
        ))}
        <Mark x={110} y={106} w={100} h={30} n={2} />
        <Arrow x1={270} y1={150} x2={214} y2={122} bend={-14} label="ติ๊ก 2 อัน" />
      </Azure>
    ),
  },
  {
    title: 'บันทึกในหลังบ้านร้าน',
    detail: <>หลังบ้านร้าน → เมนู <b>ค้นหา OTP</b> → แท็บ <b>ตั้งค่า API</b> → การ์ด <b>Microsoft App</b> วาง <b>Client ID</b> + <b>Client Secret</b> <b>①</b> → <b>บันทึก Microsoft App</b> <b>②</b> → ไปแท็บ <b>บัญชีอีเมล</b> แล้วกด <b>เชื่อมต่อ</b> ที่การ์ด Hotmail ได้เลย (ดูวิธีเชื่อม Hotmail)</>,
    img: (
      <svg viewBox="0 0 320 190" className="mg-shot" role="img" aria-hidden="true">
        <rect width="320" height="190" rx="10" fill="#f5f3ff" />
        <T x={12} y={20} s={9} c={P.text} w={800}>หลังบ้านร้าน</T>
        <ShopTabs on={2} />
        <rect x={12} y={58} width={296} height={124} rx={12} fill="#fff" stroke={P.line} />
        <MsLogo x={24} y={68} s={5} /><T x={38} y={77} s={9} c={P.text} w={800}>เชื่อมต่อ Hotmail / Outlook (Microsoft App)</T>
        <T x={24} y={98} s={7} c={P.muted} w={700}>Application (client) ID</T>
        <rect x={24} y={102} width={132} height={18} rx={5} fill="#fff" stroke={P.line} /><T x={30} y={114} s={8}>13b065c6-37bc-…</T>
        <T x={164} y={98} s={7} c={P.muted} w={700}>Client Secret (Value)</T>
        <rect x={164} y={102} width={132} height={18} rx={5} fill="#fff" stroke={P.line} /><T x={170} y={114} s={8}>••••••••••••</T>
        <Mark x={24} y={102} w={272} h={18} n={1} />
        <rect x={24} y={146} width={272} height={22} rx={8} fill={P.purple} /><T x={160} y={161} s={8.5} c="#fff" w={700} a="middle">💾 บันทึก Microsoft App</T>
        <Mark x={24} y={146} w={272} h={22} n={2} />
      </svg>
    ),
  },
];

/** แสดงขั้นตอน: ข้อความซ้าย · ภาพขวา (มือถือเรียงบน-ล่าง) */
function Steps({ steps, color }: { steps: Step[]; color: string }) {
  return (
    <div className="mg-stack">
      {steps.map((s, i) => (
        <div key={s.title} className="mg-step">
          <div className="mg-text">
            <p className="mg-title">
              <span className={`mg-num ${color}`}>{i + 1}</span>{s.title}
            </p>
            <p className="mg-detail">{s.detail}</p>
          </div>
          {s.img}
        </div>
      ))}
    </div>
  );
}

const Legend = () => (
  <p className="mg-legend">ภาพด้านล่างเป็นภาพจำลองหน้าจอ — <span className="mg-hl">กรอบสีแดง + ตัวเลข</span> คือจุดที่ต้องกดตามลำดับ · <span className="mg-hl">ลูกศร</span> ชี้ปุ่มที่ต้องกด</p>
);

export function GmailGuide() {
  return (
    <div className="mg-stack">
      <Legend />
      <Steps steps={GMAIL_STEPS} color="red" />
      <div className="mg-note">
        <p><b>ข้อควรรู้</b></p>
        <p>• App Password <b>ไม่ใช่</b> รหัสผ่าน Gmail ปกติ — ใช้ได้เฉพาะอ่านเมล และกดยกเลิกได้ทุกเมื่อที่หน้า App passwords</p>
        <p>• ถ้าเปลี่ยนรหัสผ่าน Gmail รหัสแอปเดิมจะใช้ไม่ได้ ต้องสร้างใหม่แล้วแก้ในหลังบ้าน</p>
        <p>• ไม่เจอเมนู App passwords = ยังไม่ได้เปิดการยืนยันแบบ 2 ขั้นตอน (ขั้นที่ 1)</p>
      </div>
    </div>
  );
}

export function HotmailGuide() {
  return (
    <div className="mg-stack">
      <Legend />
      <Steps steps={HOTMAIL_STEPS} color="sky" />
      <div className="mg-note">
        <p><b>ข้อควรรู้</b></p>
        <p>• Hotmail / Outlook / Live <b>ไม่ต้องใช้ App Password</b> — ล็อกอินที่หน้า Microsoft แล้วกดยอมรับเท่านั้น</p>
        <p>• ระบบต่ออายุสิทธิ์ให้อัตโนมัติวันละครั้ง ถ้าเปลี่ยนรหัสผ่าน Hotmail ต้องกด <b>เชื่อมใหม่</b> ที่อีเมลนั้น</p>
        <p>• ถ้าขึ้น &quot;Microsoft ไม่อนุญาตให้อ่านกล่องเมล&quot; แปลว่ากดยกเลิกในขั้นที่ 3 — กดเชื่อมต่อใหม่แล้วกด <b>ยอมรับ</b></p>
      </div>
    </div>
  );
}

export function MsAppGuide() {
  return (
    <div className="mg-stack">
      <Legend />
      <Steps steps={MSAPP_STEPS} color="sky" />
      <div className="mg-note">
        <p><b>ข้อควรรู้</b></p>
        <p>• ทำครั้งเดียวต่อร้าน แล้วเชื่อม Hotmail ได้ไม่จำกัดจำนวน</p>
        <p>• Redirect URI ต้องตรงกับในหน้าตั้งค่า API ทุกตัวอักษร (กดปุ่ม <b>คัดลอก</b> ที่หน้านั้น)</p>
        <p>• Client secret มีวันหมดอายุ (สูงสุด 24 เดือน) — ก่อนหมดให้สร้างใหม่แล้วบันทึกทับ</p>
      </div>
    </div>
  );
}
