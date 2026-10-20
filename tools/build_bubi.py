"""Sezione Bubi: full-art Supporter cards of adult female characters, plus every full art of Vaporeon and Gardevoir.
Sources: pokemon-tcg-data (international), TCGdex data-asia (Japanese, rarity inferred from the number) and TCGdex TCG Pocket.
Writes data/bubi.json."""
import json, os, re, glob, sys
sys.path.insert(0, os.path.dirname(__file__))
from infer import load_sets, infer

SRC = os.environ.get('SRC', '_src')
HERE = os.path.dirname(__file__)
JP_SET_EN = json.load(open(os.path.join(HERE, 'jp_set_names.json'), encoding='utf-8'))
CODE_NAMES = json.load(open(os.path.join(HERE, 'code_names.json'), encoding='utf-8'))

# key, English name used on cards, Japanese name used on cards. Only characters who are clearly adults in the games.
CHARS = [
    ('cynthia', 'Cynthia', 'シロナ'), ('elesa', 'Elesa', 'カミツレ'), ('skyla', 'Skyla', 'フウロ'), ('diantha', 'Diantha', 'カルネ'),
    ('lusamine', 'Lusamine', 'ルザミーネ'), ('melony', 'Melony', 'メロン'), ('miriam', 'Miriam', 'ミモザ'), ('geeta', 'Geeta', 'オモダカ'),
    ('sada', 'Professor Sada', 'オーリム'), ('juniper', 'Professor Juniper', 'アララギ'), ('burnet', 'Professor Burnet', 'バーネット'),
    ('rika', 'Rika', 'チリ'), ('lorelei', 'Lorelei', 'カンナ'), ('agatha', 'Agatha', 'キクコ'), ('karen', 'Karen', 'カリン'),
    ('glacia', 'Glacia', 'プリム'), ('winona', 'Winona', 'ナギ'), ('fantina', 'Fantina', 'メリッサ'), ('caitlin', 'Caitlin', 'カトレア'),
    ('shauntal', 'Shauntal', 'シキミ'), ('malva', 'Malva', 'パキラ'), ('olympia', 'Olympia', 'ゴジカ'), ('valerie', 'Valerie', 'マーシュ'),
    ('wicke', 'Wicke', 'ビッケ'), ('plumeria', 'Plumeria', 'プルメリ'), ('olivia', 'Olivia', 'ライチ'), ('sonia', 'Sonia', 'ソニア'),
    ('oleana', 'Oleana', 'オリーヴ'), ('ryme', 'Ryme', 'ライム'), ('tulip', 'Tulip', 'リップ'), ('dendra', 'Dendra', 'タイム'),
    ('cyllene', 'Cyllene', 'シマボシ'),
]
POKE = [('vaporeon', 134, 'Vaporeon'), ('gardevoir', 282, 'Gardevoir')]
FULL_TRAINER = {'SR', 'SAR', 'UR', 'CSR', 'CHR', 'SEC'}
FULL_POKE = {'AR', 'SAR', 'SR', 'UR', 'CHR', 'CSR', 'MUR', 'MA', 'SEC', 'SSR', 'RRR'}
POCKET_FULL = {'One Star': 'AR', 'Two Star': 'SAR', 'Three Star': 'IM', 'Crown': 'UR'}

def norm_r(r):
    l = (r or '').lower()
    for k, v in [('special illustration', 'SAR'), ('illustration rare', 'AR'), ('mega hyper', 'MUR'), ('mega attack', 'MA'), ('hyper rare', 'UR'),
                 ('secret', 'UR'), ('rainbow', 'UR'), ('character super', 'CSR'), ('character rare', 'CHR'), ('trainer gallery', 'CHR'),
                 ('shiny ultra', 'SSR'), ('triple rare', 'RRR'), ('ultra rare', 'SR'), ('rare ultra', 'SR'), ('double rare', 'RR')]:
        if k in l: return v
    return ''

