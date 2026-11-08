'use client';
import Swal from 'sweetalert2';

/**
 * กล่องแจ้งเตือน / ยืนยัน / กรอกข้อมูล (SweetAlert2) แทน alert / confirm / prompt ของเบราว์เซอร์
 * สีและรูปทรงตามธีมร้าน (ดู .swal2-* ใน globals.css)
 */
const base = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  customClass: { popup: 'dlg', confirmButton: 'btn primary', cancelButton: 'btn', denyButton: 'btn danger', input: 'input', actions: 'dlg-acts' },
  showClass: { popup: 'dlg-in' },
  hideClass: { popup: 'dlg-out' },
});

/** แจ้งผล (สำเร็จ / ผิดพลาด / ข้อมูล) */
export function notify(text: string, icon: 'success' | 'error' | 'info' | 'warning' = 'success') {
  if (icon === 'success') {
    // สำเร็จ = ป๊อปเล็กมุมจอ หายเอง ไม่ต้องกดปิด
    return Swal.fire({ toast: true, position: 'top', icon, title: text, showConfirmButton: false, timer: 2200, timerProgressBar: true, customClass: { popup: 'dlg-toast' } });
  }
  return base.fire({ icon, title: text, confirmButtonText: 'ตกลง' });
}

/** ยืนยันก่อนทำ (คืน true = ตกลง) · danger = ปุ่มสีแดง สำหรับลบ / คืนเงิน */
export async function ask(title: string, opts: { text?: string; ok?: string; danger?: boolean } = {}): Promise<boolean> {
  const r = await base.fire({
    icon: opts.danger ? 'warning' : 'question', title, text: opts.text,
    showCancelButton: true, confirmButtonText: opts.ok ?? 'ตกลง', cancelButtonText: 'ยกเลิก', focusCancel: !!opts.danger,
    customClass: { popup: 'dlg', confirmButton: opts.danger ? 'btn danger' : 'btn primary', cancelButton: 'btn', actions: 'dlg-acts' },
  });
  return r.isConfirmed;
}

/** ให้กรอกข้อความ (คืน null = ยกเลิก) · check = ตรวจค่าก่อนปิด คืนข้อความผิดพลาด */
export async function input(title: string, opts: { text?: string; value?: string; placeholder?: string; ok?: string; type?: 'text' | 'number' | 'password'; max?: number; check?: (v: string) => string | null } = {}): Promise<string | null> {
  const r = await base.fire({
    title, text: opts.text, input: opts.type ?? 'text', inputValue: opts.value ?? '', inputPlaceholder: opts.placeholder,
    inputAttributes: { maxlength: String(opts.max ?? 200), autocomplete: 'off' },
    showCancelButton: true, confirmButtonText: opts.ok ?? 'ตกลง', cancelButtonText: 'ยกเลิก',
    inputValidator: (v: string) => { const t = String(v ?? '').trim(); if (!t) return 'กรุณากรอกข้อมูล'; return opts.check?.(t) ?? null; },
  });
  return r.isConfirmed ? String(r.value).trim() : null;
}

/** ให้เลือก 1 ข้อจากรายการ (คืน null = ยกเลิก) */
export async function pick(title: string, options: readonly string[], opts: { text?: string; ok?: string } = {}): Promise<string | null> {
  const r = await base.fire({
    title, text: opts.text, input: 'radio', inputOptions: Object.fromEntries(options.map((o) => [o, o])),
    showCancelButton: true, confirmButtonText: opts.ok ?? 'ถัดไป', cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'dlg dlg-pick', confirmButton: 'btn primary', cancelButton: 'btn', actions: 'dlg-acts' },
    inputValidator: (v: string) => (v ? null : 'กรุณาเลือก 1 ข้อ'),
  });
  return r.isConfirmed ? String(r.value) : null;
}

/** กล่องพิมพ์ข้อความยาว (ไม่บังคับกรอก · คืน null = ยกเลิก) */
export async function note(title: string, opts: { text?: string; placeholder?: string; ok?: string; max?: number } = {}): Promise<string | null> {
  const r = await base.fire({
    title, text: opts.text, input: 'textarea', inputPlaceholder: opts.placeholder,
    inputAttributes: { maxlength: String(opts.max ?? 1000) },
    showCancelButton: true, confirmButtonText: opts.ok ?? 'ส่ง', cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'dlg', confirmButton: 'btn primary', cancelButton: 'btn', input: 'input', actions: 'dlg-acts' },
  });
  return r.isConfirmed ? String(r.value ?? '').trim() : null;
}
