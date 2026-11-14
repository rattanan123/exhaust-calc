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

  const ICON_SAVE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
  const ICON_DEL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';

  // กล่อง "ท่อสำเร็จรูปใกล้สุด": OD ตัวใหญ่ + ID/ส่วนต่าง บรรทัดล่าง
  function stdStat(std) {
    if (!std) return '<div class="v">-</div>';
    const d = std.diffMm;
    const diff = d === 0 ? 'พอดี' : `${d > 0 ? 'ใหญ่กว่า' : 'เล็กกว่า'} ${Math.abs(d)} มม.`;
    return `<div class="v">OD ${std.odMm}</div><div class="u">ID ${std.idMm} · ${diff}</div>`;
  }

  function renderResult(r) {
    const box = $('header-result');
    const multi = r.input.cylinders > 1;
    box.innerHTML = `
      <div class="result-head">
        <h2>ผลคำนวณ</h2>
        <p class="hint num">${r.input.cc} cc · ${r.input.cylinders} สูบ · จูน ${r.input.rpm} rpm</p>
      </div>
      <div class="stats">
        <div class="stat hl"><div class="k">ความยาวคอท่อ</div><div class="v">${r.primary.lengthMm}</div><div class="u">มม. · ${r.primary.lengthIn} นิ้ว</div></div>
        <div class="stat hl"><div class="k">ขนาดใน (ID)</div><div class="v">${r.primary.idMm}</div><div class="u">มม. · ${r.primary.idIn} นิ้ว</div></div>
        <div class="stat"><div class="k">ขนาดนอก (OD)</div><div class="v">${r.primary.odMm}</div><div class="u">มม. · ผนัง ${r.input.wall}</div></div>
        <div class="stat"><div class="k">ท่อสำเร็จรูปใกล้สุด</div>${stdStat(r.primary.std)}</div>
      </div>
      <h3>${multi ? `ท่อรวม (collector ${r.input.cylinders} เข้า 1)` : 'ท่อหลัก / ต่อไปหม้อพัก'}</h3>
      <div class="stats">
        <div class="stat"><div class="k">ขนาดใน (ID)</div><div class="v">${r.collector.idMm}</div><div class="u">มม. · ${r.collector.idIn} นิ้ว</div></div>
        <div class="stat"><div class="k">ท่อสำเร็จรูปใกล้สุด</div>${stdStat(r.collector.std)}</div>
      </div>
      ${multi ? '' : '<p class="hint">สูบเดียว: ท่อหลักใช้ขนาดเท่าคอท่อ หรือโตขึ้น 1 ขั้น (2–3 มม.) หลังจุดต่อ</p>'}
      ${r.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join('')}
      <p class="formula">สูตร: ED = 180 + ${r.input.evo} = ${r.ed}° · ความยาว = 850×ED/รอบ − 3 · ID = √(cc ต่อสูบ ÷ ((ยาว+3)×25)) × 2.1 — เป็นค่าเริ่มต้นสำหรับลองจูน ควรทดสอบจริงบนแท่น/ถนน</p>
      <div class="save-row">
        <label class="field"><span>ชื่อที่จะบันทึก</span><input id="save-name" maxlength="40" placeholder="เช่น เวฟของฉัน"></label>
        <button id="save-btn" type="button" class="btn primary">${ICON_SAVE}<span>บันทึก</span></button>
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
      btn.innerHTML = `${ICON_SAVE}<span>บันทึกแล้ว</span>`;
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
      const when = isNaN(d) ? '' : d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const s = h.summary || {};
      const inp = h.input || {};
      return `<li data-id="${esc(h.id)}">
        <button class="hist-open" data-act="load" type="button" aria-label="เปิดผล ${esc(h.name)}">
          <span class="top"><span class="name">${esc(h.name)}</span><span class="when">${esc(when)}</span></span>
          <span class="meta num">${esc(inp.cc)} cc · ${esc(inp.cylinders)} สูบ · ${esc(inp.rpm)} rpm</span>
          <span class="chips"><span class="chip acc">ยาว ${esc(s.lengthMm)} มม.</span><span class="chip">ID ${esc(s.idMm)} มม.</span></span>
        </button>
        <button class="icon-btn" data-act="del" type="button" aria-label="ลบ ${esc(h.name)}">${ICON_DEL}</button></li>`;
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
    // แถบเทียบ: อันที่ใหญ่กว่า = 100% (ไม่มีท่อใหม่ = แถบเดิมเต็ม)
    const max = Math.max(r.oldAreaMm2, r.newAreaMm2 || 0) || 1;
    const bar = (label, mm2, cm2, cls) => `<div class="area-row">
        <div class="lbl"><span>${label}</span><b>${mm2} มม.² <small style="font-weight:400;color:var(--muted)">(${cm2} ซม.²)</small></b></div>
        <div class="track"><i class="${cls}" style="width:${Math.max(2, (mm2 / max) * 100).toFixed(1)}%"></i></div></div>`;
    let html = '<div class="area-box">' + bar('ท่อเดิม', r.oldAreaMm2, r.oldAreaCm2, '');
    if (r.newAreaMm2 != null) {
      const sign = r.changePct > 0 ? '+' : '';
      html += bar('ท่อใหม่', r.newAreaMm2, r.newAreaCm2, 'new') +
        `<div class="area-sum"><span>พื้นที่เปลี่ยนไป</span><span class="chip big ${r.changePct >= 0 ? 'acc' : 'down'}">${sign}${r.changePct}%</span></div>`;
    }
    html += '</div>';
    if (r.newAreaMm2 != null && r.changePct > 30) html += '<div class="warn">พื้นที่โตขึ้นเกิน 30% — รอบต่ำอาจหายได้</div>';
    areaOut.innerHTML = html;
  }
  areaOld.addEventListener('input', onArea);
  areaNew.addEventListener('input', onArea);

  /* ---------- เริ่มต้น ---------- */
  fillInput(store.get(LAST_KEY, null));
})();
