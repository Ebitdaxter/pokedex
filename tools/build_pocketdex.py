"""Pokédex Pocket: every TCG Pocket card of each Pokémon (from TCGdex), grouped by the site's Pokédex entries
(national dex, Mega, regional forms). Default picture = a full art (3★ immersive, then 2★ rainbow); the other rarities
are kept as options. Writes data/pocketdex.json as {entryId: [cards…]}."""
import json, os, re, glob, collections
SRC = os.environ.get('SRC', '_src')
LABEL = {'One Diamond': '◆', 'Two Diamond': '◆◆', 'Three Diamond': '◆◆◆', 'Four Diamond': '◆◆◆◆', 'One Star': '★', 'Two Star': '★★',
         'Three Star': '★★★', 'Crown': '♛', 'One Shiny': '✦', 'Two Shiny': '✦✦'}
RANK = {'★★★': 0, '★★': 1, '♛': 2, '★': 3, '✦✦': 4, '✦': 5, '◆◆◆◆': 6, '◆◆◆': 7, '◆◆': 8, '◆': 9}
FULL = {'★★★', '★★'}
ents = json.load(open('data/pokedex.json', encoding='utf-8'))
base = {e['dex']: e['id'] for e in ents if e['group'].startswith('g')}
megas = collections.defaultdict(list); regs = {}
for e in ents:
    if e['group'] == 'mega': megas[e['dex']].append(e)
    if e['group'] == 'regional': regs.setdefault((e['dex'], e['region']), e['id'])
ADJ = {'Alolan': 'Alola', 'Galarian': 'Galar', 'Hisuian': 'Hisui', 'Paldean': 'Paldea'}

def entry_for(name, dex):
    m = re.match(r'^Mega (.+?)( ex)?$', name)
    if m and megas.get(dex):
        suf = re.search(r' ([XYZ])$', m.group(1))
        for e in megas[dex]:
            if (suf and e['name'].endswith(' ' + suf.group(1))) or (not suf and not re.search(r' [XYZ]$', e['name'])): return e['id']
        return megas[dex][0]['id']
    a = re.match(r'^(Alolan|Galarian|Hisuian|Paldean) ', name)
    if a and (dex, ADJ[a.group(1)]) in regs: return regs[(dex, ADJ[a.group(1)])]
    return base.get(dex)

by = collections.defaultdict(list)
for f in glob.glob(f'{SRC}/tcgdex/data/Pokémon TCG Pocket/*/*.ts'):
    t = open(f, encoding='utf-8').read()
    if not re.search(r'category:\s*["\']Pokemon', t): continue
    r = re.search(r'rarity:\s*["\']([^"\']+)', t); rc = LABEL.get(r.group(1) if r else '')
    if not rc: continue
    dx = re.search(r'dexId:\s*\[([\d,\s]+)\]', t)
    if not dx: continue
    name = re.search(r"name:\s*\{[^}]*?\ben:\s*['\"]([^'\"]+)", t, re.S).group(1)
    st = open(os.path.dirname(f) + '.ts', encoding='utf-8').read()
    sid = re.search(r"id:\s*['\"]([^'\"]+)", st).group(1)
    sname = re.search(r"name:\s*\{[^}]*?\ben:\s*['\"]([^'\"]+)", st, re.S).group(1)
    dt = re.search(r"releaseDate[^\n]*?['\"](\d{4}-\d{2}-\d{2})", st) or re.search(r"releaseDate[^}]*?['\"](\d{4}-\d{2}-\d{2})", st, re.S)
    lid = os.path.basename(f)[:-3]
    seen = set()
    for d in [int(x) for x in dx.group(1).split(',') if x.strip()]:
        eid = entry_for(name, d)
        if not eid or eid in seen: continue
        seen.add(eid)
        by[eid].append({'id': f'{sid}-{lid}', 'n': name, 'set': sname, 'sid': sid, 'no': lid, 'rc': rc, 'fa': 1 if rc in FULL else 0,
                        'date': dt.group(1) if dt else '', 'img': f'https://assets.tcgdex.net/en/tcgp/{sid}/{lid}/high.webp',
                        'sm': f'https://assets.tcgdex.net/en/tcgp/{sid}/{lid}/low.webp'})
for k in by:
    by[k].sort(key=lambda c: (RANK[c['rc']], [-int(x) for x in (c['date'] or '0-0-0').split('-')]))
json.dump(dict(sorted(by.items())), open('data/pocketdex.json', 'w'), ensure_ascii=False, separators=(',', ':'))
fa = sum(1 for v in by.values() if any(c['fa'] for c in v))
print('pocket pokédex:', len(by), 'entries,', fa, 'with a full art,', sum(len(v) for v in by.values()), 'cards')
