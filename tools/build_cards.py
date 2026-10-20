import json, re, os, glob, csv, collections, sys, datetime
SRC = os.environ.get('SRC', '_src')
OUT = 'data/cards'; os.makedirs(OUT, exist_ok=True)
ents = json.load(open('data/pokedex.json'))
maxdex = 1025

def norm_r(r):
    r = (r or '').strip(); l = r.lower()
    M = [('special illustration', 'SAR'), ('illustration rare', 'AR'), ('mega hyper', 'MUR'), ('mega attack', 'MA'), ('hyper rare', 'UR'),
         ('secret', 'UR'), ('rainbow', 'UR'), ('character super', 'CSR'), ('character rare', 'CHR'), ('trainer gallery', 'CHR'),
         ('shiny ultra', 'SSR'), ('shiny rare', 'S'), ('shiny', 'S'), ('triple rare', 'RRR'), ('double rare', 'RR'), ('ace spec', 'ACE'), ('radiant', 'K'),
         ('ultra rare', 'SR'), ('rare ultra', 'SR'), ('rare holo v', 'RR'), ('rare holo ex', 'RR'), ('rare holo gx', 'RR'), ('rare holo lv', 'RR'),
         ('rare break', 'RR'), ('rare prime', 'RR'), ('legend', 'RR'), ('amazing', 'AMZ'), ('promo', 'PR'), ('classic collection', 'CC'),
         ('holo rare', 'Rare'), ('rare holo', 'Rare'), ('uncommon', 'Uncommon'), ('common', 'Common'), ('rare', 'Rare')]
    for k, v in M:
        if k in l: return v
    return ''

# ---------- International (pokemontcg data) ----------
sets = {s['id']: s for s in json.load(open(SRC + '/ptcg/sets/en.json'))}
by = collections.defaultdict(list)
for f in glob.glob(SRC + '/ptcg/cards/en/*.json'):
    sid = os.path.basename(f)[:-5]; s = sets.get(sid)
    if not s: continue
    for c in json.load(open(f)):
        for d in c.get('nationalPokedexNumbers') or []:
            if 1 <= d <= maxdex:
                by[d].append({'src': 'int', 'id': c['id'], 'n': c['name'], 'set': s['name'], 'sid': sid, 'no': c['number'],
                              'tot': s.get('printedTotal'), 'date': s['releaseDate'][:10].replace('/', '-'), 'r': c.get('rarity') or '',
                              'rc': norm_r(c.get('rarity')), 'img': c['images']['large'], 'sm': c['images']['small']})
# map international cards to TCGdex ids (for Cardmarket prices)
tsets = {}
for f in glob.glob(SRC + '/tcgdex/data/*/*.ts'):
    t = open(f, encoding='utf-8').read()
    i = re.search(r"id:\s*['\"]([^'\"]+)", t); nm = re.search(r"name:\s*\{[^}]*?\ben:\s*['\"]([^'\"]+)", t, re.S)
    if i and nm: tsets[nm.group(1).lower()] = (i.group(1), f[:-3])
ALIAS_T = {'base': 'base set', 'scarlet & violet black star promos': 'svp black star promos', "champion's path": "champion's path"}
tfiles = {}
def tdx_id(setname, number):
    k = setname.lower(); k = ALIAS_T.get(k, k)
    if k not in tsets: return None
    sid, folder = tsets[k]
    if folder not in tfiles:
        tfiles[folder] = {os.path.basename(x)[:-3].lstrip('0').lower() or '0': os.path.basename(x)[:-3] for x in glob.glob(glob.escape(folder) + '/*.ts')}
    lid = tfiles[folder].get(number.lstrip('0').lower() or '0')
    return f'{sid}-{lid}' if lid else None
nt = 0
for lst in by.values():
    for c in lst:
        t = tdx_id(c['set'], c['no'])
        if t: c['tdx'] = t; nt += 1
print('int cards mapped to tcgdex', nt, 'of', sum(len(v) for v in by.values()))
# ---------- Japanese (tcgdex data-asia) ----------
ja2dex = {}
for row in csv.DictReader(open(SRC + '/species_names.csv', encoding='utf-8')):
    if row['local_language_id'] == '1' and int(row['pokemon_species_id']) <= maxdex:
        ja2dex[row['name']] = int(row['pokemon_species_id'])
