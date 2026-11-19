"""Full arts only: for every Pokédex entry (national dex, Mega, regional forms) count the full-art cards that exist
(AR, SAR, SR, UR, MUR, MA, CHR, CSR, SSR, SEC) and their Cardmarket price range.
Writes data/artprices.json = {"updated": iso, "p": {cid: eur|null}} and data/artindex.json = {entryId: [n, min, max]}.
OFFLINE=1 skips the price download and reuses the prices already saved."""
import json, os, re, glob, time, datetime, urllib.request, urllib.parse, urllib.error, concurrent.futures

FA = {'AR', 'SAR', 'SR', 'UR', 'MUR', 'MA', 'CHR', 'CSR', 'SSR', 'SEC'}
ents = json.load(open('data/pokedex.json', encoding='utf-8'))
try: old = json.load(open('data/artprices.json', encoding='utf-8')).get('p', {})
except Exception: old = {}

MEGA = re.compile(r'^(M |Mega |メガ)'); REG = re.compile(r'Alolan|Galarian|Hisuian|Paldean|アローラ|ガラル|ヒスイ|パルデア')
RK = {'Alola': r'Alolan|アローラ', 'Galar': r'Galarian|ガラル', 'Hisui': r'Hisuian|ヒスイ', 'Paldea': r'Paldean|パルデア'}
def relevant(e, lst):   # same rule as relevant() in app.js
    if e['group'] == 'mega':
        suf = re.search(r' (X|Y|Z)$', e['name']); m = [c for c in lst if MEGA.search(c['n']) and (not suf or suf.group(1) in c['n'])]
        return m or [c for c in lst if MEGA.search(c['n'])] or lst
    if e['group'] == 'regional':
        return [c for c in lst if re.search(RK[e['region']], c['n'])] or lst
    return [c for c in lst if not MEGA.search(c['n']) and not REG.search(c['n'])] or lst

cards, per = {}, {}
for e in ents:
    f = f"data/cards/{e['dex']:04d}.json"
    if not os.path.exists(f): per[e['id']] = []; continue
    lst = json.load(open(f, encoding='utf-8'))
    arts = [c for c in relevant(e, lst) if c['rc'] in FA]
    per[e['id']] = [c['src'] + ':' + c['id'] for c in arts]
    for c in arts: cards[c['src'] + ':' + c['id']] = c

def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'gotta-catch-em-all-pokedex'}), timeout=40) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
        except Exception: pass
        time.sleep(2 + attempt * 3)
    raise RuntimeError(url)
cm = lambda p: (p or {}).get('trend') or (p or {}).get('avg') or (p or {}).get('avg30') or None
def price(cid):
    c = cards[cid]
    if c['src'] == 'jp' or c.get('tdx'):
        lang, tid = ('ja', c['id']) if c['src'] == 'jp' else ('en', c['tdx'])
        j = get(f'https://api.tcgdex.net/v2/{lang}/cards/{urllib.parse.quote(tid)}')
        if not j: return None
        p = cm((j.get('pricing') or {}).get('cardmarket'))
        for v in j.get('variants_detailed') or []:
            p = p or cm((v.get('pricing') or {}).get('cardmarket'))
        return p
    j = get(f'https://api.pokemontcg.io/v2/cards/{urllib.parse.quote(c["id"])}')
    pr = ((j or {}).get('data') or {}).get('cardmarket', {}).get('prices') or {}
    return pr.get('trendPrice') or pr.get('averageSellPrice') or None

prices = {k: old.get(k) for k in cards}
if not os.environ.get('OFFLINE'):
    ok = 0
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        for cid, fut in [(k, ex.submit(price, k)) for k in cards]:
            try: p = fut.result(); prices[cid] = round(p, 2) if p else None; ok += 1
            except Exception: pass   # keep the last known price
    print('prices fetched', ok, 'of', len(cards))
json.dump({'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'p': prices},
          open('data/artprices.json', 'w'), ensure_ascii=False, separators=(',', ':'))
idx = {}
for eid, l in per.items():
    ps = [prices[k] for k in l if prices.get(k)]
    idx[eid] = [len(l), min(ps) if ps else None, max(ps) if ps else None]
json.dump(idx, open('data/artindex.json', 'w'), separators=(',', ':'))
print('full arts:', len(cards), 'cards for', sum(1 for v in idx.values() if v[0]), 'of', len(idx), 'entries;', sum(1 for v in prices.values() if v), 'with a price')