def who(name_en=None, name_ja=None):
    for key, en, ja in CHARS:
        if name_en and re.search(r'(^|\W)' + re.escape(en) + r"($|\W|'s)", name_en): return key
        if name_ja and (name_ja.startswith(ja) or ('&' in name_ja and ja in name_ja)): return key
    return None

out = []
# ---------- international ----------
sets = {s['id']: s for s in json.load(open(f'{SRC}/ptcg/sets/en.json'))}
for f in glob.glob(f'{SRC}/ptcg/cards/en/*.json'):
    sid = os.path.basename(f)[:-5]; s = sets.get(sid)
    if not s: continue
    for c in json.load(open(f)):
        rc = norm_r(c.get('rarity'))
        raw = (c.get('rarity') or '').lower()
        if 'rainbow' in raw or 'shiny' in raw or 'shiny vault' in s['name'].lower() or rc in ('S', 'SSR'): continue
        if c.get('supertype') == 'Trainer' and 'Supporter' in (c.get('subtypes') or []):
            k = who(name_en=c['name'])
            if not k or rc not in FULL_TRAINER: continue
        else:
            k = next((p[0] for p in POKE if p[1] in (c.get('nationalPokedexNumbers') or [])), None)
            if not k or rc not in FULL_POKE: continue
        out.append({'k': k, 'src': 'int', 'id': c['id'], 'n': c['name'], 'set': s['name'], 'no': c['number'], 'tot': s.get('printedTotal'),
                    'date': s['releaseDate'][:10].replace('/', '-'), 'rc': rc, 'img': c['images']['large'], 'sm': c['images']['small']})

# ---------- Japanese ----------
rows, off = load_sets(); inf = infer(rows, off)
cards_by_dex = {}
for d in (134, 282):
    p = f'data/cards/{d:04d}.json'
    if os.path.exists(p): cards_by_dex[d] = json.load(open(p))
for k, d, _ in POKE:
    for c in cards_by_dex.get(d, []):
        if c['src'] == 'jp' and c['rc'] in FULL_POKE and c['rc'] not in ('S', 'SSR') and c.get('img') and not c.get('alt') \
                and not (c['rc'] == 'UR' and re.match(r'^(SM|S)\d', c['sid'])):
            out.append(dict(c, k=k))
for f in glob.glob(f'{SRC}/tcgdex/data-asia/*/*/*.ts'):
    parts = f.split('/'); serie, sid, lid = parts[-3], parts[-2], parts[-1][:-3]
    t = open(f, encoding='utf-8').read()
    if 'Supporter' not in t: continue
    m = re.search(r"name:\s*\{[^}]*?\bja:\s*['\"]([^'\"]+)", t, re.S)
    if not m: continue
    k = who(name_ja=m.group(1))
    if not k: continue
    rm = re.search(r'rarity:\s*["\']([^"\']+)', t)
    rc = inf.get((sid, lid)) or norm_r(rm.group(1) if rm else '')
    if rc not in FULL_TRAINER: continue
    if rc == 'UR' and serie in ('SM', 'S'): continue        # rainbow rares
    st = open(os.path.join(os.path.dirname(os.path.dirname(f)), sid + '.ts'), encoding='utf-8').read() if os.path.exists(os.path.join(os.path.dirname(os.path.dirname(f)), sid + '.ts')) else ''
    tot = re.search(r'official:\s*(\d+)', st); dt = re.search(r"releaseDate[^}]*?ja:\s*['\"](\d{4}-\d{2}-\d{2})", st, re.S)
    out.append({'k': k, 'src': 'jp', 'id': f'{sid}-{lid}', 'n': m.group(1), 'set': JP_SET_EN.get(sid) or CODE_NAMES.get(sid.lower()) or sid, 'no': lid, 'tot': int(tot.group(1)) if tot else None,
                'date': dt.group(1) if dt else '', 'rc': rc, 'img': f'https://assets.tcgdex.net/ja/{serie}/{sid}/{lid}/high.webp',
                'sm': f'https://assets.tcgdex.net/ja/{serie}/{sid}/{lid}/low.webp'})

