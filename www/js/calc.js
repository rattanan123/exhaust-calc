/* calc.js — สูตรคำนวณท่อไอเสียมอเตอร์ไซค์ 4 จังหวะ (ฟังก์ชันล้วน ไม่แตะ DOM — ทดสอบได้ใน tests.html)
 *
 * สูตรที่ใช้ (สูตร empirical ที่ช่างแต่งท่อใช้กันทั่วไป — ผลเป็น "จุดเริ่มต้น" ไม่ใช่ค่าตายตัว):
 *   ED = 180 + EVO            (EVO = องศาวาล์วไอเสียเปิดก่อนศูนย์ตายล่าง, BBDC)
 *   P  = (850 × ED / RPM) − 3 (ความยาวคอท่อ, นิ้ว — วัดจากหน้าวาล์ว/พอร์ต)
 *   ID = √(cc_ต่อสูบ / ((P + 3) × 25)) × 2.1   (เส้นผ่านศูนย์กลางในคอท่อ, นิ้ว)
 *   ท่อรวม (collector) หลายสูบ: พื้นที่ ≈ พื้นที่คอท่อรวมทุกสูบ × 0.72
 */
(function (root) {
  'use strict';

  const MM_PER_IN = 25.4;
  const COLLECTOR_AREA_FACTOR = 0.72;

  // ขนาดท่อสำเร็จรูปที่หาได้ทั่วไป (เส้นผ่านศูนย์กลางนอก OD, มม.)
  const STD_TUBE_OD_MM = [19, 22, 25.4, 28, 30, 32, 34, 35, 38, 42, 45, 48, 51, 54, 57, 60, 63.5, 70, 76];

  // ขอบเขตค่าที่ยอมรับ (กันค่าพิมพ์ผิด/ค่าเพี้ยน)
  const LIMITS = {
    cc:        { min: 49,  max: 2500,  label: 'ความจุกระบอกสูบ (cc)' },
    cylinders: { min: 1,   max: 6,     label: 'จำนวนสูบ' },
    rpm:       { min: 2000, max: 20000, label: 'รอบที่ต้องการจูน (rpm)' },
    evo:       { min: 20,  max: 90,    label: 'องศาวาล์วไอเสียเปิด (BBDC)' },
    wall:      { min: 0.5, max: 3,     label: 'ความหนาผนังท่อ (มม.)' },
  };

  const round = (v, d = 1) => {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  };

  /** แปลง input เป็นตัวเลข: รับ "1,250" / " 125 " / "12.5"; ว่าง/ไม่ใช่ตัวเลข → NaN */
  function toNum(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  /** ตรวจค่าตาม LIMITS — คืน array ข้อความผิดพลาด (ว่าง = ผ่าน) */
  function validate(fields) {
    const errors = [];
    for (const key of Object.keys(fields)) {
      const lim = LIMITS[key];
      const v = fields[key];
      if (!lim) continue;
      if (!Number.isFinite(v)) errors.push({ field: key, msg: `กรุณากรอก${lim.label} เป็นตัวเลข` });
      else if (v < lim.min || v > lim.max) errors.push({ field: key, msg: `${lim.label} ต้องอยู่ระหว่าง ${lim.min}–${lim.max}` });
      else if (key === 'cylinders' && !Number.isInteger(v)) errors.push({ field: key, msg: 'จำนวนสูบต้องเป็นจำนวนเต็ม' });
    }
    return errors;
  }

  const circleArea = (d) => Math.PI * d * d / 4;
  const diaFromArea = (a) => Math.sqrt(4 * a / Math.PI);

  /** หาท่อสำเร็จรูปที่ ID (= OD − 2×ผนัง) ใกล้ค่าที่ต้องการที่สุด */
  function nearestStdTube(targetIdMm, wallMm) {
    let best = null;
    for (const od of STD_TUBE_OD_MM) {
      const id = od - 2 * wallMm;
      if (id <= 0) continue;
      const diff = Math.abs(id - targetIdMm);
      if (!best || diff < best.diff) best = { od, id: round(id, 1), diff };
    }
    return best && { odMm: best.od, idMm: best.id, diffMm: round(best.id - targetIdMm, 1) };
  }

  /**
   * คำนวณคอท่อ + ท่อรวม
   * @param {{cc:number, cylinders:number, rpm:number, evo:number, wall:number}} input
   * @returns {{ok:true, ...} | {ok:false, errors:Array}}
   */
  function calcHeader(input) {
    const v = {
      cc: toNum(input.cc),
      cylinders: toNum(input.cylinders),
      rpm: toNum(input.rpm),
      evo: toNum(input.evo),
      wall: toNum(input.wall),
    };
    const errors = validate(v);
    if (errors.length) return { ok: false, errors };

    const ccPerCyl = v.cc / v.cylinders;
    const ed = 180 + v.evo;
    const lengthIn = (850 * ed) / v.rpm - 3;
    const idIn = Math.sqrt(ccPerCyl / ((lengthIn + 3) * 25)) * 2.1;
    const idMm = idIn * MM_PER_IN;
    const lengthMm = lengthIn * MM_PER_IN;

    const warnings = [];
    if (ccPerCyl < 50) warnings.push('cc ต่อสูบน้อยมาก — ผลอาจคลาดเคลื่อน');
    if (lengthMm > 1500) warnings.push('คอท่อยาวมาก (> 1.5 ม.) — ลองตั้งรอบจูนให้สูงขึ้น');
    if (lengthMm < 250) warnings.push('คอท่อสั้นมาก (< 25 ซม.) — ติดตั้งจริงอาจไม่พอ ลองลดรอบจูน');

    // ท่อรวม: สูบเดียว = ท่อหลักขนาดเท่าคอท่อหรือโตขึ้น 1 ขั้น; หลายสูบ = จากพื้นที่รวม
    const collectorIdMm = v.cylinders === 1
      ? idMm
      : diaFromArea(circleArea(idMm) * v.cylinders * COLLECTOR_AREA_FACTOR);

    return {
      ok: true,
      input: v,
      ccPerCyl: round(ccPerCyl, 1),
      ed,
      primary: {
        lengthIn: round(lengthIn, 1),
        lengthMm: Math.round(lengthMm),
        idIn: round(idIn, 2),
        idMm: round(idMm, 1),
        odMm: round(idMm + 2 * v.wall, 1),
        areaMm2: Math.round(circleArea(idMm)),
        std: nearestStdTube(idMm, v.wall),
      },
      collector: {
        idMm: round(collectorIdMm, 1),
        idIn: round(collectorIdMm / MM_PER_IN, 2),
        odMm: round(collectorIdMm + 2 * v.wall, 1),
        std: nearestStdTube(collectorIdMm, v.wall),
      },
      warnings,
    };
  }

  /** แปลงหน่วยความยาว */
  function convertLength(value, from) {
    const n = toNum(value);
    if (!Number.isFinite(n) || n < 0) return null;
    const mm = from === 'in' ? n * MM_PER_IN : n;
    return { mm: round(mm, 2), in: round(mm / MM_PER_IN, 3), cm: round(mm / 10, 2) };
  }

  /**
   * พื้นที่หน้าตัด + เทียบท่อเดิม/ท่อใหม่ (ค่าเป็น ID, มม.)
   * newMm ไม่บังคับ — ถ้ามีจะคืน % ที่เปลี่ยนไป
   */
  function compareArea(oldMm, newMm) {
    const a = toNum(oldMm);
    if (!Number.isFinite(a) || a <= 0 || a > 300) return { ok: false, msg: 'ขนาดท่อเดิมต้องอยู่ระหว่าง 0–300 มม.' };
    const out = { ok: true, oldAreaMm2: round(circleArea(a), 1), oldAreaCm2: round(circleArea(a) / 100, 2) };
    const bRaw = newMm;
    if (bRaw === '' || bRaw == null) return out;
    const b = toNum(bRaw);
    if (!Number.isFinite(b) || b <= 0 || b > 300) return { ok: false, msg: 'ขนาดท่อใหม่ต้องอยู่ระหว่าง 0–300 มม.' };
    out.newAreaMm2 = round(circleArea(b), 1);
    out.newAreaCm2 = round(circleArea(b) / 100, 2);
    out.changePct = round((circleArea(b) / circleArea(a) - 1) * 100, 1);
    return out;
  }

  const api = { calcHeader, convertLength, compareArea, nearestStdTube, toNum, LIMITS, STD_TUBE_OD_MM, MM_PER_IN };
  root.ExhaustCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
