# ExhaustProject — แอปคำนวณท่อไอเสียมอเตอร์ไซค์

> Claude อ่านไฟล์นี้อัตโนมัติทุกครั้งที่เปิดแชทในโฟลเดอร์นี้ — อัปเดตทุกครั้งที่จบงานสำคัญ
> สรุปการแก้ไขภาษาไทยสำหรับ user อยู่ใน `CHANGELOG.md` (หัวข้อวันที่ใหม่ไว้บนสุด)
> โปรเจกต์นี้ **แยกจาก** `D:\projectEgg2026` (ตู้ฟักไข่) — ห้ามแก้ไฟล์ที่นั่น

## หลักการทำงาน (user สั่งไว้ — ทำเสมอ)
กฎกลางอยู่ใน `~/.claude/CLAUDE.md`: **ตอบภาษาไทย**, จำลองเหตุการณ์ทุกครั้ง (ปกติ/ค่าขอบ/ค่าว่าง/กดซ้ำ/ผิดลำดับ),
optimize + responsive (มือถือ 320–375 / แท็บเล็ต 768 / คอม, dark mode, ไม่มี scroll แนวนอน), รายงานตรงๆ ว่าอะไร "ยังไม่ได้ทดสอบจริง",
บอกก่อนรันงานนาน

## ขอบเขตที่ user ยืนยัน (2026-11-14)
- **หน้าที่:** คำนวณขนาดท่อไอเสีย — ไม่ใช่ร้านค้า/จองคิว/วัดเสียง
- **รถ:** มอเตอร์ไซค์เท่านั้น (สูตรรองรับ 4 จังหวะ 1–6 สูบ; **ยังไม่มีสูตร 2 จังหวะ/expansion chamber**)
- **ผู้ใช้:** คนรักรถ/ช่างทั่วไป
- **แพลตฟอร์ม:** แอปมือถือ APK (Android)
- **ออฟไลน์ล้วน:** ไม่มีล็อกอิน ไม่มี Firebase ไม่มีเซ็นเซอร์ — ข้อมูลเก็บใน `localStorage`
- **ผลคำนวณ:** ขนาดคอท่อ/ท่อหลัก (มม./นิ้ว), ความยาวคอท่อ (tuned length), แปลงหน่วย + เทียบพื้นที่หน้าตัด, บันทึกประวัติในเครื่อง

## สถาปัตยกรรม
- **HTML/CSS/JS ล้วน** ใน `www/` (ไม่มี build step, ไม่มี framework, ไม่โหลดอะไรจากเน็ต — ฟอนต์ใช้ของระบบ)
- **Capacitor 6** ห่อ `www/` เป็นแอป Android (`capacitor.config.json`, appId `th.exhaustcalc.app`)
- **สร้าง APK บน GitHub Actions** (`.github/workflows/build-apk.yml`) — เครื่องนี้ไม่มี Node/Android SDK (มีแค่ Java 8)
  - workflow: Node 20 + JDK 17 → `npm install` → `npx cap add android` → `cap sync` → `gradlew assembleDebug` → artifact `exhaust-calc-debug-apk`
  - โฟลเดอร์ `android/` **ไม่ commit** (สร้างใหม่ทุกรอบ) — ถ้าจะแต่งไอคอน/ชื่อ/สิทธิ์ Android ต้องเปลี่ยนมา commit `android/` หรือใช้ `@capacitor/assets`
  - เป็น debug APK (ลงเครื่องได้ ต้องเปิด "ติดตั้งจากแหล่งที่ไม่รู้จัก") — ถ้าจะขึ้น Play Store ต้องทำ release + keystore (ห้าม commit keystore)

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `www/index.html` | หน้าเดียว 3 แท็บ: คอท่อ/ท่อหลัก · แปลงหน่วย · ประวัติ (bottom nav) |
| `www/js/calc.js` | **สูตรทั้งหมด** ฟังก์ชันล้วน ไม่แตะ DOM — `ExhaustCalc.calcHeader / convertLength / compareArea / nearestStdTube` |
| `www/js/app.js` | ผูก UI, preset รุ่นรถ, ประวัติ (`exhaust.history.v1`, สูงสุด 50), จำค่าล่าสุด (`exhaust.lastInput.v1`) |
| `www/css/app.css` | CSS variables + dark mode (`prefers-color-scheme`), safe-area สำหรับมือถือมีรอยบาก |
| `tests/tests.html` | unit test ของ calc.js (เปิดในเบราว์เซอร์ → `window.__testResult`) |

## สูตร (อยู่ใน `calc.js` — แก้ที่เดียว)
- `ED = 180 + EVO` (องศาวาล์วไอเสียเปิดก่อน BDC, ค่าเริ่ม 50)
- ความยาวคอท่อ `P = 850 × ED / RPM − 3` (นิ้ว)
- ID คอท่อ `= √(cc_ต่อสูบ / ((P+3) × 25)) × 2.1` (นิ้ว)
- ท่อรวมหลายสูบ: พื้นที่ = พื้นที่คอท่อ × จำนวนสูบ × `0.72` (≈ 1.2× ที่ 2 สูบ, 1.7× ที่ 4 สูบ) · สูบเดียว = เท่าคอท่อ
- ขอบเขต input ใน `LIMITS` (cc 49–2500, สูบ 1–6, rpm 2000–20000, EVO 20–90, ผนัง 0.5–3)
- ผลเป็นค่าเริ่มต้นสำหรับลองจูน — UI แจ้ง user แล้ว

## วิธีทดสอบบน PC
```
cd D:\exhaustProject
python -m http.server 8765 --bind 127.0.0.1
```
- แอป: http://127.0.0.1:8765/www/index.html · เทสต์: http://127.0.0.1:8765/tests/tests.html
- เช็ค responsive: ตั้ง viewport 320/375/768/1280 แล้วเทียบ `document.documentElement.scrollWidth` กับ `innerWidth` ทุกแท็บ

## ประวัติงาน
- **2026-11-14:** สร้างโปรเจกต์ — สูตรคอท่อ/ท่อรวม, แปลงหน่วย, เทียบพื้นที่, ประวัติ, preset รุ่นรถไทย 11 รุ่น (cc โดยประมาณ),
  Capacitor + workflow GitHub Actions · เทสต์ 29/29 ผ่าน · responsive ผ่าน 320/375/768/1280 + dark mode
  - ⚠️ ยังไม่ได้ทดสอบจริง: build APK บน GitHub (ยังไม่มี repo) และการรันบนมือถือ Android จริง

## งานที่ยังค้าง / ไอเดียต่อ
- user ต้องสร้าง GitHub repo แล้ว push เพื่อให้ได้ APK ครั้งแรก (ดู `README.md`)
- ไอคอนแอป + splash (ตอนนี้ใช้ไอคอน Capacitor ค่าเริ่มต้น)
- สูตร 2 จังหวะ (expansion chamber) ถ้า user ต้องการ
- ตรวจ cc ของ preset กับสเปกจริงอีกครั้ง
