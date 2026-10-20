"""Refresh Cardmarket prices (EUR trend) for every card in data/collection.json.
Japanese cards -> TCGdex (ja), international cards -> TCGdex (en) when mapped, else pokemontcg.io."""
import json, os, time, urllib.request, urllib.parse, concurrent.futures, datetime

COL = 'data/collection.json'
col = json.load(open(COL, encoding='utf-8'))
ents = {e['id']: e for e in json.load(open('data/pokedex.json', encoding='utf-8'))}
catalog = {}
def cat(dex):
    if dex not in catalog:
        catalog[dex] = {x['src'] + ':' + x['id']: x for x in json.load(open(f'data/cards/{dex:04d}.json', encoding='utf-8'))}
    return catalog[dex]

def get(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'gotta-catch-em-all-pokedex'})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
        except Exception: pass
        time.sleep(2 + attempt * 3)
    raise RuntimeError(url)

def cm(p):
    return (p or {}).get('trend') or (p or {}).get('avg') or (p or {}).get('avg30') or None

def price(x):
    src, cid = x['cid'].split(':', 1)
    if src == 'jp' or x.get('tdx'):
        lang, tid = ('ja', cid) if src == 'jp' else ('en', x['tdx'])
        j = get(f'https://api.tcgdex.net/v2/{lang}/cards/{urllib.parse.quote(tid)}')
        if not j: return None
        p = cm((j.get('pricing') or {}).get('cardmarket'))
        if p is None:
            for v in j.get('variants_detailed') or []:
                p = cm(((v.get('pricing') or {}).get('cardmarket'))) or p
        return p
    j = get(f'https://api.pokemontcg.io/v2/cards/{urllib.parse.quote(cid)}')
    pr = ((j or {}).get('data') or {}).get('cardmarket', {}).get('prices') or {}
    return pr.get('trendPrice') or pr.get('averageSellPrice') or None

todo = []
for eid, entry in col['cards'].items():
    for x in entry.get('list', []):
        if not x.get('cid'): continue
        c = cat(ents[eid]['dex']).get(x['cid'])
        if c and c.get('tdx'): x['tdx'] = c['tdx']
        todo.append(x)

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
ok = fail = 0
def safe(x):
    try: return x, price(x), None
    except Exception as e: return x, None, e
with concurrent.futures.ThreadPoolExecutor(6) as ex:
    for x, p, err in ex.map(safe, todo):
        if err: fail += 1; continue
        ok += 1
        if p is not None: x['price'] = round(float(p), 2); x['priceAt'] = now
col['pricesUpdated'] = now
json.dump(col, open(COL, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'prices: {ok} checked, {fail} failed')
