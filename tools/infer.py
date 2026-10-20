import glob, re, os, collections, json
EXRE = re.compile(r'(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK)$')
def load_sets():
    rows = collections.defaultdict(list); off = {}
    for f in glob.glob(os.environ.get('SRC', '_src') + '/tcgdex/data-asia/*/*.ts'):
        sid = os.path.basename(f)[:-3]; t = open(f, encoding='utf-8').read()
        m = re.search(r'official:\s*(\d+)', t); off[sid] = int(m.group(1)) if m else None
    for f in glob.glob(os.environ.get('SRC', '_src') + '/tcgdex/data-asia/*/*/*.ts'):
        parts = f.split('/'); serie, sid, lid = parts[-3], parts[-2], parts[-1][:-3]
        t = open(f, encoding='utf-8').read()
        rm = re.search(r'rarity:\s*["\']([^"\']+)', t); r = rm.group(1) if rm else ''
        nm = re.search(r"name:\s*\{[^}]*?\bja:\s*['\"]([^'\"]+)", t, re.S)
        cat = re.search(r'category:\s*["\'](\w+)', t)
        tt = re.search(r'trainerType:\s*["\'](\w+)', t)
        et = re.search(r'energyType:\s*["\'](\w+)', t)
        rows[sid].append({'lid': lid, 'r': '' if r == 'None' else r, 'n': nm.group(1) if nm else '', 'cat': cat.group(1) if cat else '',
                          'tt': tt.group(1) if tt else '', 'serie': serie})
    return rows, off

SHINY = {'SV4a', 'S4a', 'SM8b'}
def infer(rows, off):
    """Return {(sid,lid): rc} for secret-range cards of modern sets without rarity."""
    out = {}
    for sid, l in rows.items():
        o = off.get(sid)
        if not o or not re.match(r'^(SV|SM|S|M)\d+(\.5)?[abABKMPDSVLHNRIWp]?$', sid) or sid.endswith('s'): continue
        sec = sorted([c for c in l if c['lid'].isdigit() and int(c['lid']) > o], key=lambda c: int(c['lid']))
        if not sec: continue
        mega = l[0]['serie'] == 'M'
        phases = ['AR', 'SR', 'SAR', 'MUR' if mega else 'UR']
        if sid in SHINY: phases = ['S', 'SSR', 'SAR', 'UR']
        ph = 0; seen = collections.Counter(); prev_cat = None
        for c in sec:
            n = c['n']; isex = bool(EXRE.search(n)) or n.startswith('メガ')
            pok = c['cat'] == 'Pokemon'
            if ph == 0 and (not pok or isex): ph = 1
            if ph >= 1 and seen[n] >= ph and ph < 3: ph = seen[n] + 1 if seen[n] + 1 <= 3 else 3
            if ph == 2 and c['cat'] == 'Energy': ph = 3
            if ph == 2 and c['cat'] == 'Trainer' and c['tt'] in ('Item', 'Tool', 'Stadium') and seen[n] == 0 and prev_cat == 'Pokemon': pass
            seen[n] += 1; prev_cat = c['cat']
            rc = phases[ph]
            if mega and ph == 3 and not n.startswith('メガ') : rc = 'UR'
            if not c['r']: out[(sid, c['lid'])] = rc
            elif sid == 'M2a' and c['r'] == 'Ultra Rare' and n.startswith('メガ'): out[(sid, c['lid'])] = 'MA'
    return out