# ---------- TCG Pocket ----------
for f in glob.glob(f'{SRC}/tcgdex/data/Pokémon TCG Pocket/*/*.ts'):
    setdir = os.path.dirname(f); lid = os.path.basename(f)[:-3]
    t = open(f, encoding='utf-8').read()
    rm = re.search(r'rarity:\s*["\']([^"\']+)', t)
    rc = POCKET_FULL.get(rm.group(1) if rm else '')
    if not rc: continue
    m = re.search(r"name:\s*\{[^}]*?\ben:\s*['\"]([^'\"]+)", t, re.S)
    if not m: continue
    name = m.group(1)
    if "trainerType: \"Supporter\"" in t or "trainerType: 'Supporter'" in t:
        k = who(name_en=name)
    else:
        dx = re.search(r'dexId:\s*\[([\d,\s]+)\]', t)
        dexes = [int(x) for x in dx.group(1).split(',') if x.strip()] if dx else []
        k = next((p[0] for p in POKE if p[1] in dexes or name.split(' ex')[0].replace('Mega ', '') == p[2]), None)
    if not k: continue
    st = open(setdir + '.ts', encoding='utf-8').read()
    sid = re.search(r"id:\s*['\"]([^'\"]+)", st).group(1)
    sname = re.search(r"name:\s*\{[^}]*?\ben:\s*['\"]([^'\"]+)", st, re.S).group(1)
    dt = re.search(r"releaseDate:\s*['\"](\d{4}-\d{2}-\d{2})", st) or re.search(r"releaseDate[^}]*?['\"](\d{4}-\d{2}-\d{2})", st, re.S)
    tot = re.search(r'official:\s*(\d+)', st)
    out.append({'k': k, 'src': 'pocket', 'id': f'{sid}-{lid}', 'n': name, 'set': 'TCG Pocket · ' + sname, 'no': lid, 'tot': int(tot.group(1)) if tot else None,
                'date': dt.group(1) if dt else '', 'rc': rc, 'img': f'https://assets.tcgdex.net/en/tcgp/{sid}/{lid}/high.webp',
                'sm': f'https://assets.tcgdex.net/en/tcgp/{sid}/{lid}/low.webp'})

NO_PHOTO = {'S8-122', 'SM4p-120', 'S6H-091', 'S6K-089', 'S6K-088', 'SM3N-061', 'SM9a-067', 'M2a-226'}
out = [c for c in out if c.get('img') and c['id'] not in NO_PHOTO]
# same card printed in Japan and internationally: keep only the international one.
# A Japanese card is a duplicate when an international card of the same character and rarity came out up to ~10 months later.
import datetime as _dt
def _d(x):
    try: return _dt.date.fromisoformat(x)
    except Exception: return None
ints = [c for c in out if c['src'] == 'int']
used = set(); drop = set()
for j in sorted([c for c in out if c['src'] == 'jp'], key=lambda c: c['date'] or ''):
    dj = _d(j['date'])
    best = None
    for i in ints:
        if i['id'] in used or i['k'] != j['k'] or i['rc'] != j['rc']: continue
        di = _d(i['date'])
        if not (dj and di): continue
        gap = (di - dj).days
        if -45 <= gap <= 300 and (best is None or abs(gap) < best[0]): best = (abs(gap), i)
    if best: used.add(best[1]['id']); drop.add(j['id'])
out = [c for c in out if not (c['src'] == 'jp' and c['id'] in drop)]
print('japanese duplicates dropped', len(drop))
order = {k: i for i, (k, *_ ) in enumerate(CHARS + [(p[0], p[2], '') for p in POKE])}
labels = {k: en for k, en, _ in CHARS} | {p[0]: p[2] for p in POKE}
out.sort(key=lambda c: (order[c['k']], c['date'] or '9999', c['src'], c['no']))
json.dump({'labels': labels, 'order': [k for k, *_ in CHARS] + [p[0] for p in POKE], 'cards': out},
          open('data/bubi.json', 'w'), ensure_ascii=False, separators=(',', ':'))
import collections
print('bubi cards', len(out), collections.Counter(c['src'] for c in out), collections.Counter(c['k'] for c in out).most_common(40))
