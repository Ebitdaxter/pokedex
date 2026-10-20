/* Il mio Pokédex — binder-style card tracker. Vanilla JS, no build step. */
(() => {
  'use strict';

  const SPRITE = p => `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/${p}/Normal.png`;
  const TCG_API = 'https://api.pokemontcg.io/v2/cards';
  const LS = { col: 'pdx.collection.v1', gh: 'pdx.github.v1', ui: 'pdx.ui.v1', cache: 'pdx.tcgcache.v1' };
  const GROUPS = [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => ({ id: 'g' + g, tab: 'Gen ' + ['I','II','III','IV','V','VI','VII','VIII','IX'][g - 1],
      title: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unima', 'Kalos', 'Alola', 'Galar', 'Paldea'][g - 1], cols: 4 })),
    { id: 'mega', tab: 'Mega', title: 'Megaevoluzioni', cols: 3 },
    { id: 'regional', tab: 'Regionali', title: 'Forme regionali', cols: 3 },
  ];
  const TYPE_COLORS = { Normal: '#9a9a6e', Fire: '#e5662c', Water: '#4a7fe0', Electric: '#e6b412', Grass: '#4fa83d', Ice: '#5bbdbd',
    Fighting: '#b8322a', Poison: '#9640a0', Ground: '#c9a14a', Flying: '#8a74d8', Psychic: '#e9466f', Bug: '#8fa31a',
    Rock: '#a8902f', Ghost: '#62508c', Dragon: '#5c34e8', Dark: '#5a4638', Steel: '#8e8eaa', Fairy: '#d9709a' };
  const TYPE_IT = { Normal: 'Normale', Fire: 'Fuoco', Water: 'Acqua', Electric: 'Elettro', Grass: 'Erba', Ice: 'Ghiaccio',
    Fighting: 'Lotta', Poison: 'Veleno', Ground: 'Terra', Flying: 'Volante', Psychic: 'Psico', Bug: 'Coleottero', Rock: 'Roccia',
    Ghost: 'Spettro', Dragon: 'Drago', Dark: 'Buio', Steel: 'Acciaio', Fairy: 'Folletto' };
  const STAT_LABELS = ['PS', 'Attacco', 'Difesa', 'Att. Sp.', 'Dif. Sp.', 'Velocità'];

  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const eur = n => (n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  const dexStr = n => '#' + String(n).padStart(4, '0');

  let ENTRIES = [], BY_ID = new Map(), SETS = [];
  let remote = null;          // collection as loaded from the repo
  let col = { version: 1, updated: null, cards: {} };
  let dirty = false;          // local changes not yet pushed to GitHub
  const ui = Object.assign({ group: 'g1', filter: 'all', view: 'binder', q: '' }, store.get(LS.ui, {}));
  const tcgCache = store.get(LS.cache, {});
  let current = null;         // entry open in detail

  /* ---------------- data load ---------------- */
  async function load() {
    const [p, c, s] = await Promise.all([
      fetch('data/pokedex.json').then(r => r.json()),
      fetch('data/collection.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('data/sets.json').then(r => r.json()).catch(() => []),
    ]);
    ENTRIES = p; ENTRIES.forEach(e => BY_ID.set(e.id, e)); SETS = s;
    remote = c || { version: 1, updated: null, cards: {} };
    const local = store.get(LS.col, null);
    if (local && local.dirty && (!remote.updated || local.updated >= remote.updated)) {
      col = local.data; dirty = true;
    } else {
      col = structuredClone(remote); dirty = false; store.del(LS.col);
    }
    $('#setList').innerHTML = SETS.map(x => `<option value="${esc(x.name)}">${esc(x.year)}</option>`).join('');
    initGithubFields();
    renderAll();
  }

  function persist() {
    col.updated = new Date().toISOString();
    dirty = true;
    store.set(LS.col, { dirty: true, updated: col.updated, data: col });
    renderSync();
  }

  const card = id => col.cards[id];
  const isOwned = id => !!col.cards[id];

  /* ---------------- render: header ---------------- */
  function renderTotals() {
    const owned = ENTRIES.filter(e => isOwned(e.id));
    const main = ENTRIES.filter(e => e.group.startsWith('g'));
    const mainOwned = main.filter(e => isOwned(e.id)).length;
    const art = owned.filter(e => card(e.id).art).length;
    const value = owned.reduce((s, e) => s + (+card(e.id).value || 0), 0);
    $('#totals').innerHTML = `
      <div><dt>Pokédex</dt><dd>${mainOwned}<small>/ ${main.length}</small></dd></div>
      <div><dt>Carte</dt><dd>${owned.length}</dd></div>
      <div><dt>Art rare</dt><dd>${art}</dd></div>
      <div><dt>Valore</dt><dd>${eur(value)}</dd></div>`;
  }

  function renderTabs() {
    $('#tabs').innerHTML = GROUPS.map(g => {
      const list = ENTRIES.filter(e => e.group === g.id);
      const n = list.filter(e => isOwned(e.id)).length;
      const pct = list.length ? Math.round(n / list.length * 100) : 0;
      return `<button class="tab" role="tab" data-group="${g.id}" aria-selected="${ui.group === g.id}">
        <b>${g.tab}</b><span>${n}/${list.length} · ${pct}%</span><i class="meter"><i style="width:${pct}%"></i></i></button>`;
    }).join('');
  }

  function renderSync() {
    $('#dirtyDot').hidden = !dirty;
    const t = col.updated ? new Date(col.updated).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    $('#syncState').textContent = dirty ? `Modifiche salvate nel browser, non ancora su GitHub` : `Aggiornato ${t}`;
  }

  /* ---------------- render: content ---------------- */
  function matches(e) {
    const c = card(e.id);
    if (ui.filter === 'owned' && !c) return false;
    if (ui.filter === 'missing' && c) return false;
    if (ui.filter === 'art' && !(c && c.art)) return false;
    if (ui.q) {
      const q = ui.q.toLowerCase().replace(/^#0*/, '');
      if (!(e.name.toLowerCase().includes(q) || String(e.dex) === q)) return false;
    }
    return true;
  }

  function typeVars(e) {
    const a = TYPE_COLORS[e.types[0]] || '#888', b = TYPE_COLORS[e.types[1]] || a;
    return `--t1:${a};--t2:${b}`;
  }

  function pocket(e) {
    const c = card(e.id);
    const label = e.group === 'regional' ? `${e.name} di ${e.region}` : e.name;
    const no = e.group.startsWith('g') ? dexStr(e.dex) : (e.region || dexStr(e.dex));
    if (!c) {
      return `<button class="pocket missing" data-id="${e.id}" aria-label="${esc(label)}, mancante">
        <span class="no">${esc(no)}</span><span class="spr"><img loading="lazy" alt="" src="${SPRITE(e.sprite)}" data-fallback="${String(e.dex).padStart(4, '0')}"></span>
        <span class="nm">${esc(e.name)}</span></button>`;
    }
    const art = c.art ? '<span class="badge-art" title="Art rare">A</span>' : '';
    if (c.img) {
      return `<button class="pocket owned has-img" data-id="${e.id}" aria-label="${esc(label)}, ${esc(c.set || 'carta presente')}">
        <img class="card" loading="lazy" alt="" src="${esc(c.img)}">${art}</button>`;
    }
    const meta = [c.rarity, c.lang, c.set].filter(Boolean).join(' · ');
    return `<button class="pocket owned" style="${typeVars(e)}" data-id="${e.id}" aria-label="${esc(label)}, presente">
      <span class="no">${esc(no)}</span>${art}<span class="spr"><img loading="lazy" alt="" src="${SPRITE(e.sprite)}" data-fallback="${String(e.dex).padStart(4, '0')}"></span>
      <span class="meta">${esc(meta)}</span><span class="nm">${esc(e.name)}</span></button>`;
  }

  function renderContent() {
    const g = GROUPS.find(x => x.id === ui.group) || GROUPS[0];
    const all = ENTRIES.filter(e => e.group === g.id);
    const list = all.filter(matches);
    const n = all.filter(e => isOwned(e.id)).length;
    const first = all[0], last = all[all.length - 1];
    const range = g.id.startsWith('g') ? `${dexStr(first.dex)}–${dexStr(last.dex)}` : `${all.length} forme`;
    $('#sectionHead').innerHTML = `<h2>${g.title}</h2><p>${range} · ${n} di ${all.length} nel raccoglitore</p>`;

    if (!list.length) {
      $('#content').innerHTML = `<p class="empty">${ui.q ? `Nessun Pokémon trovato per “${esc(ui.q)}” in questa sezione.` : 'Niente da mostrare con questo filtro.'}</p>`;
      return;
    }
    if (ui.view === 'grid' || ui.q) {
      $('#content').innerHTML = `<div class="grid">${list.map(pocket).join('')}</div>`;
      return;
    }
    // binder: group by physical page, keep true pocket positions
    const per = g.cols * g.cols;
    const pages = new Map();
    for (const e of list) {
      if (!pages.has(e.page)) pages.set(e.page, new Array(per).fill(null));
      pages.get(e.page)[e.pos - 1] = e;
    }
    const html = [...pages.entries()].sort((a, b) => a[0] - b[0]).map(([p, slots]) => {
      const inPage = ENTRIES.filter(e => e.group === g.id && e.page === p);
      const own = inPage.filter(e => isOwned(e.id)).length;
      return `<section class="page" aria-label="Pagina ${p}"><div class="page-label"><b>Pagina ${p}</b><span>${own}/${inPage.length}</span></div>
        <div class="pockets c${g.cols}">${slots.map(e => e ? pocket(e) : '<div class="pocket void" aria-hidden="true"></div>').join('')}</div></section>`;
    }).join('');
    $('#content').innerHTML = `<div class="pages">${html}</div>`;
  }

  function renderAll() { renderTotals(); renderTabs(); renderContent(); renderSync(); syncControls(); }

  function syncControls() {
    document.querySelectorAll('#filterSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.filter === ui.filter));
    document.querySelectorAll('#viewSeg button').forEach(b => b.setAttribute('aria-checked', b.dataset.view === ui.view));
    store.set(LS.ui, { group: ui.group, filter: ui.filter, view: ui.view });
  }

  // sprite fallback (form portrait missing → base species)
  document.addEventListener('error', ev => {
    const img = ev.target;
    if (img.tagName === 'IMG' && img.dataset.fallback && !img.dataset.fellBack) {
      img.dataset.fellBack = '1'; img.src = SPRITE(img.dataset.fallback);
    }
  }, true);

  /* ---------------- detail dialog ---------------- */
  const dlg = $('#detail'), form = $('#cardForm');

  function openDetail(id) {
    current = BY_ID.get(id); if (!current) return;
    fillDetail();
    if (!dlg.open) dlg.showModal();
    loadCandidates();
  }

  function fillDetail() {
    const e = current, c = card(e.id);
    $('#dSprite').src = SPRITE(e.sprite); $('#dSprite').dataset.fallback = String(e.dex).padStart(4, '0'); delete $('#dSprite').dataset.fellBack;
    $('#dSprite').closest('.poke-art').classList.toggle('ghost', !c);
    $('#dNo').textContent = dexStr(e.dex) + (e.region ? ` · forma di ${e.region}` : e.group === 'mega' ? ' · megaevoluzione' : '');
    $('#dName').textContent = e.name;
    $('#dTypes').innerHTML = e.types.map(t => `<span class="type" style="--c:${TYPE_COLORS[t] || '#888'}">${TYPE_IT[t] || t}</span>`).join('');
    $('#dWhere').textContent = `Raccoglitore: pagina ${e.page}, tasca ${e.pos}`;
    $('#dStats').innerHTML = e.stats ? e.stats.map((v, i) => `<span>${STAT_LABELS[i]}</span><b>${v ?? '–'}</b><i style="--w:${Math.min(100, (v || 0) / 180 * 100)}%"></i>`).join('') : '';
    $('#fOwned').checked = !!c;
    form.classList.toggle('off', !c);
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') el.checked = !!(c && c[el.name]);
      else el.value = c && c[el.name] != null ? c[el.name] : '';
    }
    renderCardBox();
    const q = encodeURIComponent(e.name.replace(/^Mega /, '').replace(/ (X|Y|Z)$/, ''));
    $('#extLinks').innerHTML = `Non la trovi? Cercala su <a href="https://www.tcgcollector.com/cards/intl?cardSearch=${q}" target="_blank" rel="noopener">TCGCollector (internazionale)</a> o <a href="https://www.tcgcollector.com/cards/jp?cardSearch=${q}" target="_blank" rel="noopener">TCGCollector (Giappone)</a>, poi incolla l'URL dell'immagine nel campo qui sopra.`;
    $('#finderFilter').value = '';
  }

  function renderCardBox() {
    const c = card(current.id);
    const box = $('#cardBox');
    if (!c) { box.innerHTML = `<div class="ph">Non ancora nel raccoglitore</div><p class="summary">Attiva “Ce l'ho” oppure scegli direttamente una carta qui sotto.</p>`; return; }
    const title = [c.set, c.number].filter(Boolean).join(' ') || 'Carta presente';
    const line2 = [c.rarity, c.lang, c.year, c.variant].filter(Boolean).join(' · ');
    box.innerHTML = (c.img ? `<img class="big" alt="Carta ${esc(current.name)}" src="${esc(c.img)}">` : `<div class="ph">Nessuna immagine: scegli la carta qui sotto</div>`) +
      `<p class="summary"><strong>${esc(title)}</strong>${esc(line2)}${c.value ? `<br>Valore: ${eur(+c.value)}` : ''}${c.art ? '<br>Art rare' : ''}</p>`;
  }

  function setOwned(on) {
    if (on && !card(current.id)) col.cards[current.id] = { art: false };
    if (!on) delete col.cards[current.id];
    persist(); fillDetail(); refreshAfterEdit();
    toast(on ? `${current.name} aggiunto` : `${current.name} rimosso`);
  }

  function readForm() {
    const c = card(current.id); if (!c) return;
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') c[el.name] = el.checked;
      else if (el.name === 'value') { const v = parseFloat(el.value.replace(',', '.')); if (isNaN(v)) delete c.value; else c.value = v; }
      else if (el.value.trim()) c[el.name] = el.value.trim(); else delete c[el.name];
    }
    if (c.set && !c.year) { const s = SETS.find(x => x.name === c.set); if (s) { c.year = String(s.year); form.elements.year.value = c.year; } }
    persist(); renderCardBox(); refreshAfterEdit();
  }

  let refreshT;
  function refreshAfterEdit() { clearTimeout(refreshT); refreshT = setTimeout(() => { renderTotals(); renderTabs(); renderContent(); }, 120); }

  function step(dir) {
    const list = ENTRIES.filter(e => e.group === current.group && matches(e));
    const i = list.findIndex(e => e.id === current.id);
    const nx = list[(i + dir + list.length) % list.length];
    if (nx) openDetail(nx.id);
  }

  /* ---------------- card finder (pokemontcg.io) ---------------- */
  let candidates = [], candToken = 0;

  async function fetchCards(dex) {
    const hit = tcgCache[dex];
    if (hit && Date.now() - hit.t < 1000 * 60 * 60 * 24 * 14) return hit.cards;
    const url = `${TCG_API}?q=nationalPokedexNumbers:${dex}&orderBy=-set.releaseDate&pageSize=250&select=id,name,number,rarity,set,images`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const cards = j.data.map(x => ({ id: x.id, name: x.name, number: x.number, total: x.set.printedTotal, rarity: x.rarity || '',
      set: x.set.name, series: x.set.series, date: x.set.releaseDate, sm: x.images.small, lg: x.images.large }));
    tcgCache[dex] = { t: Date.now(), cards };
    if (!store.set(LS.cache, tcgCache)) { for (const k in tcgCache) if (k != dex) delete tcgCache[k]; store.set(LS.cache, tcgCache); }
    return cards;
  }

  function relevant(e, list) {
    // narrow to the form shown in this pocket
    if (e.group === 'mega') {
      const suf = (e.name.match(/ (X|Y|Z)$/) || [])[1];
      const m = list.filter(c => /^M |^Mega /i.test(c.name) && (!suf || c.name.includes(' ' + suf)));
      return m.length ? m : list;
    }
    if (e.group === 'regional') {
      const adj = { Alola: 'Alolan', Galar: 'Galarian', Hisui: 'Hisuian', Paldea: 'Paldean' }[e.region];
      const m = list.filter(c => c.name.includes(adj));
      return m.length ? m : list;
    }
    return list.filter(c => !/^(M |Mega )|Alolan|Galarian|Hisuian|Paldean/.test(c.name)).length ? list.filter(c => !/^(M |Mega )|Alolan|Galarian|Hisuian|Paldean/.test(c.name)) : list;
  }

  async function loadCandidates() {
    const e = current, tk = ++candToken;
    $('#finderGrid').innerHTML = '';
    $('#finderNote').textContent = 'Carico le carte di ' + e.name + '…';
    try {
      const list = relevant(e, await fetchCards(e.dex));
      if (tk !== candToken) return;
      candidates = list;
      $('#finderNote').textContent = list.length ? `${list.length} carte dal catalogo internazionale, dalla più recente. Tocca una carta per registrarla.` : 'Nessuna carta trovata nel catalogo internazionale.';
      renderCandidates();
    } catch (err) {
      if (tk !== candToken) return;
      $('#finderNote').textContent = 'Catalogo carte non raggiungibile al momento. Puoi comunque compilare i campi a mano.';
    }
  }

  function renderCandidates() {
    const f = $('#finderFilter').value.trim().toLowerCase();
    const c = card(current.id);
    const list = f ? candidates.filter(x => (x.set + ' ' + x.rarity + ' ' + x.series + ' ' + x.name).toLowerCase().includes(f)) : candidates;
    $('#finderGrid').innerHTML = list.map(x => `<button type="button" class="cand${c && c.tcgId === x.id ? ' sel' : ''}" data-cid="${esc(x.id)}">
      <img loading="lazy" alt="" src="${esc(x.sm)}"><span>${esc(x.set)} · ${esc(x.number)}/${esc(x.total)}${x.rarity ? '<br>' + esc(x.rarity) : ''}</span></button>`).join('');
  }

  function pickCandidate(cid) {
    const x = candidates.find(c => c.id === cid); if (!x) return;
    const prev = card(current.id) || {};
    col.cards[current.id] = Object.assign({}, prev, {
      set: x.set, year: (x.date || '').slice(0, 4), number: `${x.number}/${x.total}`, rarity: shortRarity(x.rarity) || prev.rarity,
      img: x.lg, tcgId: x.id, art: prev.art || /Illustration|Special Art|Character|Trainer Gallery/i.test(x.rarity),
      lang: prev.lang || 'ENG',
    });
    persist(); fillDetail(); renderCandidates(); refreshAfterEdit();
    toast('Carta registrata');
  }

  function shortRarity(r) {
    const m = { 'Common': 'Common', 'Uncommon': 'Uncommon', 'Rare': 'Rare', 'Rare Holo': 'Rare', 'Double Rare': 'RR', 'Illustration Rare': 'AR',
      'Special Illustration Rare': 'SAR', 'Ultra Rare': 'SR', 'Hyper Rare': 'UR', 'Rare Ultra': 'SR', 'Rare Secret': 'UR', 'Rare Rainbow': 'UR',
      'Promo': 'Promo', 'ACE SPEC Rare': 'ACE', 'Trainer Gallery Rare Holo': 'CHR', 'Rare Holo V': 'RR', 'Rare Holo VMAX': 'RRR', 'Rare Holo EX': 'RR', 'Rare Holo GX': 'RR' };
    return m[r] || r;
  }

  /* ---------------- auto-match images for seeded cards ---------------- */
  const normSet = s => (s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const normNo = s => (s || '').split('/')[0].replace(/^0+/, '').toLowerCase();

  async function autoMatch() {
    const btn = $('#autoMatch'); btn.disabled = true;
    const todo = ENTRIES.filter(e => { const c = card(e.id); return c && !c.img && c.set && c.number; });
    let done = 0, found = 0;
    const out = $('#matchStatus');
    for (const e of todo) {
      out.textContent = `Controllo ${++done} di ${todo.length}… (${found} abbinate)`;
      try {
        const list = await fetchCards(e.dex);
        const c = card(e.id);
        const hit = list.find(x => normSet(x.set) === normSet(c.set) && normNo(x.number) === normNo(c.number));
        if (hit) { c.img = hit.lg; c.tcgId = hit.id; found++; }
      } catch { out.textContent = 'Catalogo non raggiungibile: riprova più tardi.'; break; }
      await new Promise(r => setTimeout(r, 120));
    }
    if (found) { persist(); renderAll(); }
    out.textContent = `Fatto: ${found} immagini abbinate su ${todo.length} carte senza immagine.`;
    btn.disabled = false;
  }

  /* ---------------- GitHub sync ---------------- */
  function ghDefaults() {
    const h = location.hostname, seg = location.pathname.split('/').filter(Boolean)[0];
    if (h.endsWith('.github.io')) return { owner: h.split('.')[0], repo: seg || h, branch: 'main' };
    return { owner: '', repo: '', branch: 'main' };
  }
  function ghCfg() { return Object.assign(ghDefaults(), store.get(LS.gh, {})); }
  function initGithubFields() {
    const c = ghCfg();
    $('#ghOwner').value = c.owner || ''; $('#ghRepo').value = c.repo || ''; $('#ghBranch').value = c.branch || 'main'; $('#ghToken').value = c.token || '';
  }
  function saveGhFields() {
    const c = { owner: $('#ghOwner').value.trim(), repo: $('#ghRepo').value.trim(), branch: $('#ghBranch').value.trim() || 'main', token: $('#ghToken').value.trim() };
    store.set(LS.gh, c); return c;
  }
  const b64 = str => btoa(String.fromCharCode(...new TextEncoder().encode(str)));
  const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));

  async function gh(path, opts = {}) {
    const c = saveGhFields();
    if (!c.owner || !c.repo) throw new Error('Indica utente e repository.');
    const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}${opts.method ? '' : `?ref=${encodeURIComponent(c.branch)}`}`, {
      ...opts, headers: { Accept: 'application/vnd.github+json', ...(c.token ? { Authorization: `Bearer ${c.token}` } : {}), ...(opts.headers || {}) } });
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
      let sha;
      try { sha = (await gh('data/collection.json')).sha; } catch (e) { if (!/non trovato/.test(e.message)) throw e; }
      col.updated = new Date().toISOString();
      const body = { message: `Aggiorna collezione (${Object.keys(col.cards).length} carte)`, content: b64(JSON.stringify(col, null, 1)), branch: c.branch, ...(sha ? { sha } : {}) };
      await gh('data/collection.json', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
      remote = structuredClone(col); dirty = false; store.del(LS.col); renderSync();
      st.textContent = 'Salvato su GitHub. Il sito pubblico si aggiorna entro un paio di minuti.';
      toast('Salvato su GitHub');
    } catch (e) { st.textContent = e.message; }
    $('#ghSave').disabled = false;
  }

  async function ghPull() {
    const st = $('#ghStatus');
    if (dirty && !confirmLoss()) return;
    st.textContent = 'Scarico da GitHub…';
    try {
      const f = await gh('data/collection.json');
      col = JSON.parse(unb64(f.content)); remote = structuredClone(col); dirty = false; store.del(LS.col);
      renderAll(); st.textContent = 'Collezione ricaricata da GitHub.';
    } catch (e) { st.textContent = e.message; }
  }
  function confirmLoss() { return window.confirm('Hai modifiche non salvate su GitHub. Vuoi scartarle?'); }

  /* ---------------- export / import ---------------- */
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCsv() {
    const head = ['Sezione', 'Pokedex #', 'Nome', 'Regione', 'Gen', 'Pagina', 'Posizione', 'Cielo/Manca', 'Art Flag', 'Tipo', 'Lingua', 'Variante', 'Expansion', 'Year', 'Card #', 'Value', 'Immagine'];
    const q = v => { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const rows = ENTRIES.map(e => { const c = card(e.id) || {}; const g = GROUPS.find(x => x.id === e.group);
      return [g.tab, e.dex, e.name, e.region, e.gen, e.page, e.pos, isOwned(e.id) ? 'TRUE' : 'FALSE', c.art ? 'TRUE' : 'FALSE', c.rarity, c.lang, c.variant, c.set, c.year, c.number, c.value != null ? String(c.value).replace('.', ',') : '', c.img]; });
    download('pokedex.csv', '﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  /* ---------------- toast ---------------- */
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); }

  /* ---------------- events ---------------- */
  $('#tabs').addEventListener('click', ev => { const b = ev.target.closest('.tab'); if (!b) return; ui.group = b.dataset.group; renderTabs(); renderContent(); syncControls(); window.scrollTo({ top: 0 }); });
  $('#filterSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ui.filter = b.dataset.filter; syncControls(); renderContent(); });
  $('#viewSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ui.view = b.dataset.view; syncControls(); renderContent(); });
  let qT; $('#search').addEventListener('input', ev => {
    clearTimeout(qT); qT = setTimeout(() => {
      ui.q = ev.target.value.trim();
      if (ui.q) { // jump to the section holding the first match
        const here = ENTRIES.some(e => e.group === ui.group && matches(e));
        if (!here) { const hit = ENTRIES.find(matches); if (hit) { ui.group = hit.group; renderTabs(); syncControls(); } }
      }
      renderContent();
    }, 140);
  });
  $('#content').addEventListener('click', ev => { const p = ev.target.closest('.pocket[data-id]'); if (p) openDetail(p.dataset.id); });
  $('#fOwned').addEventListener('change', ev => setOwned(ev.target.checked));
  form.addEventListener('change', readForm);
  form.addEventListener('submit', ev => ev.preventDefault());
  $('#finderGrid').addEventListener('click', ev => { const b = ev.target.closest('.cand'); if (b) pickCandidate(b.dataset.cid); });
  $('#finderFilter').addEventListener('input', renderCandidates);
  $('#dPrev').addEventListener('click', () => step(-1));
  $('#dNext').addEventListener('click', () => step(1));
  dlg.addEventListener('keydown', ev => {
    if (ev.target.matches('input, select, textarea')) return;
    if (ev.key === 'ArrowRight') step(1); if (ev.key === 'ArrowLeft') step(-1);
  });
  dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
  $('#openSettings').addEventListener('click', () => { initGithubFields(); $('#settings').showModal(); });
  $('#settings').addEventListener('click', ev => { if (ev.target === $('#settings')) $('#settings').close(); });
  ['#ghOwner', '#ghRepo', '#ghBranch', '#ghToken'].forEach(s => $(s).addEventListener('change', saveGhFields));
  $('#ghSave').addEventListener('click', ghSave);
  $('#ghPull').addEventListener('click', ghPull);
  $('#autoMatch').addEventListener('click', autoMatch);
  $('#exportJson').addEventListener('click', () => download('collection.json', JSON.stringify(col, null, 1), 'application/json'));
  $('#exportCsv').addEventListener('click', exportCsv);
  $('#importJson').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (!j.cards) throw 0; col = j; persist(); renderAll(); toast('Collezione importata'); }
    catch { toast('File non valido: serve un collection.json esportato da qui'); }
    ev.target.value = '';
  });
  $('#resetLocal').addEventListener('click', () => {
    if (!dirty) { toast('Nessuna modifica locale da scartare'); return; }
    if (!confirmLoss()) return;
    col = structuredClone(remote); dirty = false; store.del(LS.col); renderAll(); toast('Modifiche locali scartate');
  });
  window.addEventListener('beforeunload', ev => { /* local copy is already saved; nothing to block */ });

  load().catch(err => { $('#content').innerHTML = `<p class="empty">Impossibile caricare i dati (${esc(err.message)}). Apri il sito tramite GitHub Pages o un server locale.</p>`; });
})();
