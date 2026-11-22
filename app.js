(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const phone = $('#phone');
  const STORE = 'oakk.v1';

  const state = {
    servers: [], selected: null, status: 'off', since: 0,
    fx: 'shred', proto: 'All', q: '', settings: { auto: false, kill: true, perMode: 'off', perPkgs: [] },
    dl: Array(36).fill(0), ul: Array(36).fill(0), dlTotal: 0, ulTotal: 0, dlNow: 0, ulNow: 0,
  };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s) { state.servers = s.servers || []; state.selected = s.selected; Object.assign(state.settings, s.settings || {}); }
  } catch {}
  const save = () => localStorage.setItem(STORE, JSON.stringify({ servers: state.servers, selected: state.selected, settings: state.settings }));

  const PROTOS = ['VLESS', 'VMess', 'Troja', 'SS'];
  const protoLabel = p => ({ vless: 'VLESS', vmess: 'VMess', trojan: 'Troja', ss: 'SS' }[p]);
  const b64 = s => { try { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))); } catch { try { return atob(s); } catch { return null; } } };
  const EXAMPLE = 'vmess://' + btoa(JSON.stringify({ v: '2', ps: 'Yangon Fast', add: 'mm.example.com', port: '443', id: '0b6f2f9e-1c3a-4e0e-9b7a-3f1b8f6a2c11', net: 'ws', tls: 'tls' }));

  function parseKey(raw) {
    const t = raw.trim();
    const m = t.match(/^(ss|vmess|vless|trojan):\/\/(.+)$/is);
    if (!m) return null;
    const proto = m[1].toLowerCase();
    let name = '', host = '', port = '';
    if (proto === 'vmess') {
      const j = b64(m[2].split('#')[0].trim());
      if (!j) return null;
      try { const o = JSON.parse(j); name = o.ps || ''; host = o.add || ''; port = String(o.port || ''); } catch { return null; }
    } else {
      const hash = t.indexOf('#');
      if (hash > -1) { try { name = decodeURIComponent(t.slice(hash + 1)); } catch { name = t.slice(hash + 1); } }
      let body = m[2].split('#')[0].split('?')[0];
      if (proto === 'ss' && !body.includes('@')) { const d = b64(body); if (d) body = d; }
      const at = body.lastIndexOf('@');
      const hp = at > -1 ? body.slice(at + 1) : body;
      const mm = hp.match(/^\[?([^\]\/]+?)\]?:(\d+)/);
      if (mm) { host = mm[1]; port = mm[2]; }
    }
    if (!host) return null;
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), proto, name: name || host, host, port, raw: t };
  }

  /* ---------- navigation ---------- */
  let screen = 'home';
  function go(name) {
    screen = name;
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    const tabs = $$('.tab');
    tabs.forEach(t => t.classList.toggle('on', t.dataset.go === name));
    phone.classList.toggle('home-view', name === 'home');
    phone.classList.toggle('sub-view', name === 'perapp');
    placeDot();
    if (name === 'servers') renderServers();
    if (name === 'settings') { $('#setCount').textContent = state.servers.length + ' servers'; renderPerSub(); }
    if (name === 'perapp') openPerApp();
  }
  function placeDot() {
    const t = $('.tab.on'); const d = $('#tabDot'); if (!t) return;
    const pr = $('#tabs').getBoundingClientRect(), tr = t.getBoundingClientRect();
    d.style.transform = `translateX(${tr.left - pr.left + tr.width / 2 - 2.5}px)`;
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  addEventListener('resize', placeDot);

  /* ---------- connection ---------- */
  const fmt = n => n >= 1024 ? (n / 1024).toFixed(1) + ' MB' : Math.round(n) + ' KB';
  const fmtRate = n => Math.round(n) + ' KB/s';
  const sel = () => state.servers.find(s => s.id === state.selected);
  let timer = null, tick = null, connectTO = null;
  const pings = {};

  function renderHome() {
    const s = sel(), has = state.servers.length > 0;
    $('#homeEmpty').hidden = has;
    const row = $('#homeSrv');
    row.hidden = !has || !s;
    if (s) {
      row.className = 'srv-row' + (state.status !== 'off' ? ' selected' : '');
      row.innerHTML = rowInner(s, false) + '<span class="act">›</span>';
    }
    $('#traffic').hidden = state.status !== 'on';
    const st = $('#connState'), sub = $('#connSub'), tg = $('#toggle');
    phone.classList.toggle('connecting', state.status === 'busy');
    phone.classList.toggle('connected', state.status === 'on');
    phone.classList.toggle('on', state.status === 'on');
    tg.setAttribute('aria-checked', state.status === 'on');
    tg.classList.toggle('busy', state.status === 'busy');
    if (state.status === 'off') { st.textContent = 'Disconnected'; sub.textContent = has && s ? `Switch ကို နှိပ်ပြီး ပြန်ချိတ်ပါ · ${s.name}` : 'Key ထည့်ရင် အလိုအလျောက် ချိတ်ပါမယ်'; }
    if (state.status === 'busy') { st.textContent = 'Connecting...'; sub.innerHTML = `<b>${esc(s.name)}</b> · 00:00`; }
    if (state.status === 'on') { st.textContent = 'Connected'; updateClock(); }
  }
  function updateClock() {
    const s = sel(); if (!s || state.status === 'off') return;
    const sec = Math.floor((Date.now() - state.since) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
    $('#connSub').innerHTML = `<b>${esc(s.name)}</b> · ${mm}:${ss}`;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  const native = !!(window.OakNative && OakNative.vpnSupported && OakNative.vpnSupported());
  let pollT = null, lastRx = 0, lastTx = 0, lastAt = 0;
  function goOn() {
    state.status = 'on'; state.since = Date.now();
    state.dl.fill(0); state.ul.fill(0); state.dlTotal = state.ulTotal = 0; state.dlNow = 0; state.ulNow = 0;
    lastRx = lastTx = 0; lastAt = Date.now();
    $('#toggle').disabled = false;
    renderHome(); drawGraphs();
    timer = setInterval(updateClock, 1000);
    tick = setInterval(sample, native ? 1000 : 800);
    if (state.settings.haptics && navigator.vibrate) navigator.vibrate(40);
  }
  function failConnect(msg) {
    clearInterval(pollT); clearInterval(timer); clearInterval(tick);
    state.status = 'off'; $('#toggle').disabled = false; renderHome(); toast(msg);
  }
  function connect() {
    const s = sel();
    if (!s) { go('key'); return; }
    if (state.status !== 'off') return;
    state.status = 'busy'; state.since = Date.now(); renderHome();
    $('#toggle').disabled = true;
    if (!native) { connectTO = setTimeout(goOn, 1800); return; }
    const cfg = buildXray(s.raw);
    if (!cfg) { failConnect(t('bad_key')); return; }
    pushPerApp(); pushDns();
    OakNative.startVpn(JSON.stringify(cfg));
    let n = 0;
    clearInterval(pollT);
    pollT = setInterval(() => {
      const st = OakNative.vpnState();
      if (st === 'on') { clearInterval(pollT); goOn(); }
      else if (st.startsWith('error')) failConnect(st.slice(6) || t('conn_fail'));
      else if (++n > 90) { OakNative.stopVpn(); failConnect(t('conn_fail')); }
    }, 500);
  }
  function disconnect() {
    clearTimeout(connectTO); clearInterval(timer); clearInterval(tick); clearInterval(pollT);
    if (native) OakNative.stopVpn();
    state.status = 'off'; $('#toggle').disabled = false; renderHome();
  }
  $('#toggle').addEventListener('click', () => state.status === 'on' ? disconnect() : connect());

  function sample() {
    if (native) {
      const vs = OakNative.vpnState();
      if (vs !== 'on') { disconnect(); if (vs !== 'off') toast(t('conn_lost')); return; }
      const [tx, rx] = OakNative.vpnStats().split(',').map(Number);
      const now = Date.now(), dt = Math.max(.2, (now - lastAt) / 1000);
      const dRx = lastAt && rx >= lastRx ? rx - lastRx : 0, dTx = lastAt && tx >= lastTx ? tx - lastTx : 0;
      lastRx = rx; lastTx = tx; lastAt = now;
      state.dlNow = dRx / 1024 / dt; state.ulNow = dTx / 1024 / dt;
      state.dl.push(state.dlNow); state.dl.shift(); state.ul.push(state.ulNow); state.ul.shift();
      state.dlTotal = rx / 1024; state.ulTotal = tx / 1024;
      addUsage(dRx + dTx, dt); addSrvUsage(state.selected, dRx + dTx);
      drawGraphs();
      return;
    }
    const walk = (v, lo, hi, step) => Math.max(lo, Math.min(hi, v + (Math.random() - .5) * step));
    state.dlNow = walk(state.dlNow, 40, 1100, 500); state.ulNow = walk(state.ulNow, 8, 200, 90);
    state.dl.push(state.dlNow); state.dl.shift(); state.ul.push(state.ulNow); state.ul.shift();
    state.dlTotal += state.dlNow * .8; state.ulTotal += state.ulNow * .8;
    drawGraphs();
  }
  function path(arr, max, close) {
    const w = 200, h = 30, n = arr.length;
    const pts = arr.map((v, i) => [i * w / (n - 1), h - 2 - (v / max) * (h - 6)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < n; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += `C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
    return close ? d + `L${w},${h}L0,${h}Z` : d;
  }
  function drawGraphs() {
    $('#dlSpeed').textContent = fmtRate(state.dlNow); $('#ulSpeed').textContent = fmtRate(state.ulNow);
    $('#dlTotal').textContent = fmt(state.dlTotal); $('#ulTotal').textContent = fmt(state.ulTotal);
    $('#dlLine').setAttribute('d', path(state.dl, 1200)); $('#dlFill').setAttribute('d', path(state.dl, 1200, true));
    $('#ulLine').setAttribute('d', path(state.ul, 240)); $('#ulFill').setAttribute('d', path(state.ul, 240, true));
  }

  /* ---------- servers ---------- */
  function rowInner(s, withDel) {
    return `<i class="dot"></i><span class="proto">${protoLabel(s.proto)}</span><span class="nm"><b>${esc(s.name)}</b><code>${esc(s.host)}:${esc(s.port)}</code></span>` +
      (pings[s.id] > 0 ? `<span class="ping ${pings[s.id] < 150 ? 'good' : pings[s.id] < 400 ? 'mid' : 'bad'}">${pings[s.id]} ms</span>` : pings[s.id] === -1 ? '<span class="ping bad">x</span>' : '') + (s.isNew ? '<span class="new">NEW</span>' : '') +
      (withDel ? `<button class="del" aria-label="Delete ${esc(s.name)}"><svg class="ic"><use href="#i-x"/></svg></button>` : '');
  }
  function renderBadge() {
    const b = $('#badge'); const n = state.servers.length;
    b.hidden = !n; if (b.textContent !== String(n)) { b.textContent = n; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
  }
  function renderChips() {
    const counts = { All: state.servers.length };
    ['VLESS', 'VMess', 'Troja', 'SS'].forEach(p => counts[p] = state.servers.filter(s => protoLabel(s.proto) === p).length);
    $('#protoChips').innerHTML = ['All', 'VLESS', 'VMess', 'Troja', 'SS'].map(p => `<button class="chip${state.proto === p ? ' on' : ''}" data-p="${p}">${p} · ${counts[p]}</button>`).join('');
  }
  function renderServers(enterId) {
    renderBadge(); renderChips();
    $('#srvTotal').textContent = 'TOTAL · ' + state.servers.length;
    const list = state.servers.filter(s => (state.proto === 'All' || protoLabel(s.proto) === state.proto) && (!state.q || s.name.toLowerCase().includes(state.q)));
    const L = $('#srvList');
    L.innerHTML = '';
    list.forEach(s => {
      const r = document.createElement('div');
      r.className = 'srv-row' + (s.id === state.selected ? ' selected' : '') + (s.id === enterId ? ' enter shine' : '');
      r.dataset.id = s.id; r.tabIndex = 0; r.setAttribute('role', 'button');
      r.innerHTML = rowInner(s, true);
      L.appendChild(r);
    });
    $('#srvEmpty').hidden = state.servers.length > 0 && list.length > 0;
    $('#srvEmpty').textContent = state.servers.length ? 'ရှာလို့ မတွေ့ပါ' : 'Server မရှိသေးပါ';
    $('#setCount').textContent = state.servers.length + ' servers';
  }
  $('#protoChips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { state.proto = c.dataset.p; renderServers(); } });
  $('#search').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); renderServers(); });
  $('#fxChips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; state.fx = c.dataset.fx; $$('#fxChips .chip').forEach(x => x.classList.toggle('on', x === c)); });

  function selectServer(id) {
    if (id === state.selected) return;
    const was = state.status; if (was !== 'off') disconnect();
    state.selected = id; save(); renderServers(); renderHome();
    if (was !== 'off') connect();
  }
  $('#srvList').addEventListener('click', e => {
    if (e.target.closest('.del') && state.fx !== 'hold') { removeServer(e.target.closest('.srv-row'), state.fx); return; }
    if (e.target.closest('.del')) { if (e.detail === 0) removeServer(e.target.closest('.srv-row'), 'poof'); return; }
    const r = e.target.closest('.srv-row'); if (r) selectServer(r.dataset.id);
  });
  $('#srvList').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('srv-row')) { e.preventDefault(); selectServer(e.target.dataset.id); } });
  $('#homeSrv').addEventListener('click', () => go('servers'));

  let holdT = null;
  $('#srvList').addEventListener('pointerdown', e => {
    const d = e.target.closest('.del'); if (!d || state.fx !== 'hold') return;
    const row = d.closest('.srv-row'); const ring = document.createElement('i'); ring.className = 'hold-ring'; row.appendChild(ring);
    holdT = setTimeout(() => { holdT = null; removeServer(row, 'poof'); }, 1000);
    const cancel = () => { if (holdT) { clearTimeout(holdT); holdT = null; ring.remove(); } removeEventListener('pointerup', cancel); removeEventListener('pointercancel', cancel); };
    addEventListener('pointerup', cancel); addEventListener('pointercancel', cancel);
  });

  const rel = el => { const p = phone.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height }; };
  function overlayClone(row) {
    const b = rel(row); const c = row.cloneNode(true);
    Object.assign(c.style, { position: 'absolute', left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', margin: 0, zIndex: 30, pointerEvents: 'none' });
    c.classList.remove('enter', 'shine'); phone.appendChild(c); return { c, b };
  }
  function removeServer(row, fx) {
    const id = row.dataset.id; if (!id || row.classList.contains('gone')) return;
    row.classList.add('gone');
    const finish = () => {
      const h = row.offsetHeight;
      row.style.visibility = 'hidden';
      const a = row.animate([{ height: h + 'px', marginTop: '12px' }, { height: '0px', marginTop: '0px' }], { duration: 320, easing: 'ease-in-out', fill: 'forwards' });
      a.onfinish = () => commitRemove(id);
    };
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (reduce) { commitRemove(id); return; }
    if (fx === 'shred') {
      const N = 9;
      for (let i = 0; i < N; i++) {
        const { c } = overlayClone(row);
        c.style.clipPath = `inset(0 ${100 - (i + 1) * 100 / N}% 0 ${i * 100 / N}%)`;
        const dir = (Math.random() - .5) * 40;
        c.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${40 + Math.random() * 60}px) rotate(${dir}deg)`, opacity: 0 }],
          { duration: 700 + Math.random() * 300, delay: i * 40, easing: 'ease-in', fill: 'forwards' }).onfinish = () => c.remove();
      }
      finish();
    } else if (fx === 'poof') {
      const { c, b } = overlayClone(row);
      c.animate([{ transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(1.25)', opacity: 0, filter: 'blur(10px)' }], { duration: 450, easing: 'ease-out', fill: 'forwards' }).onfinish = () => c.remove();
      for (let i = 0; i < 12; i++) {
        const p = document.createElement('i');
        const sz = 10 + Math.random() * 18;
        Object.assign(p.style, { position: 'absolute', zIndex: 31, borderRadius: '50%', background: '#fff', boxShadow: '0 0 12px #9fb7f0', width: sz + 'px', height: sz + 'px', left: b.x + Math.random() * b.w + 'px', top: b.y + b.h / 2 - sz / 2 + 'px', pointerEvents: 'none' });
        phone.appendChild(p);
        p.animate([{ transform: 'scale(.3)', opacity: .9 }, { transform: `translate(${(Math.random() - .5) * 60}px,${-20 - Math.random() * 40}px) scale(1.6)`, opacity: 0 }], { duration: 600 + Math.random() * 300, easing: 'ease-out', fill: 'forwards' }).onfinish = () => p.remove();
      }
      finish();
    } else {
      const { c } = overlayClone(row);
      c.animate([
        { transform: 'scale(1) rotate(0)', borderRadius: '20px', opacity: 1 },
        { transform: 'scale(.7,.5) rotate(-6deg) skewX(8deg)', borderRadius: '14px', opacity: 1, offset: .45 },
        { transform: 'scale(.12) rotate(35deg)', borderRadius: '50%', opacity: .9, offset: .8 },
        { transform: 'scale(0) rotate(90deg) translateY(60px)', opacity: 0 }], { duration: 750, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => c.remove();
      finish();
    }
  }
  function commitRemove(id) {
    const wasSel = state.selected === id;
    state.servers = state.servers.filter(s => s.id !== id);
    if (wasSel) { if (state.status !== 'off') disconnect(); state.selected = state.servers[0]?.id || null; }
    save(); renderServers(); renderHome();
  }
  $('#btnWipe').addEventListener('click', () => { if (state.status !== 'off') disconnect(); state.servers = []; state.selected = null; save(); renderServers(); renderHome(); });

  /* ---------- key screen ---------- */
  const input = $('#keyInput'), box = $('#keyBox');
  let typeT = null, parseT = null;
  input.addEventListener('focus', () => box.classList.add('focus'));
  input.addEventListener('blur', () => box.classList.remove('focus'));
  input.addEventListener('input', () => { clearTimeout(parseT); parseT = setTimeout(tryParse, 450); status(); });
  function status() {
    const v = input.value.trim(); const k = $('#kbStatus');
    if (!v) k.textContent = 'ss:// · vmess:// · vless:// · trojan://';
    else k.textContent = parseKey(v) ? 'မှန်ကန်ပါတယ်' : 'ရိုက်ထည့်နေသည်...';
  }
  function tryParse() {
    const s = parseKey(input.value); if (!s) return;
    s.isNew = true; addServer(s);
  }
  function addServer(s) {
    if (state.servers.some(x => x.raw === s.raw)) { $('#kbStatus').textContent = 'ဒီ key ရှိပြီးသားပါ'; return; }
    box.classList.add('parsed');
    const fly = $('#fly'); const b = rel($('.kb-head', box)); const t = rel($('.tab[data-go=servers]'));
    fly.innerHTML = `<i class="dot" style="width:8px;height:8px;border-radius:50%;background:#19e08a"></i><span>${protoLabel(s.proto)}</span><span>${esc(s.name)}<small>${esc(s.host)}:${esc(s.port)}</small></span>`;
    Object.assign(fly.style, { left: b.x + 'px', top: b.y + 60 + 'px', transform: 'none', opacity: 1, transition: 'none' });
    fly.hidden = false; void fly.offsetWidth;
    const w = fly.offsetWidth, h = fly.offsetHeight;
    fly.style.transition = '';
    fly.style.transform = `translate(${t.x + t.w / 2 - b.x - w / 2}px,${t.y + t.h / 2 - b.y - 60 - h / 2}px) scale(.25)`;
    fly.style.opacity = 0;
    input.value = '';
    state.servers.unshift(s);
    if (!state.selected) state.selected = s.id;
    save(); renderBadge(); renderHome();
    setTimeout(() => {
      fly.hidden = true; box.classList.remove('parsed');
      go('servers'); renderServers(s.id);
      setTimeout(() => { delete s.isNew; save(); }, 3000);
      if (state.settings.auto) connect();
    }, 750);
  }
  $('#btnExample').addEventListener('click', () => {
    clearInterval(typeT); input.value = ''; let i = 0; const key = EXAMPLE + '#Yangon Fast';
    typeT = setInterval(() => { i += 14; input.value = key.slice(0, i); if (i >= key.length) { clearInterval(typeT); input.value = key; clearTimeout(parseT); status(); parseT = setTimeout(tryParse, 600); } else status(); }, 30);
  });
  $('#btnClear').addEventListener('click', () => { clearInterval(typeT); clearTimeout(parseT); input.value = ''; status(); input.focus(); });
  $('#btnToServers').addEventListener('click', () => { tryParse(); if (!input.value) go('servers'); });

  /* ---------- settings ---------- */
  $$('[data-set]').forEach(b => {
    const k = b.dataset.set; b.setAttribute('aria-checked', !!state.settings[k]);
    b.addEventListener('click', () => { state.settings[k] = !state.settings[k]; b.setAttribute('aria-checked', state.settings[k]); save(); });
  });

  /* ---------- i18n ---------- */
  const I18N = {
    my: {
      empty_p: 'Server မရှိသေးပါ။ Key ထည့်ပြီး စတင်ပါ', add_key: 'Key ထည့်မယ်', add_more: 'Key ထပ်ထည့်မယ်', tab_key: 'Key',
      auto_sub: 'App ဖွင့်တာနဲ့ အလိုအလျောက် ချိတ်မယ်', kill_sub: 'ပြတ်သွားရင် အင်တာနက်ကို ပိတ်ထားမယ်',
      choose: 'ရွေးမယ်', clear: 'ရှင်းမယ်', clip_found: 'Clipboard ထဲမှာ key တွေ့ပါတယ်', use: 'သုံးမယ်',
      conn_time: 'ချိတ်ချိန်', today: 'ဒီနေ့', month: 'ဒီလ', usage: 'DATA သုံးစွဲမှု', download: 'Download', upload: 'Upload', total: 'စုစုပေါင်း',
      example: 'ဥပမာ', fastest: 'အမြန်ဆုံး', ping_test: 'Ping စစ်မယ်', fx_hint: 'ဖျက်တဲ့ animation ရွေးပါ',
      haptics: 'တုန်ခါမှု', haptics_sub: 'ချိတ်ရင် ဖုန်းတုန်မယ်', sound: 'အသံ', sound_sub: 'ချိတ်/ဖြုတ် အသံ',
      install: 'App ထည့်သွင်းမယ်', install_btn: 'Install', install_sub: 'ဖုန်းမှာ app အဖြစ် ထည့်မယ်',
      language: 'ဘာသာစကား', theme: 'Theme', th_auto: 'Auto', th_light: 'Light', th_dark: 'Dark', day_mode: 'DAY MODE', night_mode: 'NIGHT MODE', th_follow: 'စက်အတိုင်း',
      name_note: 'Key ထဲမှာ နာမည်မပါရင် server လိပ်စာကို နာမည်အဖြစ် သုံးမယ်', paste: 'Paste', scan: 'QR Scan',
      supported: 'ထောက်ပံ့တာ:', view_servers: 'Server စာရင်းကြည့်မယ်', wipe: 'Server အားလုံးဖျက်မယ်',
      network: 'NETWORK', perapp: 'Per-app proxy', pm_off: 'Off', pm_off_sub: 'App အားလုံး VPN ဖြတ်မယ်',
      pm_bypass: 'Bypass selected', pm_bypass_sub: 'ရွေးထားတဲ့ App တွေ ရိုးရိုးလိုင်းနဲ့ သုံးမယ် (ဥပမာ KBZPay)',
      pm_only: 'Only selected', pm_only_sub: 'ရွေးထားတဲ့ App တွေပဲ VPN ဖြတ်မယ်',
      search_apps: 'Search apps', apps_sel: 'app ရွေးထားသည်', save: 'သိမ်းမည်', per_saved: 'သိမ်းပြီးပါပြီ',
      per_reconnect: 'သိမ်းပြီးပါပြီ။ ပြန်ချိတ်မှ အသက်ဝင်မယ်', per_pick: 'App အနည်းဆုံး တစ်ခု ရွေးပါ', no_apps: 'App မတွေ့ပါ',
      split_apps: 'App ရွေးချယ်ခြင်း', split_apps_sub: 'VPN သုံးမယ့် app များ',
      about: 'Xray core နဲ့ Android VpnService သုံးထားတဲ့ VPN client ဖြစ်ပါတယ်။ ကိုယ်ပိုင် server key လိုအပ်ပါတယ်။',
      search_ph: 'Server ရှာမယ်', key_ph: 'vmess:// vless:// trojan:// ss:// key ကို ဒီမှာ paste လုပ်ပါ',
      bad_key: 'Key ကို ဖတ်မရပါ', conn_fail: 'မချိတ်နိုင်ပါ', conn_lost: 'ချိတ်ဆက်မှု ပြတ်သွားပါပြီ',
      web_only: 'ဒီအင်္ဂါရပ်က Android app မှာပဲ အလုပ်လုပ်ပါတယ်', no_cam: 'Camera မဖွင့်နိုင်ပါ', no_clip: 'Clipboard ထဲမှာ key မတွေ့ပါ',
      scan_t: 'QR Scan', pinged: 'Ping ပြီးပါပြီ', no_srv: 'Server မရှိပါ', fast_set: 'အမြန်ဆုံး server ကို ရွေးပြီး',
      sub_h: 'SUBSCRIPTION', sub_ph: 'Subscription link ကို paste လုပ်ပါ', sub_update: 'Update', sub_clear: 'ဖယ်ရှားမယ်',
      sub_none: 'Link မထည့်ရသေးပါ', sub_busy: 'ဆွဲနေသည်...', sub_ok: 'server {n} ခု ရပါပြီ', sub_fail: 'Link ကို မဖတ်နိုင်ပါ', sub_bad: 'Link မှန်မှန် ထည့်ပါ',
      sub_last: 'နောက်ဆုံး update', dns_h: 'ROUTING · DNS', dns: 'DNS', bypass_mm: 'မြန်မာ website များ တိုက်ရိုက်သွားမယ်', bypass_mm_sub: '.mm ဆိုက်တွေ VPN မဖြတ်ဘဲ ရိုးရိုးလိုင်းနဲ့ သွားမယ်',
      backup: 'Server list backup', backup_sub: 'Copy လုပ်ထားပြီး ဖုန်းအသစ်မှာ ပြန်ထည့်လို့ရတယ်', export: 'Copy', import: 'Paste',
      backup_done: 'Server {n} ခု copy လုပ်ပြီးပါပြီ', backup_empty: 'Copy လုပ်စရာ server မရှိပါ', import_done: 'Server {n} ခု ထပ်ထည့်ပြီးပါပြီ', import_none: 'Clipboard ထဲမှာ key မတွေ့ပါ',
      usage_srv: 'SERVER အလိုက်',
    },
    en: {
      empty_p: 'No servers yet. Add a key to start', add_key: 'Add key', add_more: 'Add another key', tab_key: 'Key',
      auto_sub: 'Connect automatically when the app opens', kill_sub: 'Block internet if the VPN drops',
      choose: 'Choose', clear: 'Clear', clip_found: 'A key was found in your clipboard', use: 'Use',
      conn_time: 'Connected', today: 'Today', month: 'This month', usage: 'DATA USAGE', download: 'Download', upload: 'Upload', total: 'Total',
      example: 'Example', fastest: 'Fastest', ping_test: 'Test ping', fx_hint: 'Pick a delete animation',
      haptics: 'Vibration', haptics_sub: 'Vibrate when connecting', sound: 'Sound', sound_sub: 'Connect / disconnect sound',
      install: 'Install app', install_btn: 'Install', install_sub: 'Add to your home screen',
      language: 'Language', theme: 'Theme', th_auto: 'Auto', th_light: 'Light', th_dark: 'Dark', day_mode: 'DAY MODE', night_mode: 'NIGHT MODE', th_follow: 'Follow system',
      name_note: 'If the key has no name, the server address is used', paste: 'Paste', scan: 'Scan QR',
      supported: 'Supported:', view_servers: 'View servers', wipe: 'Delete all servers',
      network: 'NETWORK', perapp: 'Per-app proxy', pm_off: 'Off', pm_off_sub: 'All apps go through the VPN',
      pm_bypass: 'Bypass selected', pm_bypass_sub: 'Selected apps use the normal connection (e.g. KBZPay)',
      pm_only: 'Only selected', pm_only_sub: 'Only the selected apps use the VPN',
      search_apps: 'Search apps', apps_sel: 'apps selected', save: 'Save', per_saved: 'Saved',
      per_reconnect: 'Saved. Reconnect to apply', per_pick: 'Pick at least one app', no_apps: 'No apps found',
      split_apps: 'Choose apps', split_apps_sub: 'Apps that use the VPN',
      about: 'A VPN client built on the Xray core and Android VpnService. You need your own server key.',
      search_ph: 'Search servers', key_ph: 'Paste a vmess:// vless:// trojan:// ss:// key here',
      bad_key: 'Could not read this key', conn_fail: 'Could not connect', conn_lost: 'Connection lost',
      web_only: 'This only works in the Android app', no_cam: 'Could not open the camera', no_clip: 'No key found in clipboard',
      scan_t: 'Scan QR', pinged: 'Ping finished', no_srv: 'No servers', fast_set: 'Fastest server selected',
      sub_h: 'SUBSCRIPTION', sub_ph: 'Paste a subscription link', sub_update: 'Update', sub_clear: 'Remove',
      sub_none: 'No link added yet', sub_busy: 'Fetching...', sub_ok: '{n} servers loaded', sub_fail: 'Could not read this link', sub_bad: 'Enter a valid link',
      sub_last: 'Last updated', dns_h: 'ROUTING · DNS', dns: 'DNS', bypass_mm: 'Myanmar websites go direct', bypass_mm_sub: '.mm sites skip the VPN and use the normal connection',
      backup: 'Server list backup', backup_sub: 'Copy the list and paste it on a new phone', export: 'Copy', import: 'Paste',
      backup_done: '{n} servers copied', backup_empty: 'No servers to copy', import_done: '{n} servers added', import_none: 'No keys found in clipboard',
      usage_srv: 'BY SERVER',
    },
  };
  if (!state.settings.lang) state.settings.lang = 'my';
  if (!state.settings.theme) state.settings.theme = 'auto';
  const t = k => (I18N[state.settings.lang] || I18N.my)[k] || k;
  function applyLang() {
    document.documentElement.lang = state.settings.lang;
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    $$('#segLang button').forEach(b => b.classList.toggle('on', b.dataset.v === state.settings.lang));
  }
  const isDark = th => th === 'dark' || (th === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  function applyTheme() {
    const th = state.settings.theme;
    const dark = isDark(th);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#metaTheme').content = dark ? '#080c18' : '#e4ebfb';
    const tg = $('#dnToggle');
    tg.setAttribute('aria-checked', dark ? 'true' : 'false');
    $('#dnAuto').setAttribute('aria-pressed', th === 'auto' ? 'true' : 'false');
  }
  function switchTheme(next, origin) {
    const from = isDark(state.settings.theme);
    state.settings.theme = next; save();
    const to = isDark(next);
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { applyTheme(); return; }
    const r0 = origin.getBoundingClientRect();
    const x = r0.left + r0.width / 2, y = r0.top + r0.height / 2;
    const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const ease = 'cubic-bezier(.4,0,.2,1)';
    if (document.startViewTransition) {
      const vt = document.startViewTransition(() => applyTheme());
      vt.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
          { duration: 700, easing: ease, pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
      return;
    }
    const wipe = document.createElement('div');
    wipe.className = 'theme-wipe';
    wipe.style.cssText = `left:${x - rad}px;top:${y - rad}px;width:${rad * 2}px;height:${rad * 2}px;background:${to ? '#0e1530' : '#dfe8fb'}`;
    document.body.appendChild(wipe);
    const grow = wipe.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 650, easing: ease, fill: 'forwards' });
    grow.onfinish = () => {
      applyTheme();
      wipe.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = () => wipe.remove();
    };
  }
  $('#segLang').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.settings.lang = b.dataset.v; save(); applyLang(); renderServers(); renderHome(); renderUsage(); renderSubInfo(); });
  $('#dnToggle').addEventListener('click', e => switchTheme(isDark(state.settings.theme) ? 'light' : 'dark', e.currentTarget));
  $('#dnAuto').addEventListener('click', e => switchTheme('auto', e.currentTarget));

  let toastT = null;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

  /* ---------- usage ---------- */
  const UKEY = 'oakk.usage';
  let usage = {}; try { usage = JSON.parse(localStorage.getItem(UKEY) || '{}'); } catch {}
  const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let usageSave = 0;
  function addUsage(bytes, secs) {
    const k = dayKey(new Date()); const u = usage[k] || (usage[k] = { b: 0, s: 0 });
    u.b += bytes; u.s += secs;
    if (Date.now() - usageSave > 5000) { usageSave = Date.now(); localStorage.setItem(UKEY, JSON.stringify(usage)); renderUsage(); }
  }
  const fmtB = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  function renderUsage() {
    const now = new Date(), tk = dayKey(now), mk = tk.slice(0, 7);
    let month = 0, secs = 0;
    Object.keys(usage).forEach(k => { if (k.startsWith(mk)) { month += usage[k].b; secs += usage[k].s; } });
    $('#usToday').textContent = fmtB((usage[tk] || { b: 0 }).b); $('#usMonth').textContent = fmtB(month);
    $('#usTime').textContent = secs >= 3600 ? Math.floor(secs / 3600) + 'h ' + Math.floor(secs % 3600 / 60) + 'm' : Math.floor(secs / 60) + 'm';
    $('#usageMonthName').textContent = now.toLocaleString('en', { month: 'long', year: 'numeric' });
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(d); }
    const vals = days.map(d => (usage[dayKey(d)] || { b: 0 }).b), max = Math.max(1, ...vals);
    renderSrvUsage();
    $('#usBars').innerHTML = days.map((d, i) => `<div class="${i === 6 ? 'today' : ''}"><i style="height:${Math.max(3, vals[i] / max * 100)}%"></i><span>${d.toLocaleString('en', { weekday: 'narrow' })}</span></div>`).join('');
  }

  /* ---------- xray config ---------- */
  function qp(u) { const o = {}; u.searchParams.forEach((v, k) => { o[k] = v; }); return o; }
  function streamOf(net, sec, o) {
    const ss = { network: net === 'http' ? 'tcp' : net || 'tcp', security: sec || 'none' };
    if (ss.network === 'ws') ss.wsSettings = { path: o.path || '/', headers: o.host ? { Host: o.host } : {} };
    if (ss.network === 'grpc') ss.grpcSettings = { serviceName: o.serviceName || o.path || '' };
    if (ss.network === 'httpupgrade') ss.httpupgradeSettings = { path: o.path || '/', host: o.host || '' };
    if (ss.network === 'xhttp') ss.xhttpSettings = { path: o.path || '/', host: o.host || '' };
    if (ss.network === 'tcp' && o.headerType === 'http') ss.tcpSettings = { header: { type: 'http', request: { path: [o.path || '/'], headers: { Host: o.host ? [o.host] : [] } } } };
    if (sec === 'tls') ss.tlsSettings = { serverName: o.sni || o.host || o.address, allowInsecure: o.allowInsecure === '1' || o.allowInsecure === 'true', fingerprint: o.fp || 'chrome', alpn: o.alpn ? o.alpn.split(',') : undefined };
    if (sec === 'reality') ss.realitySettings = { serverName: o.sni || '', fingerprint: o.fp || 'chrome', publicKey: o.pbk || '', shortId: o.sid || '', spiderX: o.spx || '' };
    return ss;
  }
  function outboundOf(raw) {
    const m = raw.trim().match(/^(ss|vmess|vless|trojan):\/\/(.+)$/is); if (!m) return null;
    const proto = m[1].toLowerCase();
    if (proto === 'vmess') {
      const j = b64(m[2].split('#')[0].trim()); if (!j) return null;
      const o = JSON.parse(j);
      const tls = o.tls === 'tls' ? 'tls' : 'none';
      return { protocol: 'vmess', settings: { vnext: [{ address: o.add, port: +o.port, users: [{ id: o.id, alterId: +(o.aid || 0), security: o.scy || 'auto' }] }] },
        streamSettings: streamOf(o.net, tls, { path: o.path, host: o.host, sni: o.sni, address: o.add, headerType: o.type, alpn: o.alpn, fp: o.fp }) };
    }
    if (proto === 'ss') {
      let body = raw.trim().slice(5).split('#')[0].split('?')[0];
      if (!body.includes('@')) { const d = b64(body); if (!d) return null; body = d; }
      const at = body.lastIndexOf('@'); let ui = body.slice(0, at); const hp = body.slice(at + 1);
      if (!ui.includes(':')) { const d = b64(ui); if (d) ui = d; }
      const ci = ui.indexOf(':'); const mm = hp.match(/^\[?([^\]\/]+?)\]?:(\d+)/); if (!mm || ci < 0) return null;
      return { protocol: 'shadowsocks', settings: { servers: [{ address: mm[1], port: +mm[2], method: ui.slice(0, ci), password: decodeURIComponent(ui.slice(ci + 1)) }] } };
    }
    const u = new URL(raw.trim()); const o = qp(u); o.address = u.hostname;
    const sec = o.security || (proto === 'trojan' ? 'tls' : 'none');
    const stream = streamOf(o.type, sec, o);
    if (proto === 'vless') return { protocol: 'vless', settings: { vnext: [{ address: u.hostname, port: +u.port, users: [{ id: decodeURIComponent(u.username), encryption: o.encryption || 'none', flow: o.flow || undefined }] }] }, streamSettings: stream };
    return { protocol: 'trojan', settings: { servers: [{ address: u.hostname, port: +u.port, password: decodeURIComponent(u.username) }] }, streamSettings: stream };
  }
  function buildXray(raw) {
    try {
      const ob = outboundOf(raw); if (!ob) return null; ob.tag = 'proxy';
      return {
        log: { loglevel: 'warning' },
        dns: { servers: dnsList() },
        inbounds: [{ tag: 'socks', listen: '127.0.0.1', port: 10808, protocol: 'socks', settings: { udp: true, auth: 'noauth' }, sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] } }],
        outbounds: [ob, { tag: 'direct', protocol: 'freedom' }],
        routing: state.settings.bypassMm ? { domainStrategy: 'AsIs', rules: [{ type: 'field', domain: MM_DOMAINS, outboundTag: 'direct' }] } : undefined,
      };
    } catch { return null; }
  }

  /* ---------- ping ---------- */
  window.__ping = (id, ms) => { pings[id] = ms; renderServers(); };
  function runPing() {
    if (!native) { toast(t('web_only')); return; }
    if (!state.servers.length) { toast(t('no_srv')); return; }
    state.servers.forEach(s => { pings[s.id] = undefined; OakNative.ping(s.id, s.host, +s.port || 443); });
    renderServers(); setTimeout(() => toast(t('pinged')), 4200);
  }
  $('#btnPing').addEventListener('click', runPing);
  $('#btnFast').addEventListener('click', () => {
    const ok = state.servers.filter(s => pings[s.id] > 0).sort((a, b) => pings[a.id] - pings[b.id]);
    if (!ok.length) { runPing(); return; }
    selectServer(ok[0].id); toast(t('fast_set') + ' · ' + pings[ok[0].id] + ' ms');
  });

  /* ---------- clipboard + scan ---------- */
  async function readClip() {
    try { if (window.OakNative && OakNative.readClipboard) return OakNative.readClipboard(); return await navigator.clipboard.readText(); } catch { return ''; }
  }
  const isKey = s => /^(ss|vmess|vless|trojan):\/\//i.test((s || '').trim());
  $('#btnPaste').addEventListener('click', async () => { const c = await readClip(); if (isKey(c)) { input.value = c.trim(); status(); clearTimeout(parseT); parseT = setTimeout(tryParse, 300); } else toast(t('no_clip')); });
  let clipKey = '';
  async function checkClip() { const c = (await readClip()).trim(); clipKey = isKey(c) && !state.servers.some(s => s.raw === c) ? c : ''; $('#clipBanner').hidden = !clipKey; }
  $('#btnClipUse').addEventListener('click', () => { input.value = clipKey; $('#clipBanner').hidden = true; status(); clearTimeout(parseT); parseT = setTimeout(tryParse, 200); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && screen === 'key') checkClip(); });

  let scanStream = null, scanRaf = 0;
  function closeSheet() { cancelAnimationFrame(scanRaf); if (scanStream) { scanStream.getTracks().forEach(x => x.stop()); scanStream = null; } $('#sheetBack').hidden = true; $('#sheetBody').innerHTML = ''; }
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetBack').addEventListener('click', e => { if (e.target.id === 'sheetBack') closeSheet(); });
  $('#btnScan').addEventListener('click', async () => {
    $('#sheetTitle').textContent = t('scan_t');
    $('#sheetBody').innerHTML = '<video id="camV" playsinline muted style="width:100%;border-radius:18px;background:#000"></video><canvas id="camC" hidden></canvas>';
    $('#sheetBack').hidden = false;
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = $('#camV'); v.srcObject = scanStream; await v.play();
      const c = $('#camC'), g = c.getContext('2d', { willReadFrequently: true });
      const loop = () => {
        if (v.videoWidth) {
          c.width = v.videoWidth; c.height = v.videoHeight; g.drawImage(v, 0, 0);
          const r = window.jsQR && jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          if (r && isKey(r.data)) { closeSheet(); input.value = r.data.trim(); status(); tryParse(); return; }
        }
        scanRaf = requestAnimationFrame(loop);
      };
      loop();
    } catch { closeSheet(); toast(t('no_cam')); }
  });

  /* ---------- per-app proxy ---------- */
  let appCache = null, draftMode = 'off', draftSet = new Set(), perQ = '';
  function pushPerApp() {
    if (native && OakNative.setPerApp) OakNative.setPerApp(state.settings.perMode || 'off', (state.settings.perPkgs || []).join(','));
  }
  function renderPerSub() {
    const m = state.settings.perMode || 'off', n = (state.settings.perPkgs || []).length;
    $('#perAppSub').textContent = m === 'off' ? t('pm_off') : (m === 'bypass' ? t('pm_bypass') : t('pm_only')) + ' · ' + n + ' app';
  }
  function loadApps() {
    if (appCache) return appCache;
    appCache = [];
    if (native && OakNative.listApps) { try { appCache = JSON.parse(OakNative.listApps()) || []; } catch { appCache = []; } }
    return appCache;
  }
  function renderApps() {
    const box = $('#appList'), q = perQ.trim().toLowerCase();
    const list = loadApps().filter(a => !q || a.n.toLowerCase().includes(q) || a.p.toLowerCase().includes(q));
    if (!list.length) { box.innerHTML = `<p class="empty-apps">${esc(native ? t('no_apps') : t('web_only'))}</p>`; return; }
    box.innerHTML = list.map(a => `<button type="button" class="app" role="checkbox" aria-checked="${draftSet.has(a.p)}" data-p="${esc(a.p)}"><span class="aic"><b>${esc((a.n[0] || '?').toUpperCase())}</b><img loading="lazy" alt="" src="appicon/${encodeURIComponent(a.p)}.png" onerror="this.remove()"></span><div><b>${esc(a.n)}</b><small>${esc(a.p)}</small></div><i class="chk"></i></button>`).join('');
  }
  function renderPerState() {
    $$('#perModes .mode').forEach(b => { const on = b.dataset.m === draftMode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $('#perCount').textContent = draftSet.size + ' ' + t('apps_sel');
    $('#appList').classList.toggle('dis', draftMode === 'off');
  }
  function openPerApp() {
    draftMode = state.settings.perMode || 'off';
    draftSet = new Set(state.settings.perPkgs || []);
    perQ = ''; $('#appQ').value = '';
    renderApps(); renderPerState();
    $('#screen-perapp').scrollTop = 0;
  }
  $('#rowPerApp').addEventListener('click', () => go('perapp'));
  $('#perBack').addEventListener('click', () => go('settings'));
  window.__back = () => { if (screen === 'perapp') { go('settings'); return true; } return false; };
  $('#perModes').addEventListener('click', e => { const b = e.target.closest('.mode'); if (!b) return; draftMode = b.dataset.m; renderPerState(); });
  $('#appList').addEventListener('click', e => {
    const b = e.target.closest('.app'); if (!b || draftMode === 'off') return;
    const p = b.dataset.p;
    if (draftSet.has(p)) draftSet.delete(p); else draftSet.add(p);
    b.setAttribute('aria-checked', draftSet.has(p)); renderPerState();
  });
  $('#appQ').addEventListener('input', e => { perQ = e.target.value; renderApps(); });
  $('#perSave').addEventListener('click', () => {
    if (draftMode === 'only' && !draftSet.size) { toast(t('per_pick')); return; }
    state.settings.perMode = draftMode; state.settings.perPkgs = [...draftSet];
    save(); pushPerApp(); renderPerSub();
    toast(state.status !== 'off' ? t('per_reconnect') : t('per_saved'));
    go('settings');
  });
  pushPerApp();

  /* ---------- DNS + Myanmar direct ---------- */
  const DNS = { cloudflare: ['1.1.1.1', '1.0.0.1'], google: ['8.8.8.8', '8.8.4.4'], quad9: ['9.9.9.9', '149.112.112.112'], adguard: ['94.140.14.14', '94.140.15.15'] };
  const MM_DOMAINS = ['domain:mm'];
  function dnsList() { return DNS[state.settings.dns] || DNS.cloudflare; }
  function pushDns() { if (native && OakNative.setDns) OakNative.setDns(dnsList().join(',')); }
  function renderDns() { $$('#segDns button').forEach(b => b.classList.toggle('on', b.dataset.v === (state.settings.dns || 'cloudflare'))); }
  $('#segDns').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.settings.dns = b.dataset.v; save(); renderDns(); pushDns();
    if (state.status !== 'off') toast(t('per_reconnect'));
  });
  $('[data-set=bypassMm]').addEventListener('click', () => { if (state.status !== 'off') toast(t('per_reconnect')); });
  renderDns(); pushDns();

  /* ---------- per-server usage ---------- */
  const SKEY = 'oakk.usageSrv';
  let srvUsage = {}; try { srvUsage = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch {}
  let srvSave = 0;
  function addSrvUsage(id, bytes) {
    if (!id || !bytes) return;
    srvUsage[id] = (srvUsage[id] || 0) + bytes;
    if (Date.now() - srvSave > 5000) { srvSave = Date.now(); localStorage.setItem(SKEY, JSON.stringify(srvUsage)); renderSrvUsage(); }
  }
  function renderSrvUsage() {
    const box = $('#usSrv');
    const rows = state.servers.map(s => ({ s, b: srvUsage[s.id] || 0 })).filter(r => r.b > 0).sort((a, b) => b.b - a.b).slice(0, 4);
    box.hidden = !rows.length;
    const max = rows.length ? rows[0].b : 1;
    box.innerHTML = rows.length ? `<small class="eyebrow">${esc(t('usage_srv'))}</small>` + rows.map(r => `<div class="us-srv-row"><span>${esc(r.s.name)}</span><b>${fmtB(r.b)}</b><i style="width:${Math.max(4, r.b / max * 100)}%"></i></div>`).join('') : '';
  }

  /* ---------- subscription ---------- */
  const subUrl = $('#subUrl'), subInfo = $('#subInfo');
  subUrl.value = state.settings.subUrl || '';
  const fillN = (k, n) => t(k).replace('{n}', n);
  function renderSubInfo() {
    const at = state.settings.subAt;
    subInfo.textContent = !state.settings.subUrl ? t('sub_none') : at ? t('sub_last') + ' · ' + new Date(at).toLocaleString(state.settings.lang === 'en' ? 'en' : 'my', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }
  const fetchCb = {};
  window.__fetched = (id, ok, text) => { const f = fetchCb[id]; delete fetchCb[id]; if (f) f(ok ? text : null); };
  function fetchText(url) {
    return new Promise(res => {
      if (native && OakNative.fetchUrl) {
        const id = Math.random().toString(36).slice(2);
        fetchCb[id] = res;
        OakNative.fetchUrl(id, url);
      } else {
        fetch(url).then(r => r.ok ? r.text() : null).then(res, () => res(null));
      }
    });
  }
  function keysFromText(text) {
    let body = (text || '').trim();
    if (!body) return [];
    if (!/:\/\//.test(body)) { const d = b64(body.replace(/\s+/g, '')); if (d) body = d; }
    return body.split(/\s+/).map(x => x.trim()).filter(isKey);
  }
  function mergeKeys(keys, asSub) {
    const keep = new Set(keys); let added = 0;
    if (asSub) state.servers = state.servers.filter(s => !s.sub || keep.has(s.raw));
    keys.forEach(k => {
      if (state.servers.some(x => x.raw === k)) return;
      const s = parseKey(k); if (!s) return;
      if (asSub) s.sub = true;
      state.servers.push(s); added++;
    });
    if (!state.servers.some(s => s.id === state.selected)) state.selected = state.servers[0] ? state.servers[0].id : null;
    save(); renderServers(); renderHome(); renderBadge();
    return added;
  }
  let subBusy = false;
  async function updateSub(silent) {
    const url = (subUrl.value || '').trim();
    if (!/^https?:\/\//i.test(url)) { if (!silent) toast(t('sub_bad')); return; }
    if (subBusy) return;
    subBusy = true; subInfo.textContent = t('sub_busy');
    const text = await fetchText(url);
    subBusy = false;
    const keys = keysFromText(text);
    if (!keys.length) { renderSubInfo(); if (!silent) toast(t('sub_fail')); return; }
    state.settings.subUrl = url; state.settings.subAt = Date.now();
    const was = state.selected;
    mergeKeys(keys, true);
    if (state.status !== 'off' && was !== state.selected) disconnect();
    save(); renderSubInfo();
    if (!silent) toast(fillN('sub_ok', keys.length));
  }
  $('#btnSubUpdate').addEventListener('click', () => updateSub(false));
  $('#btnSubClear').addEventListener('click', () => {
    const was = state.selected;
    state.settings.subUrl = ''; state.settings.subAt = 0; subUrl.value = '';
    state.servers = state.servers.filter(s => !s.sub);
    if (!state.servers.some(s => s.id === state.selected)) state.selected = state.servers[0] ? state.servers[0].id : null;
    if (state.status !== 'off' && was !== state.selected) disconnect();
    save(); renderServers(); renderHome(); renderBadge(); renderSubInfo();
  });
  renderSubInfo();
  if (state.settings.subUrl && native) setTimeout(() => updateSub(true), 1500);

  /* ---------- backup ---------- */
  $('#btnExport').addEventListener('click', () => {
    if (!state.servers.length) { toast(t('backup_empty')); return; }
    const text = state.servers.map(s => s.raw).join('\n');
    if (window.OakNative && OakNative.writeClipboard) OakNative.writeClipboard(text);
    else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    toast(fillN('backup_done', state.servers.length));
  });
  $('#btnImport').addEventListener('click', async () => {
    const keys = keysFromText(await readClip());
    if (!keys.length) { toast(t('import_none')); return; }
    toast(fillN('import_done', mergeKeys(keys, false)));
  });

  /* ---------- connected from notification / tile ---------- */
  const syncNative = () => {
    if (!native || document.hidden) return;
    if (OakNative.vpnState() === 'on' && state.status === 'off' && sel()) goOn();
  };
  document.addEventListener('visibilitychange', syncNative);
  syncNative();

  ['splitRow', 'installRow'].forEach(id => { const e = $('#' + id); if (e) e.hidden = true; });
  { const sp = $('[data-set=split]'); if (sp) sp.closest('.setrow').hidden = true; }
  $('[data-set=kill]').closest('.setrow').hidden = true;

  applyLang(); applyTheme(); renderUsage(); checkClip();

  renderServers(); renderHome(); go('home');
  if (state.settings.auto && sel()) setTimeout(connect, 600);
})();
