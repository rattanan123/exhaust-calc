/* app.js — เชื่อม UI กับ calc.js · เก็บประวัติใน localStorage (ออฟไลน์ ไม่มีล็อกอิน) */
(function () {
  'use strict';
  const C = window.ExhaustCalc;
  const $ = (id) => document.getElementById(id);

  const HIST_KEY = 'exhaust.history.v1';
  const LAST_KEY = 'exhaust.lastInput.v1';
  const HIST_MAX = 50;

  // ค่าโดยประมาณ — ผู้ใช้ควรตรวจกับคู่มือรถ
  const PRESETS = [
    { name: 'Honda Wave 110i', cc: 109, cyl: 1 },
    { name: 'Honda Wave 125i', cc: 125, cyl: 1 },
    { name: 'Honda MSX125 / Grom', cc: 124, cyl: 1 },
    { name: 'Honda PCX160 / Click160', cc: 157, cyl: 1 },
    { name: 'Honda CBR150R', cc: 149, cyl: 1 },
    { name: 'Yamaha R15 / MT-15', cc: 155, cyl: 1 },
    { name: 'Yamaha Aerox / NMAX 155', cc: 155, cyl: 1 },
    { name: 'Honda CRF250 / CBR250R (สูบเดียว)', cc: 250, cyl: 1 },
    { name: 'Honda CBR250RR (2 สูบ)', cc: 250, cyl: 2 },
    { name: 'Kawasaki Ninja 400 (2 สูบ)', cc: 399, cyl: 2 },
    { name: 'Honda CB650R / CBR650R (4 สูบ)', cc: 649, cyl: 4 },
  ];

  /* ---------- storage (ห่อ try/catch — บางเครื่อง/โหมดส่วนตัว localStorage ใช้ไม่ได้) ---------- */
  const store = {
    get(key, fallback) {
      try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; }
      catch (e) { return false; }
    },
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------- แท็บ ---------- */
  const navBtns = document.querySelectorAll('.bottomnav button');
  function showTab(id) {
    document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== id; });
    navBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    if (id === 'tab-history') renderHistory();
    window.scrollTo(0, 0);
  }
  navBtns.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* ---------- คอท่อ/ท่อหลัก ---------- */
  const FIELDS = ['cc', 'cylinders', 'rpm', 'evo', 'wall'];
  const presetSel = $('preset');
  PRESETS.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${p.name} — ${p.cc} cc`;
    presetSel.appendChild(o);
  });
  presetSel.addEventListener('change', () => {
    const p = PRESETS[Number(presetSel.value)];
    if (!p || presetSel.value === '') return;
    $('cc').value = p.cc;
    $('cylinders').value = String(p.cyl);
  });

  function readInput() {
    const o = {};
    FIELDS.forEach((f) => { o[f] = $(f).value; });
    return o;
  }
  function fillInput(o) {
    FIELDS.forEach((f) => { if (o && o[f] != null && o[f] !== '') $(f).value = o[f]; });
  }

  let lastResult = null;

  function stdText(std) {
    if (!std) return '-';
    const sign = std.diffMm > 0 ? '+' : '';
    return `OD ${std.odMm} มม. (ID ${std.idMm}, ${sign}${std.diffMm})`;
  }

  function renderResult(r) {
    const box = $('header-result');
    const multi = r.input.cylinders > 1;
    box.innerHTML = `
      <h2>ผลคำนวณ <span class="hint" style="margin:0">${r.input.cc} cc · ${r.input.cylinders} สูบ · จูน ${r.input.rpm} rpm</span></h2>
      <div class="stats">
        <div class="stat hl"><div class="k">ความยาวคอท่อ</div><div class="v">${r.primary.lengthMm}</div><div class="u">มม. (${r.primary.lengthIn} นิ้ว)</div></div>
        <div class="stat hl"><div class="k">เส้นผ่านศูนย์กลางใน (ID)</div><div class="v">${r.primary.idMm}</div><div class="u">มม. (${r.primary.idIn} นิ้ว)</div></div>
        <div class="stat"><div class="k">OD ที่ต้องใช้ (ผนัง ${r.input.wall})</div><div class="v">${r.primary.odMm}</div><div class="u">มม.</div></div>
        <div class="stat"><div class="k">ท่อสำเร็จรูปที่ใกล้สุด</div><div class="v" style="font-size:1rem">${stdText(r.primary.std)}</div></div>
      </div>
      <h3>${multi ? `ท่อรวม (collector ${r.input.cylinders} เข้า 1)` : 'ท่อหลัก/ท่อต่อไปหม้อพัก'}</h3>
      <div class="stats">
        <div class="stat"><div class="k">ID</div><div class="v">${r.collector.idMm}</div><div class="u">มม. (${r.collector.idIn} นิ้ว)</div></div>
        <div class="stat"><div class="k">ท่อสำเร็จรูปที่ใกล้สุด</div><div class="v" style="font-size:1rem">${stdText(r.collector.std)}</div></div>
      </div>
      ${multi ? '' : '<p class="hint">สูบเดียว: ท่อหลักใช้ขนาดเท่าคอท่อ หรือโตขึ้น 1 ขั้น (2–3 มม.) หลังจุดต่อ</p>'}
      ${r.warnings.map((w) => `<div class="warn">⚠️ ${esc(w)}</div>`).join('')}
      <p class="formula">สูตร: ED = 180 + ${r.input.evo} = ${r.ed}° · ความยาว = 850×ED/รอบ − 3 · ID = √(cc ต่อสูบ ÷ ((ยาว+3)×25)) × 2.1 — เป็นค่าเริ่มต้นสำหรับลองจูน ควรทดสอบจริงบนแท่น/ถนน</p>
      <div class="grid2" style="margin-top:12px;align-items:end">
        <label class="field" style="grid-column:span 1"><span>ชื่อที่จะบันทึก</span><input id="save-name" maxlength="40" placeholder="เช่น เวฟของฉัน"></label>
        <button id="save-btn" type="button" class="btn">💾 บันทึก</button>
      </div>`;
    box.hidden = false;
    $('save-btn').addEventListener('click', saveCurrent);
  }

  $('header-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = readInput();
    const r = C.calcHeader(input);
    const errBox = $('header-errors');
    FIELDS.forEach((f) => $(f).classList.remove('invalid'));
    if (!r.ok) {
      errBox.innerHTML = r.errors.map((x) => `<p>${esc(x.msg)}</p>`).join('');
      errBox.hidden = false;
      r.errors.forEach((x) => $(x.field) && $(x.field).classList.add('invalid'));
      $('header-result').hidden = true;
      lastResult = null;
      return;
    }
    errBox.hidden = true;
    lastResult = r;
    store.set(LAST_KEY, input);
    renderResult(r);
    $('header-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- ประวัติ ---------- */
  function saveCurrent() {
    if (!lastResult) return;
    const btn = $('save-btn');
    const name = ($('save-name').value || '').trim() || `${lastResult.input.cc} cc @ ${lastResult.input.rpm} rpm`;
    const list = store.get(HIST_KEY, []);
    list.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      at: new Date().toISOString(),
      input: lastResult.input,
      summary: { lengthMm: lastResult.primary.lengthMm, idMm: lastResult.primary.idMm, collectorIdMm: lastResult.collector.idMm },
    });
    if (list.length > HIST_MAX) list.length = HIST_MAX;
    if (store.set(HIST_KEY, list)) {
      toast('บันทึกแล้ว');
      btn.disabled = true; // กันกดซ้ำ — คำนวณใหม่ถึงจะบันทึกได้อีก
      btn.textContent = '✓ บันทึกแล้ว';
    } else {
      toast('บันทึกไม่ได้ (พื้นที่เก็บข้อมูลเต็ม/ถูกปิด)');
    }
  }

  function renderHistory() {
    const list = store.get(HIST_KEY, []);
    const ul = $('hist-list');
    $('hist-empty').hidden = list.length > 0;
    $('hist-clear').hidden = list.length === 0;
    ul.innerHTML = list.map((h) => {
      const d = new Date(h.at);
      const when = isNaN(d) ? '' : d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
      const s = h.summary || {};
      return `<li data-id="${esc(h.id)}">
        <div class="info">
          <div class="name">${esc(h.name)}</div>
          <div class="meta">${esc(h.input.cc)} cc · ${esc(h.input.cylinders)} สูบ · ${esc(h.input.rpm)} rpm → ยาว ${esc(s.lengthMm)} มม. · ID ${esc(s.idMm)} มม.</div>
          <div class="meta">${esc(when)}</div>
        </div>
        <div class="acts">
          <button class="btn small" data-act="load" type="button">เปิด</button>
          <button class="btn small danger" data-act="del" type="button" aria-label="ลบ">🗑</button>
        </div></li>`;
    }).join('');
  }

  $('hist-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('li').dataset.id;
    const list = store.get(HIST_KEY, []);
    const item = list.find((h) => h.id === id);
    if (!item) { renderHistory(); return; }
    if (btn.dataset.act === 'load') {
      fillInput(item.input);
      presetSel.value = '';
      showTab('tab-header');
      $('header-form').requestSubmit();
    } else if (btn.dataset.act === 'del') {
      store.set(HIST_KEY, list.filter((h) => h.id !== id));
      renderHistory();
      toast('ลบแล้ว');
    }
  });

  $('hist-clear').addEventListener('click', () => {
    if (!confirm('ลบผลที่บันทึกไว้ทั้งหมด? กู้คืนไม่ได้')) return;
    store.set(HIST_KEY, []);
    renderHistory();
  });

  /* ---------- แปลงหน่วย ---------- */
  const convMm = $('conv-mm'), convIn = $('conv-in'), convOut = $('conv-out');
  function onConv(from) {
    const src = from === 'mm' ? convMm : convIn;
    const dst = from === 'mm' ? convIn : convMm;
    if (src.value.trim() === '') { dst.value = ''; convOut.textContent = ''; return; }
    const r = C.convertLength(src.value, from);
    if (!r) { convOut.textContent = 'กรอกตัวเลขที่ไม่ติดลบ'; return; }
    dst.value = from === 'mm' ? r.in : r.mm;
    convOut.textContent = `= ${r.mm} มม. = ${r.cm} ซม. = ${r.in} นิ้ว`;
  }
  convMm.addEventListener('input', () => onConv('mm'));
  convIn.addEventListener('input', () => onConv('in'));

  const areaOld = $('area-old'), areaNew = $('area-new'), areaOut = $('area-out');
  function onArea() {
    if (areaOld.value.trim() === '') { areaOut.innerHTML = ''; return; }
    const r = C.compareArea(areaOld.value, areaNew.value);
    if (!r.ok) { areaOut.innerHTML = `<div class="errors">${esc(r.msg)}</div>`; return; }
    let html = `<div>ท่อเดิม: <b>${r.oldAreaMm2}</b> มม.² (${r.oldAreaCm2} ซม.²)</div>`;
    if (r.newAreaMm2 != null) {
      const cls = r.changePct >= 0 ? 'up' : 'down';
      const sign = r.changePct > 0 ? '+' : '';
      html += `<div>ท่อใหม่: <b>${r.newAreaMm2}</b> มม.² (${r.newAreaCm2} ซม.²)</div>
               <div class="big ${cls}">${sign}${r.changePct}%</div>`;
      if (r.changePct > 30) html += '<div class="warn">พื้นที่โตขึ้นเกิน 30% — รอบต่ำอาจหายได้</div>';
    }
    areaOut.innerHTML = html;
  }
  areaOld.addEventListener('input', onArea);
  areaNew.addEventListener('input', onArea);

  /* ---------- เริ่มต้น ---------- */
  fillInput(store.get(LAST_KEY, null));
})();
