'use client';
import { useState } from 'react';

/** รูปหน้าสินค้า: รูปใหญ่ + แถบรูปย่อให้กดสลับ · รูปแรกคือโลโก้ / รูปหลักของสินค้า */
export function ProductGallery({ cover, images, name }: { cover: React.ReactNode; images: string[]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="card pd-media pd-gallery">
      <div className="pd-main">{i === 0 ? cover : <img src={images[i - 1]} alt={`${name} รูปที่ ${i + 1}`} />}</div>
      <div className="pd-thumbs">
        <button type="button" className={i === 0 ? 'on' : ''} aria-pressed={i === 0} aria-label={`${name} รูปที่ 1`} onClick={() => setI(0)}>{cover}</button>
        {images.map((u, k) => (
          <button key={`${u}${k}`} type="button" className={i === k + 1 ? 'on' : ''} aria-pressed={i === k + 1} aria-label={`${name} รูปที่ ${k + 2}`} onClick={() => setI(k + 1)}>
            <img src={u} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