jnames = sorted(ja2dex, key=len, reverse=True)
def ja_dex(name):
    # strip trainer owner prefix "Xの" and suffixes like ex/V/GX
    base = re.sub(r'^.*?の', '', name) if 'の' in name else name
    for cand in (base, name):
        for jn in jnames:
            if jn in cand: return ja2dex[jn]
    return None
code_names = json.load(open(os.path.join(os.path.dirname(__file__), 'code_names.json'), encoding='utf-8'))
def grab(txt, key):
    m = re.search(key + r':\s*\{([^}]*)\}', txt, re.S)
    if not m: return None
    j = re.search(r"\bja:\s*['\"]([^'\"]+)['\"]", m.group(1))
    return j.group(1) if j else None
EN_NAMES = dict(x.split('=') for x in """SV1S=Scarlet ex|SV1V=Violet ex|SV1a=Triplet Beat|SV2P=Snow Hazard|SV2D=Clay Burst|SV2a=Pokémon Card 151|SV3=Ruler of the Black Flame|SV3a=Raging Surf|SV4K=Ancient Roar|SV4M=Future Flash|SV4a=Shiny Treasure ex|SV5K=Wild Force|SV5M=Cyber Judge|SV5a=Crimson Haze|SV6=Mask of Change|SV6a=Night Wanderer|SV7=Stellar Miracle|SV7a=Paradise Dragona|SV8=Super Electric Breaker|SV8a=Terastal Festival ex|SV9=Battle Partners|SV9a=Heat Wave Arena|SV10=Glory of Team Rocket|SV11B=Black Bolt|SV11W=White Flare|SV-P=Promo SV|M1L=Mega Brave|M1S=Mega Symphonia|M2=Inferno X|M2a=Mega Dream ex|M3=Nihil Zero|M-P=Promo MEGA|S12a=VSTAR Universe|S12=Paradigm Trigger|S11a=Incandescent Arcana|S11=Lost Abyss|S10a=Dark Phantasma|S10P=Space Juggler|S10D=Time Gazer|S10b=Pokémon GO|S9a=Battle Region|S9=Star Birth|S8b=VMAX Climax|S8a=25th Anniversary Collection|S8=Fusion Arts|S7R=Blue Sky Stream|S7D=Skyscraping Perfection|S6a=Eevee Heroes|S6H=Silver Lance|S6K=Jet-Black Spirit|S5a=Matchless Fighters|S5I=Single Strike Master|S5R=Rapid Strike Master|S4a=Shiny Star V|S4=Amazing Volt Tackle|S3a=Legendary Heartbeat|S3=Infinity Zone|S2a=Explosive Walker|S2=Rebellion Crash|S1a=VMAX Rising|S1W=Sword|S1H=Shield|S-P=Promo S|SM12a=Tag All Stars|SM12=Alter Genesis|SM11b=Dream League|SM11a=Remix Bout|SM11=Miracle Twin|SM10b=Sky Legend|SM10a=GG End|SM10=Double Blaze|SM9b=Full Metal Wall|SM9a=Night Unison|SM9=Tag Bolt|SM8b=GX Ultra Shiny|SM8a=Dark Order|SM8=Super-Burst Impact|SM7b=Fairy Rise|SM7a=Thunderclap Spark|SM7=Sky-Splitting Charisma|SM6b=Champion Road|SM6a=Dragon Storm|SM6=Forbidden Light|SM5p=Ultra Force|SM5M=Ultra Moon|SM5S=Ultra Sun|SM4p=GX Battle Boost|SM4A=Ultradimensional Beasts|SM4S=Awakened Heroes|SM3p=Shining Legends|SM3H=To Have Seen the Battle Rainbow|SM3N=Darkness that Consumes Light|SM2p=Facing a New Trial|SM2K=Islands Await You|SM2L=Alolan Moonlight|SM1S=Collection Sun|SM1M=Collection Moon|SM1p=Sun & Moon Starter|CP6=20th Anniversary|PMCG1=Base Expansion Pack|PMCG2=Pokémon Jungle|PMCG3=Mystery of the Fossils|PMCG4=Rocket Gang|PMCG5=Leaders' Stadium|PMCG6=Challenge from the Darkness|neo1=Gold, Silver, to a New World|neo2=Crossing the Ruins|neo3=Awakening Legends|neo4=Darkness, and to Light|E1=Base Expansion Pack (e)|E2=The Town on No Map|E3=Wind from the Sea|E4=Split Earth|E5=Mysterious Mountains|VS1=Pokémon Card VS|web1=Pokémon Card web|MC=Start Deck 100 Battle Collection|SVK=Deck Build Box Stellar Miracle""".split('|'))
setinfo = {}
for f in glob.glob(SRC + '/tcgdex/data-asia/*/*.ts'):
    serie, sid = f.split('/')[-2], os.path.basename(f)[:-3]
    t = open(f, encoding='utf-8').read()
    off = re.search(r'official:\s*(\d+)', t)
    setinfo[sid] = {'serie': serie, 'ja': grab(t, 'name') or sid, 'tot': int(off.group(1)) if off else None,
                    'date': (re.search(r"ja:\s*['\"](\d{4}-\d{2}-\d{2})", t.split('releaseDate')[1]).group(1) if 'releaseDate' in t and re.search(r"ja:\s*['\"](\d{4}-\d{2}-\d{2})", t.split('releaseDate')[1]) else '')}
