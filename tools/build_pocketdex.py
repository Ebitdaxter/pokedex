"""Pokédex Pocket: every TCG Pocket full art of a Pokémon (2★ rainbow full arts and 3★ immersive), from TCGdex.
Writes data/pocketdex.json as {dex: [cards…]}, best card first (immersive, then the newest)."""
import json, os, re, glob, collections
SRC = os.environ.get('SRC', '_src')
RAR = {'Two Star': '2★', 'Three Star': '3★'}
by = collections.defaultdict(list)
for f in glob.glob(f'{SRC}/tcgdex/data/Pokémon TCG Pocket/*/*.ts'):
    t = open(f, encoding='utf-8').read()
    r = re.search(r'rarity:\s*["\']([^"\']+)', t)
    rc = RAR.get(r.group(1) if r else '')
    if not rc or not re.search(r'category:\s*["\']Pokemon', t): continue
    dx = re.search(r'dexId:\s*\[([\d,\s]+)\]', t)
    if not dx: continue
    name = re.search(r"name:\s*\{[^}]*?\ben:\s*['\"]([^'\"]+)", t, re.S).group(1)
    setfile = os.path.dirname(f) + '.ts'; st = open(setfile, encoding='utf-8').read()
    sid = re.search(r"id:\s*['\"]([^'\"]+)", st).group(1)
    sname = re.search(r"name:\s*\{[^}]*?\ben:\s*['\"]([^'\"]+)", st, re.S).group(1)
    dt = re.search(r"releaseDate[^\n]*?['\"](\d{4}-\d{2}-\d{2})", st) or re.search(r"releaseDate[^}]*?['\"](\d{4}-\d{2}-\d{2})", st, re.S)
    lid = os.path.basename(f)[:-3]
    for d in [int(x) for x in dx.group(1).split(',') if x.strip()]:
        if 1 <= d <= 1025:
            by[d].append({'id': f'{sid}-{lid}', 'n': name, 'set': sname, 'no': lid, 'rc': rc, 'date': dt.group(1) if dt else '',
                          'img': f'https://assets.tcgdex.net/en/tcgp/{sid}/{lid}/high.webp', 'sm': f'https://assets.tcgdex.net/en/tcgp/{sid}/{lid}/low.webp'})
for d in by: by[d].sort(key=lambda c: (c['rc'] != '3★', c['date']), reverse=False)
for d in by:  # immersive first, then newest
    imm = [c for c in by[d] if c['rc'] == '3★']; rest = sorted([c for c in by[d] if c['rc'] != '3★'], key=lambda c: c['date'], reverse=True)
    by[d] = imm + rest
json.dump({str(k): v for k, v in sorted(by.items())}, open('data/pocketdex.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('pocket pokédex:', len(by), 'Pokémon,', sum(len(v) for v in by.values()), 'cards')
