/* Gotta Catch 'em All — Pokédex delle carte. Vanilla JS, nessun build step. */
(() => {
  'use strict';

  // PMDCollab portraits packed in one 40x30 atlas (40px cells)
  const ATLAS = { cols: 40, rows: 30 };
  const spritePos = e => `--sx:${(e.si % ATLAS.cols) / (ATLAS.cols - 1) * 100}%;--sy:${Math.floor(e.si / ATLAS.cols) / (ATLAS.rows - 1) * 100}%`;
  const sprite = e => `<i class="sp" style="${spritePos(e)}"></i>`;
  const PTCG = 'https://api.pokemontcg.io/v2/cards';
  const TCGDEX = 'https://api.tcgdex.net/v2';
  const LS = { col: 'pdx.collection.v3', gh: 'pdx.github.v1', ui: 'pdx.ui.v3', price: 'pdx.prices.v2' };
  const GROUPS = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => ({ id: 'g' + g, tab: 'Gen ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][g - 1],
      title: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unima', 'Kalos', 'Alola', 'Galar', 'Paldea'][g - 1], cols: 4,
      // version colours of each generation's pair of games, used for the waves and the cover
      theme: [['#e3350d', '#3b6fd8', '#f2b807'], ['#d4a017', '#9aa7b8', '#4bb3c7'], ['#c8102e', '#1f5fbf', '#2fae63'], ['#5b8fd9', '#d98bb3', '#a77bd1'],
        ['#2b2b2b', '#e9e9e9', '#3fb6a8'], ['#1f76d2', '#e0283a', '#2fae63'], ['#f28a1a', '#7a4fd6', '#1fb5a6'], ['#14a3d9', '#d6267a', '#f2b807'], ['#e3350d', '#7b3fd1', '#f29e0d']][g - 1] })),
    { id: 'mega', tab: 'Mega', title: 'Megaevoluzioni', cols: 3, theme: ['#7b3fd1', '#e0479e', '#38c6d9'] },
    { id: 'regional', tab: 'Regionali', title: 'Forme regionali', cols: 3, theme: ['#2fae63', '#1f76d2', '#f2b807'] },
    { id: 'target', tab: 'Target', title: 'Carte target', cols: 0, theme: ['#f2b807', '#e3350d', '#1f5fbf'] },
  ];
  const DESIRE = { Strong: { l: 'Tanto', o: 0 }, Medium: { l: 'Medio', o: 1 }, Weak: { l: 'Poco', o: 2 } };
  const TYPE_COLORS = { Normal: '#9a9a6e', Fire: '#e5662c', Water: '#4a7fe0', Electric: '#e6b412', Grass: '#4fa83d', Ice: '#5bbdbd',
    Fighting: '#b8322a', Poison: '#9640a0', Ground: '#c9a14a', Flying: '#8a74d8', Psychic: '#e9466f', Bug: '#8fa31a',
    Rock: '#a8902f', Ghost: '#62508c', Dragon: '#5c34e8', Dark: '#5a4638', Steel: '#8e8eaa', Fairy: '#d9709a' };
  const TYPE_IT = { Normal: 'Normale', Fire: 'Fuoco', Water: 'Acqua', Electric: 'Elettro', Grass: 'Erba', Ice: 'Ghiaccio',
    Fighting: 'Lotta', Poison: 'Veleno', Ground: 'Terra', Flying: 'Volante', Psychic: 'Psico', Bug: 'Coleottero', Rock: 'Roccia',
    Ghost: 'Spettro', Dragon: 'Drago', Dark: 'Buio', Steel: 'Acciaio', Fairy: 'Folletto' };
  const STAT_LABELS = ['PS', 'Attacco', 'Difesa', 'Att. Sp.', 'Dif. Sp.', 'Velocità'];
  const ART_RC = new Set(['AR', 'SAR', 'CHR', 'CSR', 'MA']);
  const RC_LABEL = { Common: 'Comune', Uncommon: 'Non comune', Rare: 'Rara', RR: 'Doppia rara', RRR: 'Tripla rara', AR: 'Art rare', SAR: 'Special art rare',
    SR: 'Super rara', UR: 'Secret / Hyper rare', MUR: 'Mega hyper rare', MA: 'Mega attack rare', CHR: 'Character rare', CSR: 'Character super rare',
    S: 'Shiny', SSR: 'Shiny super rare', ACE: 'ACE SPEC', K: 'Radiante', PR: 'Promo', CC: 'Classic collection', AMZ: 'Amazing rare', SEC: 'Secret (numero oltre il totale del set)' };
  const RFILTERS = [
    ['all', 'Tutte le rarità', () => true],
    ['art', 'Art (AR, SAR, CHR…)', r => ART_RC.has(r)],
    ['secret', 'Secret / SR / UR', r => ['SR', 'UR', 'MUR', 'SSR', 'MA', 'SEC'].includes(r)],
    ['holo', 'RR / RRR / Rare', r => ['RR', 'RRR', 'Rare', 'K', 'ACE', 'AMZ'].includes(r)],
    ['base', 'Comuni e non comuni', r => ['Common', 'Uncommon'].includes(r)],
  ];
  const LANGS = { int: ['ITA', 'ENG', 'FRA', 'DEU', 'ESP', 'POR'], jp: ['JPN', 'KOR', 'CHN'] };

  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const eur = n => (n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  const dexStr = n => '#' + String(n).padStart(4, '0');
  const uid = () => Math.random().toString(36).slice(2, 10);

  let ENTRIES = [], BY_ID = new Map(), SETS = [], META = {};
  let remote = null, col = { version: 2, updated: null, cards: {} }, dirty = false;
  const ui = Object.assign({ group: 'g1', filter: 'all', view: 'grid', face: 'card', tap: 'col', q: '', src: 'all', rf: 'all', langInt: 'ITA', langJp: 'JPN' }, store.get(LS.ui, {}));
  const priceCache = store.get(LS.price, {});   // cid -> {p, t}
  let current = null, selUid = null, photoMode = false;

  /* ---------------- collection model ---------------- */
  // col.cards[entryId] = { cover: <uid>, list: [ {uid, cid?, src?, set, sid?, number, rarity, rc, lang, variant, year, img, price, value, art} ] }
  function migrate(c) {
    const out = { version: 2, updated: c.updated || null, pricesUpdated: c.pricesUpdated, cards: {}, targets: (c.targets || []).map(t => Object.assign({ uid: uid() }, t)) };
    for (const [k, v] of Object.entries(c.cards || {})) {
      if (v && Array.isArray(v.list)) {
        v.list.forEach(x => { x.uid = x.uid || uid(); });
        if (typeof v.cover === 'number') v.cover = v.list[v.cover]?.uid;
        if (v.cover !== 'sprite' && !v.list.some(x => x.uid === v.cover)) v.cover = v.list[0]?.uid;
        if (v.list.length) out.cards[k] = v;
      } else if (v) {
        const x = Object.assign({ uid: uid(), rc: v.rarity }, v);
        out.cards[k] = { cover: x.uid, list: [x] };
      }
    }
    return out;
  }
  const ts = v => v ? new Date(v).getTime() || 0 : 0;
  // copy newer prices (e.g. from the automatic update on GitHub) into a collection without touching anything else
  function mergePrices(dst, src) {
    for (const [k, e] of Object.entries(src.cards || {})) {
      const d = dst.cards?.[k]; if (!d) continue;
      for (const x of e.list || []) {
        const y = d.list.find(z => z.uid === x.uid);
        if (y && x.price != null && ts(x.priceAt) > ts(y.priceAt)) { y.price = x.price; y.priceAt = x.priceAt; if (x.tdx) y.tdx = x.tdx; }
      }
    }
    if (ts(src.pricesUpdated) > ts(dst.pricesUpdated)) dst.pricesUpdated = src.pricesUpdated;
    return dst;
  }
  const mine = id => col.cards[id]?.list || [];
  const isOwned = id => mine(id).length > 0;
  const cover = id => { const e = col.cards[id]; return e && (e.list.find(x => x.uid === e.cover) || e.list[0]); };
  const spriteFace = id => ui.face !== 'card' || col.cards[id]?.cover === 'sprite';
  const targets = () => col.targets || (col.targets = []);
  const isTaken = t => !!t.taken || (t.eid && mine(t.eid).some(x => (t.cid && x.cid === t.cid) ||
    (x.set && t.set && x.number && t.number && x.set.toLowerCase() === t.set.toLowerCase() && x.number.split('/')[0].replace(/^0+/, '') === t.number.split('/')[0].replace(/^0+/, ''))));
  const cardValue = x => +(x.value ?? x.price ?? 0) || 0;
  const isArt = x => x.art ?? ART_RC.has(x.rc);

  /* ---------------- load ---------------- */
  async function load() {
    fetch('data/meta.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(m => { META = m; }).catch(() => {});
    const [p, c, s] = await Promise.all([
      fetch('data/pokedex.json').then(r => r.json()),
      fetch('data/collection.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('data/sets.json').then(r => r.json()).catch(() => []),
    ]);
    ENTRIES = p; ENTRIES.forEach(e => BY_ID.set(e.id, e)); SETS = s;
    remote = migrate(c || {});
    const local = store.get(LS.col, null) || store.get('pdx.collection.v2', null);
    if (local && local.dirty && (!remote.updated || local.updated >= remote.updated)) { col = mergePrices(migrate(local.data), remote); if (!col.targets?.length && remote.targets?.length) col.targets = structuredClone(remote.targets); dirty = true; }
    else { col = structuredClone(remote); dirty = false; store.del(LS.col); }
    $('#setList').innerHTML = SETS.map(x => `<option value="${esc(x.name)}">${esc(x.year)}</option>`).join('');
    initGithubFields();
    renderAll();
  }
  function persist() {
    col.updated = new Date().toISOString(); dirty = true;
    store.set(LS.col, { dirty: true, updated: col.updated, data: col });
    renderSync();
  }

  /* ---------------- header ---------------- */
  function renderTotals() {
    const main = ENTRIES.filter(e => e.group.startsWith('g'));
    const all = ENTRIES.flatMap(e => mine(e.id));
    $('#totals').innerHTML = `
      <div><dt>Pokédex</dt><dd>${main.filter(e => isOwned(e.id)).length}<small>/ ${main.length}</small></dd></div>
      <div><dt>Carte</dt><dd>${all.length}</dd></div>
      <div><dt>Art rare</dt><dd>${all.filter(isArt).length}</dd></div>
      <div><dt>Valore</dt><dd>${eur(all.reduce((s, x) => s + cardValue(x), 0))}</dd></div>`;
  }
  function renderTabs() {
    $('#tabs').innerHTML = GROUPS.map(g => {
      if (g.id === 'target') {
        const t = targets(), n = t.filter(isTaken).length, pct = t.length ? Math.round(n / t.length * 100) : 0;
        return `<button class="tab tab-target" role="tab" data-group="target" aria-selected="${ui.group === 'target'}">
          <b>Target</b><span>${n}/${t.length} presi</span><i class="meter"><i style="width:${pct}%"></i></i></button>`;
      }
      const list = ENTRIES.filter(e => e.group === g.id), n = list.filter(e => isOwned(e.id)).length;
      const pct = list.length ? Math.round(n / list.length * 100) : 0;
      return `<button class="tab" role="tab" data-group="${g.id}" aria-selected="${ui.group === g.id}">
        <b>${g.tab}</b><span>${n}/${list.length} · ${pct}%</span><i class="meter"><i style="width:${pct}%"></i></i></button>`;
    }).join('');
  }
  function renderSync() {
    $('#dirtyDot').hidden = !dirty;
    const t = col.updated ? new Date(col.updated).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    $('#syncState').textContent = dirty ? 'Modifiche salvate nel browser, non ancora su GitHub' : `Aggiornato ${t}`;
  }

  /* ---------------- grid / binder ---------------- */
  function matches(e) {
    const l = mine(e.id);
    if (ui.filter === 'owned' && !l.length) return false;
    if (ui.filter === 'missing' && l.length) return false;
    if (ui.filter === 'art' && !l.some(isArt)) return false;
    if (ui.q) {
      const q = ui.q.toLowerCase().replace(/^#0*/, '');
      if (!(e.name.toLowerCase().includes(q) || String(e.dex) === q)) return false;
    }
    return true;
  }
  const typeVars = e => { const a = TYPE_COLORS[e.types[0]] || '#888', b = TYPE_COLORS[e.types[1]] || a; return `--t1:${a};--t2:${b}`; };
  const badImg = new Set();

  function pocket(e) {
    const c = cover(e.id), n = mine(e.id).length;
    const label = e.group === 'regional' ? `${e.name} di ${e.region}` : e.name;
    const no = e.group.startsWith('g') ? dexStr(e.dex) : (e.region || dexStr(e.dex));
    if (!c) {
      return `<button class="pocket missing${ui.face === 'bw' ? ' bw' : ''}" data-id="${e.id}" aria-label="${esc(label)}, mancante">
        <span class="no">${esc(no)}</span><span class="spr">${sprite(e)}</span><span class="nm">${esc(e.name)}</span></button>`;
    }
    const meta = [c.rc, c.lang, c.set].filter(Boolean).join(' · ');
    const img = !spriteFace(e.id) && c.img && !badImg.has(c.img) ? `<img class="card" loading="lazy" decoding="async" alt="" src="${esc(c.img)}">` : '';
    const art = mine(e.id).some(isArt) ? '<span class="badge-art" title="Art rare">A</span>' : '';
    const count = n > 1 ? `<span class="badge-n" title="${n} carte">${n}</span>` : '';
    return `<button class="pocket owned${img ? ' has-img' : ''}${ui.face === 'bw' ? ' bw' : ''}" style="${typeVars(e)}" data-id="${e.id}" aria-label="${esc(label)}, ${n} ${n > 1 ? 'carte' : 'carta'}">
      <span class="no">${esc(no)}</span><span class="spr">${sprite(e)}</span>
      <span class="meta">${esc(meta)}</span><span class="nm">${esc(e.name)}</span>${img}${art}${count}</button>`;
  }

  function renderContent() {
    const g = GROUPS.find(x => x.id === ui.group) || GROUPS[0];
    applyTheme(g);
    document.body.classList.toggle('on-target', g.id === 'target');
    if (g.id === 'target') { renderTargets(); return; }
    const all = ENTRIES.filter(e => e.group === g.id), list = all.filter(matches);
    const n = all.filter(e => isOwned(e.id)).length;
    const range = g.id.startsWith('g') ? `${dexStr(all[0].dex)}–${dexStr(all[all.length - 1].dex)}` : `${all.length} forme`;
    $('#sectionHead').innerHTML = `<h2>${g.title}</h2><p>${range} · ${n} di ${all.length} nel raccoglitore</p>`;
    if (!list.length) {
      $('#content').innerHTML = `<p class="empty">${ui.q ? `Nessun Pokémon trovato per “${esc(ui.q)}” in questa sezione.` : 'Niente da mostrare con questo filtro.'}</p>`;
      return;
    }
    if (ui.view === 'grid' || ui.q) { $('#content').innerHTML = `<div class="grid">${list.map(pocket).join('')}</div>`; return; }
    const per = g.cols * g.cols, pages = new Map();
    for (const e of list) { if (!pages.has(e.page)) pages.set(e.page, new Array(per).fill(null)); pages.get(e.page)[e.pos - 1] = e; }
    const sorted = [...pages.entries()].sort((a, b) => a[0] - b[0]);
    $('#content').innerHTML = `<div class="album-nav" id="albumNav"><button type="button" class="btn quiet small" data-turn="-1" aria-label="Pagina precedente">‹</button><span id="albumPos"></span><button type="button" class="btn quiet small" data-turn="1" aria-label="Pagina successiva">›</button></div><div class="pages" id="pages">${sorted.map(([p, slots]) => {
      const inPage = all.filter(e => e.page === p), own = inPage.filter(e => isOwned(e.id)).length;
      return `<section class="page" aria-label="Pagina ${p}"><div class="page-label"><b>Pagina ${p}</b><span>${own}/${inPage.length}</span></div>
        <div class="pockets c${g.cols}">${slots.map(e => e ? pocket(e) : '<div class="pocket void" aria-hidden="true"></div>').join('')}</div></section>`;
    }).join('')}</div>`;
    initAlbum();
  }

  /* ---------------- album: swipe pages like a real binder (phones) ---------------- */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function initAlbum() {
    const box = $('#pages'); if (!box) return;
    const pages = [...box.children];
    const paint = () => {
      const w = box.clientWidth || 1, x = box.scrollLeft;
      const idx = Math.round(x / w);
      $('#albumPos').textContent = `Pagina ${pages[idx]?.getAttribute('aria-label').replace('Pagina ', '') || ''} · ${idx + 1} di ${pages.length}`;
      if (reduceMotion || !matchMedia('(max-width: 820px)').matches) { pages.forEach(p => p.style.transform = ''); return; }
      pages.forEach((p, i) => {
        const d = Math.max(-1, Math.min(1, (i * w - x) / w));   // -1 left .. 0 centre .. 1 right
        p.style.transformOrigin = d < 0 ? 'right center' : 'left center';
        p.style.transform = `perspective(1400px) rotateY(${d * -38}deg) scale(${1 - Math.abs(d) * .06})`;
        p.style.filter = `brightness(${1 - Math.abs(d) * .25})`;
      });
    };
    box.addEventListener('scroll', () => requestAnimationFrame(paint), { passive: true });
    window.addEventListener('resize', paint);
    $('#albumNav').addEventListener('click', ev => { const b = ev.target.closest('[data-turn]'); if (b) box.scrollBy({ left: +b.dataset.turn * box.clientWidth, behavior: 'smooth' }); });
    paint();
  }

  /* ---------------- theme: version-coloured waves ---------------- */
  function applyTheme(g) {
    const [a, b, c] = g.theme || GROUPS[0].theme, r = document.documentElement.style;
    r.setProperty('--w1', a); r.setProperty('--w2', b); r.setProperty('--w3', c);
  }

  /* ---------------- targets ---------------- */
  let tFilter = 'todo';
  function renderTargets() {
    const all = targets(), q = (ui.q || '').toLowerCase();
    const taken = all.filter(isTaken).length;
    $('#sectionHead').innerHTML = `<h2>Carte target</h2><p>${taken} prese su ${all.length} · aggiungine dal catalogo di un Pokémon scegliendo “Target”</p>
      <div class="seg small" role="radiogroup" aria-label="Mostra" id="tSeg">${[['todo', 'Da prendere'], ['done', 'Prese'], ['all', 'Tutte']].map(([k, l]) => `<button role="radio" data-t="${k}" aria-checked="${tFilter === k}">${l}</button>`).join('')}</div>`;
    let list = all.filter(t => (tFilter === 'all' || (tFilter === 'done') === isTaken(t)) && (!q || `${t.name} ${t.set}`.toLowerCase().includes(q)));
    list.sort((a, b) => (DESIRE[a.desire]?.o ?? 3) - (DESIRE[b.desire]?.o ?? 3) || (a.year || '').localeCompare(b.year || '') || a.name.localeCompare(b.name));
    if (!list.length) { $('#content').innerHTML = `<p class="empty">${tFilter === 'done' ? 'Nessun target preso, per ora.' : 'Nessun target da prendere. Aggiungine uno dal catalogo di un Pokémon.'}</p>`; return; }
    $('#content').innerHTML = `<ul class="tlist">${list.map(t => {
      const e = BY_ID.get(t.eid), done = isTaken(t), p = t.cid ? priceCache[t.cid] : null;
      const where = e ? `Pagina ${e.page} · tasca ${e.pos}${e.group === 'mega' ? ' (Mega)' : e.group === 'regional' ? ' (Regionali)' : ''}` : '';
      return `<li class="trow${done ? ' done' : ''}" data-uid="${t.uid}">
        <button type="button" class="t-img" data-act="open" aria-label="Apri ${esc(t.name)}">${t.img && !badImg.has(t.img) ? `<img loading="lazy" alt="" src="${esc(t.img)}" data-ph="${esc(t.set || t.name)}">` : spritePh(t.set || t.name, e)}</button>
        <div class="t-main">
          <b>${esc(t.name)}</b>
          <span>${esc(t.set || '—')}${t.number ? ' · ' + esc(t.number) : ''}${t.year ? ' · ' + esc(t.year) : ''}</span>
          <span class="t-tags">${rcBadge(t.rc)}${t.lang ? `<span class="lang">${esc(t.lang)}</span>` : ''}${t.desire ? `<span class="desire d-${esc(t.desire)}">${DESIRE[t.desire]?.l || esc(t.desire)}</span>` : ''}${where ? `<span class="where-t">${where}</span>` : ''}</span>
        </div>
        <div class="t-side">
          <span class="price" data-price="${esc(t.cid || '')}">${p ? (p.p != null ? eur(p.p) : '—') : (t.cid ? '' : '—')}</span>
          <span class="t-state">${done ? '✓ Presa' : 'Da prendere'}</span>
          <button type="button" class="btn quiet small" data-act="del" aria-label="Togli dai target">Togli</button>
        </div></li>`;
    }).join('')}</ul>`;
    loadPrices(list.filter(t => t.cid && !isTaken(t)).map(t => { const [src, ...r] = t.cid.split(':'); return { src, id: r.join(':'), tdx: t.tdx }; }));
  }
  function addTarget(c) {
    const cid = c.src + ':' + c.id;
    if (targets().some(t => t.cid === cid)) { toast('È già tra i target'); return; }
    targets().push({ uid: uid(), name: current.name, eid: current.id, cid, src: c.src, tdx: c.tdx, img: c.img || null,
      set: c.set, number: c.no + (c.tot ? '/' + c.tot : ''), rc: c.rc, year: (c.date || '').slice(0, 4), lang: c.src === 'jp' ? ui.langJp : ui.langInt, desire: 'Medium' });
    persist(); renderCatalog(); refreshAfterEdit();
    toast(`Aggiunta ai target: ${c.set} ${c.no}`);
  }
  function renderAll() { renderTotals(); renderTabs(); renderContent(); renderSync(); syncControls(); }
  function syncControls() {
    document.querySelectorAll('#filterSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.filter === ui.filter));
    document.querySelectorAll('#viewSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.view === ui.view));
    document.querySelectorAll('#faceSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.face === ui.face));
    const { q, ...keep } = ui; store.set(LS.ui, keep);
  }
  let refreshT;
  function refreshAfterEdit() { clearTimeout(refreshT); refreshT = setTimeout(() => { renderTotals(); renderTabs(); renderContent(); }, 120); }

  document.addEventListener('error', ev => {
    const img = ev.target;
    if (img.tagName !== 'IMG') return;
    const src = img.getAttribute('src');
    if (img.classList.contains('card')) { badImg.add(src); img.closest('.pocket')?.classList.remove('has-img'); img.remove(); }
    else if (img.dataset.ph != null) { badImg.add(src); const t = document.createElement('template'); t.innerHTML = spritePh(img.dataset.ph || 'Foto non disponibile'); img.replaceWith(t.content.firstChild); }
  }, true);

  /* ---------------- detail ---------------- */
  const dlg = $('#detail'), form = $('#cardForm');

  function openDetail(id) {
    current = BY_ID.get(id); if (!current) return;
    if (photoMode) setPhotoMode(false);
    selUid = cover(id)?.uid || null;
    fillPoke(); renderMine(); fillForm();
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('.mine').scrollTop = 0;
    loadCatalog();
  }
  function fillPoke() {
    const e = current;
    $('#dSprite').setAttribute('style', spritePos(e));
    $('#dSprite').closest('.poke-art').classList.toggle('ghost', !isOwned(e.id));
    $('#dNo').textContent = dexStr(e.dex) + (e.region ? ` · forma di ${e.region}` : e.group === 'mega' ? ' · megaevoluzione' : '');
    $('#dName').textContent = e.name;
    $('#dTypes').innerHTML = e.types.map(t => `<span class="type" style="--c:${TYPE_COLORS[t] || '#888'}">${TYPE_IT[t] || t}</span>`).join('');
    $('#dWhere').textContent = `Raccoglitore: pagina ${e.page}, tasca ${e.pos}`;
  }

  const spritePh = (ph, e = current) => `<div class="img-ph sprite-ph" style="${e ? typeVars(e) : ''}">${e ? `<span class="spr">${sprite(e)}</span>` : ''}<span class="ph-t">${esc(ph)}</span></div>`;
  const thumb = (src, ph, cls = '') => src && !badImg.has(src) ? `<img class="${cls}" loading="lazy" alt="" src="${esc(src)}" data-ph="${esc(ph)}">` : spritePh(ph);
  const rcBadge = rc => rc ? `<span class="rc rc-${esc(rc)}${ART_RC.has(rc) ? ' art' : ''}" title="${esc(RC_LABEL[rc] || rc)}">${esc(rc)}</span>` : '';

  function renderMine() {
    const l = mine(current.id), spr = col.cards[current.id]?.cover === 'sprite', cv = spr ? null : cover(current.id);
    $('#mineCount').textContent = l.length ? `${l.length} ${l.length > 1 ? 'carte' : 'carta'} · ${eur(l.reduce((s, x) => s + cardValue(x), 0))}` : '';
    const sprTile = l.length ? `
      <div class="own sprite-opt" data-uid="sprite">
        <button type="button" class="own-pick" data-act="cover" aria-label="Mostra lo sprite nel Pokédex">${spritePh('Sprite')}</button>
        <button type="button" class="star${spr ? ' on' : ''}" data-act="cover" aria-pressed="${spr}" title="${spr ? 'Nel Pokédex vedi lo sprite' : 'Mostra lo sprite nel Pokédex'}">★</button>
        <span class="own-meta">Sprite<br>al posto della carta</span>
      </div>` : '';
    $('#mineList').innerHTML = l.length ? sprTile + l.map(x => `
      <div class="own${x.uid === selUid ? ' sel' : ''}" data-uid="${x.uid}">
        <button type="button" class="own-pick" data-act="select" aria-label="Modifica ${esc(x.set || 'carta')}">${thumb(x.img, x.set || 'Carta')}</button>
        <button type="button" class="star${x.uid === cv?.uid ? ' on' : ''}" data-act="cover" aria-pressed="${x.uid === cv?.uid}" title="${x.uid === cv?.uid ? 'Anteprima nel raccoglitore' : 'Usa come anteprima'}">★</button>
        <span class="own-meta">${rcBadge(x.rc)} ${esc(x.lang || '')}<br>${esc(x.set || '—')} ${esc(x.number || '')}</span>
      </div>`).join('') : `<p class="none">Nessuna carta registrata. Scegline una dal catalogo qui sotto: foto, rarità e valore si compilano da soli.</p>`;
    $('#editWrap').hidden = !l.length || !selUid;
  }

  function fillForm() {
    const x = mine(current.id).find(c => c.uid === selUid);
    $('#editWrap').hidden = !x;
    if (!x) return;
    $('#editTitle').textContent = [x.set, x.number].filter(Boolean).join(' · ') || 'Carta aggiunta a mano';
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') el.checked = !!isArt(x);
      else if (el.name === 'value') { el.value = x.value ?? ''; el.placeholder = x.price != null ? `Cardmarket ${eur(x.price)}` : 'es. 4,50'; }
      else el.value = x[el.name] ?? '';
    }
    const ls = form.elements.lang;
    $('#priceNote').textContent = x.price != null ? `Prezzo Cardmarket (trend): ${eur(x.price)}${x.priceAt ? ' · ' + new Date(x.priceAt).toLocaleDateString('it-IT') : ''}. Lascia vuoto “Valore” per usarlo.` : x.cid ? 'Prezzo Cardmarket non disponibile per questa carta.' : '';
    ls.value = x.lang || '';
    $('#photoReset').hidden = !x.imgFrom;
    $('#photoFrom').textContent = x.imgFrom ? 'Scegli un\'altra foto' : 'Usa la foto di un\'altra carta';
  }

  function readForm() {
    const x = mine(current.id).find(c => c.uid === selUid); if (!x) return;
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') x.art = el.checked;
      else if (el.name === 'value') { const v = parseFloat(el.value.replace(',', '.')); if (isNaN(v)) delete x.value; else x.value = v; }
      else if (el.value.trim()) x[el.name] = el.value.trim(); else delete x[el.name];
    }
    if (form.elements.rc.value) x.rc = form.elements.rc.value;
    if (x.set && !x.year) { const s = SETS.find(z => z.name === x.set); if (s) x.year = String(s.year); }
    persist(); renderMine(); refreshAfterEdit();
  }

  function addCard(x) {
    const entry = col.cards[current.id] || (col.cards[current.id] = { cover: null, list: [] });
    entry.list.push(x);
    if (!entry.cover || entry.list.length === 1) entry.cover = x.uid;
    selUid = x.uid;
    persist(); fillPoke(); renderMine(); fillForm(); renderCatalog(); refreshAfterEdit();
    const hit = targets().find(t => t.eid === current.id && !t.taken && isTaken(t) && (t.cid === x.cid || !t.cid));
    if (hit) setTimeout(() => toast(`🎯 Target preso: ${hit.set || hit.name}`), 900);
  }
  function removeCard(u) {
    const entry = col.cards[current.id]; if (!entry) return;
    entry.list = entry.list.filter(x => x.uid !== u);
    if (!entry.list.length) delete col.cards[current.id];
    else if (entry.cover === u) entry.cover = entry.list[0].uid;
    selUid = entry.list?.length ? (entry.list.find(x => x.uid === entry.cover) || entry.list[0]).uid : null;
    persist(); fillPoke(); renderMine(); fillForm(); renderCatalog(); refreshAfterEdit();
    toast('Carta rimossa');
  }
  function setCover(u) { col.cards[current.id].cover = u; persist(); renderMine(); refreshAfterEdit(); toast(u === 'sprite' ? 'Nel Pokédex vedrai lo sprite' : 'Anteprima aggiornata'); }

  function step(dir) {
    const list = ENTRIES.filter(e => e.group === current.group && matches(e));
    const i = list.findIndex(e => e.id === current.id);
    const nx = list[(i + dir + list.length) % list.length];
    if (nx) openDetail(nx.id);
  }

  /* ---------------- catalog ---------------- */
  let catalog = [], catToken = 0, catLimit = 60;
  const catCache = new Map();
  async function fetchCatalog(dex) {
    if (!catCache.has(dex)) catCache.set(dex, fetch(`data/cards/${String(dex).padStart(4, '0')}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
    return catCache.get(dex);
  }
  function relevant(e, list) {
    const MEGA = /^(M |Mega |メガ)/, REG = /Alolan|Galarian|Hisuian|Paldean|アローラ|ガラル|ヒスイ|パルデア/;
    if (e.group === 'mega') {
      const suf = (e.name.match(/ (X|Y|Z)$/) || [])[1];
      const m = list.filter(c => MEGA.test(c.n) && (!suf || c.n.includes(suf)));
      return m.length ? m : list.filter(c => MEGA.test(c.n)).length ? list.filter(c => MEGA.test(c.n)) : list;
    }
    if (e.group === 'regional') {
      const k = { Alola: /Alolan|アローラ/, Galar: /Galarian|ガラル/, Hisui: /Hisuian|ヒスイ/, Paldea: /Paldean|パルデア/ }[e.region];
      const m = list.filter(c => k.test(c.n)); return m.length ? m : list;
    }
    const base = list.filter(c => !MEGA.test(c.n) && !REG.test(c.n));
    return base.length ? base : list;
  }
  async function loadCatalog() {
    const e = current, tk = ++catToken; catLimit = 60;
    $('#catGrid').innerHTML = ''; $('#catNote').textContent = 'Carico il catalogo…'; $('#catMore').hidden = true;
    try {
      const list = relevant(e, await fetchCatalog(e.dex));
      if (tk !== catToken) return;
      const key = c => (c.date || '9999') + '|' + c.set + '|' + String(parseInt(c.no, 10) || 0).padStart(5, '0') + c.no;
      catalog = list.slice().sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0); renderCatalog();
    } catch { if (tk === catToken) $('#catNote').textContent = 'Catalogo non disponibile. Puoi aggiungere la carta a mano.'; }
  }
  function filteredCatalog() {
    const f = $('#catFilter').value.trim().toLowerCase(), rf = (RFILTERS.find(r => r[0] === ui.rf) || RFILTERS[0])[2];
    return catalog.filter(c => (ui.src === 'all' || c.src === ui.src) && rf(c.rc) &&
      (!f || `${c.set} ${c.setJa || ''} ${c.sid} ${c.no} ${c.r} ${c.n}`.toLowerCase().includes(f)));
  }
  function renderCatalog() {
    if (!current) return;
    document.querySelectorAll('#srcSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.src === ui.src));
    $('#rarityFilter').value = ui.rf;
    const list = filteredCatalog(), ownedC = new Set(mine(current.id).map(x => x.cid).filter(Boolean)), targC = new Set(targets().map(t => t.cid));
    document.querySelectorAll('#tapSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.tap === ui.tap));
    const nInt = catalog.filter(c => c.src === 'int').length, nJp = catalog.length - nInt;
    $('#catNote').textContent = catalog.length ? `${list.length} di ${catalog.length} carte (${nInt} internazionali, ${nJp} giapponesi), dalla più vecchia alla più nuova. Tocca una carta per aggiungerla.` : 'Nessuna carta in catalogo per questo Pokémon.';
    $('#catGrid').innerHTML = list.slice(0, catLimit).map(c => {
      const cid = c.src + ':' + c.id, p = priceCache[cid];
      const tot = c.tot ? `/${c.tot}` : '';
      return `<button type="button" class="cand${ownedC.has(cid) ? ' have' : ''}" data-cid="${esc(cid)}">
        <span class="cand-img">${thumb(c.sm, `${c.set} ${c.no}`)}${c.alt ? '<i class="alt" title="Foto della versione internazionale">EN</i>' : ''}${ownedC.has(cid) ? '<i class="tick" aria-label="Già nella collezione">✓</i>' : ''}${targC.has(cid) ? '<i class="tgt" title="Tra i target">◎</i>' : ''}</span>
        <span class="cand-info"><b>${esc(c.set)}</b><span>${esc(c.no)}${tot} · ${esc((c.date || '').slice(0, 4))} · ${c.src === 'jp' ? 'JP' : 'INT'}</span>
        <span class="cand-row">${rcBadge(c.rc)}<span class="price" data-price="${esc(cid)}">${p ? (p.p != null ? eur(p.p) : '—') : ''}</span></span></span></button>`;
    }).join('');
    $('#catMore').hidden = list.length <= catLimit;
    $('#catMore').textContent = `Mostra altre ${Math.min(60, list.length - catLimit)}`;
    loadPrices(list.slice(0, catLimit));
  }
  function paintPrice(cid) {
    const el = document.querySelector(`[data-price="${CSS.escape(cid)}"]`); const p = priceCache[cid];
    if (el && p) el.textContent = p.p != null ? eur(p.p) : '—';
  }
  function savePrices() {
    if (!store.set(LS.price, priceCache)) { // trim oldest if storage is full
      Object.entries(priceCache).sort((a, b) => a[1].t - b[1].t).slice(0, 2000).forEach(([k]) => delete priceCache[k]); store.set(LS.price, priceCache);
    }
  }
  const fresh = p => p && Date.now() - p.t < 1000 * 60 * 60 * 24 * 3;

  // Cardmarket prices (EUR) from TCGdex card detail, fetched only for the cards on screen.
  // International cards without a TCGdex match fall back to pokemontcg.io.
  const cmPrice = cm => cm ? (cm.trend || cm.avg || cm.avg30 || cm['trend-holo'] || cm['avg-holo'] || null) : null;
  async function fetchPrice(c) {
    if (c.src === 'jp' || c.tdx) {
      const r = await fetch(`${TCGDEX}/${c.src === 'jp' ? 'ja' : 'en'}/cards/${encodeURIComponent(c.src === 'jp' ? c.id : c.tdx)}`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      return cmPrice(j.pricing?.cardmarket) ?? cmPrice(j.variants_detailed?.find(v => v.pricing?.cardmarket)?.pricing.cardmarket) ?? null;
    }
    const r = await fetch(`${PTCG}/${encodeURIComponent(c.id)}`);
    if (!r.ok) throw new Error(r.status);
    const pr = (await r.json()).data?.cardmarket?.prices;
    return pr ? (pr.trendPrice || pr.averageSellPrice || null) : null;
  }
  const pQueue = new Map(); let pRunning = 0, pSaveT;
  function loadPrices(list) { list.forEach(c => { const cid = c.src + ':' + c.id; if (!fresh(priceCache[cid])) pQueue.set(cid, c); }); pumpPrices(); }
  function pumpPrices() {
    while (pRunning < 6 && pQueue.size) {
      const [cid, c] = pQueue.entries().next().value; pQueue.delete(cid); pRunning++;
      fetchPrice(c).then(p => { priceCache[cid] = { p, t: Date.now() }; }, () => {}).then(() => {
        paintPrice(cid); pRunning--;
        clearTimeout(pSaveT); pSaveT = setTimeout(savePrices, 800); pumpPrices();
      });
    }
  }
  async function priceFor(c) {
    const cid = c.src + ':' + c.id;
    if (fresh(priceCache[cid])) return priceCache[cid].p;
    try { const p = await fetchPrice(c); priceCache[cid] = { p, t: Date.now() }; savePrices(); return p; } catch { return null; }
  }

  function setPhotoMode(on) {
    photoMode = on; $('#photoBanner').hidden = !on; dlg.classList.toggle('photo-mode', on);
    if (on) { ui.src = 'all'; renderCatalog(); $('#photoBanner').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  function borrowPhoto(c) {
    const x = mine(current.id).find(z => z.uid === selUid); if (!x) return;
    if (!c.img) { toast('Questa carta non ha foto: scegline un\'altra'); return; }
    if (!x.imgFrom) x.imgOwn = x.img ?? null;
    x.img = c.img; x.imgFrom = c.src + ':' + c.id;
    persist(); setPhotoMode(false); renderMine(); fillForm(); refreshAfterEdit();
    toast(`Foto presa da ${c.set} ${c.no}`);
    $('#mineList').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function pickCatalog(cid) {
    const c = catalog.find(x => x.src + ':' + x.id === cid); if (!c) return;
    if (photoMode) { borrowPhoto(c); return; }
    if (ui.tap === 'target') { addTarget(c); return; }
    const lang = c.src === 'jp' ? ui.langJp : ui.langInt;
    const x = { uid: uid(), cid, src: c.src, tdx: c.tdx, set: c.set + (c.src === 'jp' && !/\(/.test(c.set) ? ` (${c.sid})` : ''), sid: c.sid,
      number: c.no + (c.tot ? '/' + c.tot : ''), rarity: c.r, rc: c.rc, lang, year: (c.date || '').slice(0, 4), img: c.img || null,
      art: ART_RC.has(c.rc), price: priceCache[cid]?.p ?? null, priceAt: priceCache[cid] ? priceCache[cid].t : null };
    addCard(x);
    toast(`✓ Aggiunta a “Le mie carte”: ${c.set} ${c.no} · ${lang}`);
    const tile = document.querySelector(`.cand[data-cid="${CSS.escape(cid)}"]`);
    if (tile) { tile.classList.add('just'); setTimeout(() => tile.classList.remove('just'), 1200); }
    if (!fresh(priceCache[cid])) priceFor(c).then(p => { x.price = p; x.priceAt = Date.now(); persist(); if (current && selUid === x.uid) fillForm(); renderMine(); refreshAfterEdit(); paintPrice(cid); });
  }
  function addManual() {
    addCard({ uid: uid(), lang: ui.langInt, art: false });
    form.elements.set.focus();
  }

  /* ---------------- refresh all prices ---------------- */
  function renderDataDates() {
    const d = v => v ? new Date(v).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'mai';
    $('#dataDates').textContent = `Catalogo aggiornato: ${d(META.catalogUpdated)} · Prezzi aggiornati: ${d(col.pricesUpdated)}`;
  }
  async function dispatchUpdate() {
    const c = saveGhFields();
    if (!c.token || !c.owner || !c.repo) return 'Catalogo: per aggiornarlo subito serve il token GitHub (con permesso Actions). Altrimenti si aggiorna da solo il 1° e il 15 del mese.';
    try {
      const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/actions/workflows/update.yml/dispatches`, {
        method: 'POST', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: c.branch || 'main' }) });
      if (r.status === 204) return 'Catalogo: aggiornamento avviato su GitHub, pronto tra circa 5 minuti (ricarica la pagina).';
      if (r.status === 403 || r.status === 404) return 'Catalogo: il token non può avviare l’aggiornamento. Aggiungi il permesso “Actions: Read and write” al token.';
      return `Catalogo: GitHub ha risposto ${r.status}.`;
    } catch { return 'Catalogo: GitHub non raggiungibile.'; }
  }
  async function refreshPrices() {
    const btn = $('#refreshPrices'), out = $('#priceStatus'); btn.disabled = true;
    const dispatched = dispatchUpdate();
    const todo = ENTRIES.flatMap(e => mine(e.id)).filter(x => x.cid);
    let done = 0, i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const x = todo[i++];
        const [src, ...rest] = x.cid.split(':'); const id = rest.join(':');
        delete priceCache[x.cid];
        const p = await priceFor({ src, id, tdx: x.tdx });
        if (p != null) { x.price = p; x.priceAt = Date.now(); }
        out.textContent = `Aggiorno i prezzi: ${++done} di ${todo.length}…`;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    col.pricesUpdated = new Date().toISOString();
    persist(); renderAll(); renderDataDates();
    out.textContent = `Prezzi aggiornati per ${todo.length} carte. ${await dispatched}`; btn.disabled = false;
  }

  /* ---------------- GitHub sync ---------------- */
  function ghDefaults() {
    const h = location.hostname, seg = location.pathname.split('/').filter(Boolean)[0];
    return h.endsWith('.github.io') ? { owner: h.split('.')[0], repo: seg || h, branch: 'main' } : { owner: '', repo: '', branch: 'main' };
  }
  const ghCfg = () => Object.assign(ghDefaults(), store.get(LS.gh, {}));
  function initGithubFields() { const c = ghCfg(); $('#ghOwner').value = c.owner || ''; $('#ghRepo').value = c.repo || ''; $('#ghBranch').value = c.branch || 'main'; $('#ghToken').value = c.token || ''; }
  function saveGhFields() {
    const c = { owner: $('#ghOwner').value.trim(), repo: $('#ghRepo').value.trim(), branch: $('#ghBranch').value.trim() || 'main', token: $('#ghToken').value.trim() };
    store.set(LS.gh, c); return c;
  }
  const b64 = str => { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
  async function gh(path, opts = {}) {
    const c = saveGhFields();
    if (!c.owner || !c.repo) throw new Error('Indica utente e repository.');
    const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}${opts.method ? '' : `?ref=${encodeURIComponent(c.branch)}`}`, {
      ...opts, cache: 'no-store', headers: { Accept: 'application/vnd.github+json', ...(c.token ? { Authorization: `Bearer ${c.token}` } : {}), ...(opts.headers || {}) } });
    if (!r.ok) {
      const msg = { 401: 'Token non valido o scaduto.', 403: 'Il token non ha il permesso di scrittura su questo repository.', 404: 'Repository o file non trovato (o token senza accesso).', 409: 'Conflitto: il file è cambiato, ricarica e riprova.', 422: 'Dati rifiutati da GitHub.' }[r.status];
      throw new Error(msg || `Errore GitHub ${r.status}`);
    }
    return r.json();
  }
  async function ghSave() {
    const st = $('#ghStatus'), c = saveGhFields();
    if (!c.token) { st.textContent = 'Serve un token per salvare su GitHub.'; return; }
    $('#ghSave').disabled = true; st.textContent = 'Salvataggio in corso…';
    try {
      let sha; try { const f = await gh('data/collection.json'); sha = f.sha; try { mergePrices(col, migrate(JSON.parse(unb64(f.content)))); } catch {} } catch (e) { if (!/non trovato/.test(e.message)) throw e; }
      col.updated = new Date().toISOString();
      const n = ENTRIES.reduce((s, e) => s + mine(e.id).length, 0);
      await gh('data/collection.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Aggiorna collezione (${n} carte)`, content: b64(JSON.stringify(col, null, 1)), branch: c.branch, ...(sha ? { sha } : {}) }) });
      remote = structuredClone(col); dirty = false; store.del(LS.col); renderSync();
      st.textContent = 'Salvato su GitHub. Il sito pubblico si aggiorna entro un paio di minuti.'; toast('Salvato su GitHub');
    } catch (e) { st.textContent = e.message; }
    $('#ghSave').disabled = false;
  }
  async function ghPull() {
    const st = $('#ghStatus'); st.textContent = 'Scarico da GitHub…';
    try {
      const f = await gh('data/collection.json');
      col = migrate(JSON.parse(unb64(f.content))); remote = structuredClone(col); dirty = false; store.del(LS.col);
      renderAll(); st.textContent = 'Collezione ricaricata da GitHub.';
    } catch (e) { st.textContent = e.message; }
  }

  /* ---------------- export / import ---------------- */
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCsv() {
    const head = ['Sezione', 'Pokedex #', 'Nome', 'Regione', 'Gen', 'Pagina', 'Posizione', 'Anteprima', 'Art Flag', 'Rarità', 'Lingua', 'Variante', 'Expansion', 'Year', 'Card #', 'Valore', 'Prezzo Cardmarket', 'Immagine'];
    const q = v => { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const num = v => v != null ? String(v).replace('.', ',') : '';
    const rows = [];
    for (const e of ENTRIES) {
      const g = GROUPS.find(x => x.id === e.group), l = mine(e.id), cv = cover(e.id);
      if (!l.length) rows.push([g.tab, e.dex, e.name, e.region, e.gen, e.page, e.pos, '', '', '', '', '', '', '', '', '', '', '']);
      for (const x of l) rows.push([g.tab, e.dex, e.name, e.region, e.gen, e.page, e.pos, x.uid === cv?.uid && col.cards[e.id].cover !== 'sprite' ? 'TRUE' : 'FALSE', isArt(x) ? 'TRUE' : 'FALSE', x.rc, x.lang, x.variant, x.set, x.year, x.number, num(x.value), num(x.price), x.img]);
    }
    download('pokedex.csv', '﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast');
    // an open <dialog> sits in the top layer and would hide the toast: show it inside the dialog instead
    const host = document.querySelector('dialog[open]') || document.body;
    if (t.parentNode !== host) host.appendChild(t);
    t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
  }

  /* ---------------- events ---------------- */
  $('#tabs').addEventListener('click', ev => { const b = ev.target.closest('.tab'); if (!b) return; ui.group = b.dataset.group; renderTabs(); renderContent(); syncControls(); window.scrollTo({ top: 0 }); });
  $('#filterSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ui.filter = b.dataset.filter; syncControls(); renderContent(); });
  $('#tapSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ui.tap = b.dataset.tap; syncControls(); renderCatalog(); });
  $('#content').addEventListener('click', ev => {
    const tb = ev.target.closest('#tSeg button'); if (tb) { tFilter = tb.dataset.t; renderTargets(); return; }
    const row = ev.target.closest('.trow'); if (!row) return;
    const t = targets().find(z => z.uid === row.dataset.uid); if (!t) return;
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'del') { col.targets = targets().filter(z => z !== t); persist(); renderTargets(); renderTabs(); toast('Tolta dai target'); }
    else if (act === 'open' && t.eid) openDetail(t.eid);
  });
  $('#sectionHead').addEventListener('click', ev => { const tb = ev.target.closest('#tSeg button'); if (tb) { tFilter = tb.dataset.t; renderTargets(); } });
  $('#faceSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ui.face = b.dataset.face; syncControls(); renderContent(); });
  $('#viewSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ui.view = b.dataset.view; syncControls(); renderContent(); });
  let qT; $('#search').addEventListener('input', ev => {
    clearTimeout(qT); qT = setTimeout(() => {
      ui.q = ev.target.value.trim();
      if (ui.q && ui.group !== 'target' && !ENTRIES.some(e => e.group === ui.group && matches(e))) { const hit = ENTRIES.find(matches); if (hit) { ui.group = hit.group; renderTabs(); syncControls(); } }
      renderContent();
    }, 140);
  });
  $('#content').addEventListener('click', ev => { const p = ev.target.closest('.pocket[data-id]'); if (p) openDetail(p.dataset.id); });
  $('#mineList').addEventListener('click', ev => {
    const own = ev.target.closest('.own'); if (!own) return;
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'cover') setCover(own.dataset.uid);
    else if (own.dataset.uid !== 'sprite') { selUid = own.dataset.uid; renderMine(); fillForm(); }
  });
  $('#removeCard').addEventListener('click', () => { if (selUid) removeCard(selUid); });
  $('#photoFrom').addEventListener('click', () => setPhotoMode(true));
  $('#photoCancel').addEventListener('click', () => setPhotoMode(false));
  $('#photoReset').addEventListener('click', () => {
    const x = mine(current.id).find(z => z.uid === selUid); if (!x) return;
    x.img = x.imgOwn ?? null; delete x.imgOwn; delete x.imgFrom;
    persist(); renderMine(); fillForm(); refreshAfterEdit(); toast('Foto originale ripristinata');
  });
  dlg.addEventListener('close', () => setPhotoMode(false));
  form.addEventListener('change', readForm);
  form.addEventListener('submit', ev => ev.preventDefault());
  $('#catGrid').addEventListener('click', ev => { const b = ev.target.closest('.cand'); if (b) pickCatalog(b.dataset.cid); });
  $('#catFilter').addEventListener('input', () => { catLimit = 60; renderCatalog(); });
  $('#rarityFilter').addEventListener('change', ev => { ui.rf = ev.target.value; catLimit = 60; syncControls(); renderCatalog(); });
  $('#srcSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ui.src = b.dataset.src; catLimit = 60; syncControls(); renderCatalog(); });
  $('#catMore').addEventListener('click', () => { catLimit += 60; renderCatalog(); });
  $('#addManual').addEventListener('click', addManual);
  $('#langInt').addEventListener('change', ev => { ui.langInt = ev.target.value; syncControls(); });
  $('#langJp').addEventListener('change', ev => { ui.langJp = ev.target.value; syncControls(); });
  $('#dPrev').addEventListener('click', () => step(-1));
  $('#dNext').addEventListener('click', () => step(1));
  dlg.addEventListener('keydown', ev => { if (ev.target.matches('input, select, textarea')) return; if (ev.key === 'ArrowRight') step(1); if (ev.key === 'ArrowLeft') step(-1); });
  dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
  $('#openSettings').addEventListener('click', () => { initGithubFields(); renderDataDates(); $('#settings').showModal(); });
  $('#settings').addEventListener('click', ev => { if (ev.target === $('#settings')) $('#settings').close(); });
  ['#ghOwner', '#ghRepo', '#ghBranch', '#ghToken'].forEach(s => $(s).addEventListener('change', saveGhFields));
  $('#ghSave').addEventListener('click', ghSave);
  $('#ghPull').addEventListener('click', ghPull);
  $('#refreshPrices').addEventListener('click', refreshPrices);
  $('#exportJson').addEventListener('click', () => download('collection.json', JSON.stringify(col, null, 1), 'application/json'));
  $('#exportCsv').addEventListener('click', exportCsv);
  $('#importJson').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (!j.cards) throw 0; col = migrate(j); persist(); renderAll(); toast('Collezione importata'); }
    catch { toast('File non valido: serve un collection.json esportato da qui'); }
    ev.target.value = '';
  });
  $('#resetLocal').addEventListener('click', () => {
    if (!dirty) { toast('Nessuna modifica locale da scartare'); return; }
    const b = $('#resetLocal');
    if (b.dataset.armed) { col = structuredClone(remote); dirty = false; store.del(LS.col); renderAll(); toast('Modifiche locali scartate'); delete b.dataset.armed; b.textContent = 'Scarta modifiche locali'; }
    else { b.dataset.armed = '1'; b.textContent = 'Tocca di nuovo per confermare'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Scarta modifiche locali'; }, 4000); }
  });

  // language pickers in the catalog header
  $('#langInt').innerHTML = LANGS.int.map(l => `<option${l === ui.langInt ? ' selected' : ''}>${l}</option>`).join('');
  $('#langJp').innerHTML = LANGS.jp.map(l => `<option${l === ui.langJp ? ' selected' : ''}>${l}</option>`).join('');
  $('#rarityFilter').innerHTML = RFILTERS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');

  /* ---------------- quick add (+) ---------------- */
  const quick = $('#quick');
  function renderQuick() {
    const q = $('#qInput').value.trim().toLowerCase().replace(/^#0*/, '');
    if (!q) { $('#qList').innerHTML = '<p class="hint">Inizia a scrivere un nome o un numero del Pokédex.</p>'; return; }
    const hits = ENTRIES.filter(e => e.name.toLowerCase().includes(q) || String(e.dex) === q || (e.region || '').toLowerCase().includes(q))
      .sort((a, b) => (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1) || a.dex - b.dex).slice(0, 30);
    $('#qList').innerHTML = hits.length ? hits.map(e => {
      const g = GROUPS.find(x => x.id === e.group), n = mine(e.id).length;
      return `<button type="button" class="q-item" data-id="${e.id}"><span class="q-spr${n ? '' : ' ghost'}">${sprite(e)}</span>
        <span class="q-txt"><b>${esc(e.name)}${e.region ? ' · ' + esc(e.region) : ''}</b><span>${dexStr(e.dex)} · ${g.tab} · Pagina ${e.page}, tasca ${e.pos}</span></span>
        <span class="q-n">${n ? n + (n > 1 ? ' carte' : ' carta') : 'Mancante'}</span></button>`;
    }).join('') : `<p class="hint">Nessun Pokémon trovato per “${esc(q)}”.</p>`;
  }
  $('#fab').addEventListener('click', () => { $('#qInput').value = ''; renderQuick(); quick.showModal(); setTimeout(() => $('#qInput').focus(), 50); });
  $('#qInput').addEventListener('input', renderQuick);
  quick.addEventListener('click', ev => {
    if (ev.target === quick) { quick.close(); return; }
    const it = ev.target.closest('.q-item'); if (!it) return;
    const e = BY_ID.get(it.dataset.id); quick.close();
    if (ui.group !== e.group) { ui.group = e.group; renderTabs(); renderContent(); syncControls(); }
    openDetail(e.id);
    setTimeout(() => $('.finder').scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    toast(`${e.name}: pagina ${e.page}, tasca ${e.pos}`);
  });

  /* ---------------- personal background ---------------- */
  const BG_KEY = 'pdx.bg.v1';
  function applyBg() { let d = null; try { d = localStorage.getItem(BG_KEY); } catch {} $('#bgPhoto').style.backgroundImage = d ? `url("${d}")` : ''; document.body.classList.toggle('has-photo', !!d); }
  $('#bgFile').addEventListener('change', ev => {
    const f = ev.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      try { localStorage.setItem(BG_KEY, c.toDataURL('image/jpeg', .8)); applyBg(); toast('Sfondo aggiornato'); } catch { toast('Immagine troppo grande per questo browser'); }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f); ev.target.value = '';
  });
  $('#bgClear').addEventListener('click', () => { try { localStorage.removeItem(BG_KEY); } catch {} applyBg(); toast('Sfondo rimosso'); });
  applyBg();

  load().catch(err => { $('#content').innerHTML = `<p class="empty">Impossibile caricare i dati (${esc(err.message)}). Apri il sito tramite GitHub Pages o un server locale.</p>`; });
})();