sys.path.insert(0, os.path.dirname(__file__)); from infer import load_sets, infer
_r, _o = load_sets(); INFER = infer(_r, _o)
JP_DATES = dict(x.split('=') for x in """PMCG1=1996-10-20|PMCG2=1997-03-05|PMCG3=1997-06-21|PMCG4=1997-11-21|PMCG5=1998-10-24|PMCG6=1999-06-25|neo1=2000-01-21|neo2=2000-07-07|neo3=2001-03-24|neo4=2001-07-01|web1=2000-10-01|VS1=2001-07-01|E1=2001-12-01|E2=2002-03-01|E3=2002-05-01|E4=2002-06-01|E5=2002-10-01|PCG1=2004-01-30|PCG2=2004-05-01|PCG3=2004-11-01|PCG4=2005-02-01|PCG5=2005-06-01|PCG6=2005-11-01|PCG7=2006-03-01|PCG8=2006-06-01|PCG9=2006-09-01|BW8a=2012-11-01|CP1=2015-06-01|CP2=2015-09-01|SM1S=2016-12-09|SM1M=2016-12-09|SM2K=2017-03-03|SM2L=2017-03-03|SM3H=2017-05-26|SM3N=2017-05-26|SM4A=2017-08-04|SM4S=2017-08-04|SM5M=2017-11-17|SM5S=2017-11-17|SM6=2018-03-02|SM6a=2018-04-20|SM6b=2018-05-18|SM7=2018-06-01|SM7a=2018-07-06|SM7b=2018-08-03|SM8=2018-09-07|SM8a=2018-10-05|SM8b=2018-11-02|SM9=2019-02-01|SM9a=2019-03-01|SM9b=2019-04-05|SM10=2019-05-31|SM10a=2019-07-05|SM10b=2019-08-02|SM11=2019-08-02|SM11a=2019-09-06|SM11b=2019-10-04|SM12=2019-10-04|SM12a=2019-11-01|S-P=2019-12-06|SK=2021-01-01|SLD=2021-01-01|SLL=2021-01-01|SN=2021-01-01|SP6=2021-01-01|SPD=2021-01-01|SPZ=2021-01-01""".split('|'))
nodex = 0; jcount = 0
for f in glob.glob(SRC + '/tcgdex/data-asia/*/*/*.ts'):
    parts = f.split('/'); serie, sid, lid = parts[-3], parts[-2], parts[-1][:-3]
    t = open(f, encoding='utf-8').read()
    if 'category: "Pokemon"' not in t and "category: 'Pokemon'" not in t: continue
    name = grab(t, 'name')
    if not name: continue
    m = re.search(r'dexId:\s*\[([\d,\s]+)\]', t)
    dexes = [int(x) for x in m.group(1).split(',') if x.strip()] if m else []
    if not dexes:
        d = ja_dex(name)
        if d: dexes = [d]
        else: nodex += 1; continue
    rm = re.search(r'rarity:\s*["\']([^"\']+)', t); r = rm.group(1) if rm else ''
    si = setinfo.get(sid, {})
    for d in dexes:
        if 1 <= d <= maxdex:
            jcount += 1
            rc = INFER.get((sid, lid)) or norm_r(r)
            if not rc and si.get('tot') and lid.isdigit() and int(lid) > si['tot']: rc = 'SEC'
            by[d].append({'src': 'jp', 'id': f'{sid}-{lid}', 'n': name, 'set': EN_NAMES.get(sid) or code_names.get(sid.lower()) or si.get('ja', sid), 'setJa': si.get('ja'),
                          'sid': sid, 'no': lid, 'tot': si.get('tot'), 'date': si.get('date') or JP_DATES.get(sid, ''), 'r': r if r != 'None' else '',
                          'rc': rc, 'img': f'https://assets.tcgdex.net/ja/{serie}/{sid}/{lid}/high.webp',
                          'sm': f'https://assets.tcgdex.net/ja/{serie}/{sid}/{lid}/low.webp'})
