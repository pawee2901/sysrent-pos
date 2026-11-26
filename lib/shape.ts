/** ความมนของปุ่ม / กล่องทั้งร้าน (shops.btn_radius / box_radius · null = ตามธีม) → data-* + ตัวแปร CSS บน .store */
export function shapeAttrs(btn: number | null | undefined, box: number | null | undefined) {
  const b = typeof btn === 'number' ? btn : null, x = typeof box === 'number' ? box : null;
  return {
    attrs: { ...(b !== null ? { 'data-btnr': '' } : {}), ...(x !== null ? { 'data-boxr': '' } : {}) },
    vars: {
      ...(b !== null ? { '--btn-r': `${b}px` } : {}),
      ...(x !== null ? { '--box-r': `${x}px`, '--radius': `${x}px`, '--radius-sm': `${Math.round(x * 0.65)}px` } : {}),
    } as Record<string, string>,
  };
}