NOIMG = set("M1L SM3p M2 web1 PMCG4 PCG6 M3 PCG7 SM10a PCG1 BW8a PCG2 PCG4 PMCG2 PCG8 neo3 SM2K WCS23 CP1 M-P SV-P PMCG1 M2a S-P PMCG5 MC PMCG6 SM5p PCG3 M5 E3 M6a SM1p neo4 M6 PCG9 VS1 neo2 E4 E2 SM2p MF E1 SM4p neo1 PCG5 E5 CP2 PMCG3 SV11W SV11B".split()) | {"Miscellaneous Promos"}
EQUIV = {'M1L': ['me1'], 'M1S': ['me1'], 'M2': ['me2'], 'M2a': ['me2pt5'], 'M3': ['me3'], 'M4': ['me4'], 'M5': ['me5'],
         'SV11B': ['zsv10pt5'], 'SV11W': ['rsv10pt5'], 'PMCG1': ['base1'], 'PMCG2': ['base2'], 'PMCG3': ['base3'], 'PMCG4': ['base5'],
         'PMCG5': ['gym1'], 'PMCG6': ['gym2'], 'neo1': ['neo1'], 'neo2': ['neo2'], 'neo3': ['neo3'], 'neo4': ['neo4'],
         'E1': ['ecard1'], 'E2': ['ecard2'], 'E3': ['ecard3'], 'SV-P': ['svp'], 'S-P': ['swshp']}
alt = 0
for d, lst in by.items():
    ints = [x for x in lst if x['src'] == 'int']
    for c in lst:
        if c['src'] != 'jp' or c['sid'] not in NOIMG: continue
        c['img'] = c['sm'] = None
        pool = [x for x in ints if x['sid'] in EQUIV.get(c['sid'], [])]
        if not pool: continue
        mega = c['n'].startswith('メガ')
        pool = [x for x in pool if x['n'].startswith('Mega') == mega] or pool
        hit = None
        if c['sid'] in ('SV11B', 'SV11W'): hit = next((x for x in pool if x['no'].lstrip('0') == c['no'].lstrip('0')), None)
        if not hit and c['rc']: hit = next((x for x in pool if x['rc'] == c['rc']), None)
        if hit: c['img'], c['sm'], c['alt'] = hit['img'], hit['sm'], 1; alt += 1
print('jp without own image -> borrowed', alt)
tot = 0
for d in range(1, maxdex + 1):
    lst = sorted(by.get(d, []), key=lambda x: x['date'] or '0', reverse=True)
    tot += len(lst)
    json.dump(lst, open(f'{OUT}/{d:04d}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('cards', tot, 'jp', jcount, 'jp unmatched', nodex)
print('jp sets', len(setinfo), 'named from sheet', sum(1 for k in setinfo if k.lower() in code_names))

json.dump({'catalogUpdated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'cards': tot}, open('data/meta.json', 'w'))
