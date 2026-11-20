"""Fill the photos TCGdex does not have yet (recent Japanese sets) from Limitless TCG card pages.
Runs after build_cards.py: patches the full-art cards in data/cards/*.json that have no image and keeps every hit
in data/extraimg.json ({cid: url}) so a card is looked up only once. Owned cards get the same photo in the app."""
import json, os, re, glob, time, urllib.request, urllib.error, concurrent.futures

FA = {'AR', 'SAR', 'MUR', 'MA', 'CHR', 'CSR', 'SSR', 'SEC'}
try: found = json.load(open('data/extraimg.json', encoding='utf-8'))
except Exception: found = {}
try: misses = json.load(open('data/extraimg_miss.json', encoding='utf-8'))
except Exception: misses = {}
today = time.strftime('%Y-%m-%d')

need = set()
files = {}
for f in glob.glob('data/cards/*.json'):
    lst = json.load(open(f, encoding='utf-8')); files[f] = lst
    for c in lst:
        if c['rc'] in FA and not c.get('img'): need.add(c['src'] + ':' + c['id'])
col = json.load(open('data/collection.json', encoding='utf-8'))
for v in col['cards'].values():
    for x in v['list']:
        if not x.get('img') and (x.get('cid') or '').startswith('jp:'): need.add(x['cid'])
# retry a miss once a week: Limitless adds photos a few days after release
todo = [k for k in need if k.startswith('jp:') and k not in found and misses.get(k, '0') < time.strftime('%Y-%m-%d', time.gmtime(time.time() - 7 * 86400))]
print('cards without photo:', len(need), '· to look up:', len(todo))

IMG = re.compile(r'https://limitlesstcg[^"\'\s]+?/tpc/[^"\'\s]+?\.(?:png|jpg|webp)')
def page(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 gotta-catch-em-all-pokedex'}), timeout=30) as r:
            return r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError: return ''
    except Exception: time.sleep(2); return ''
def look(cid):
    sid, no = cid[3:].rsplit('-', 1)
    variants = dict.fromkeys([sid, sid.upper(), sid[:-1] + sid[-1].lower() if sid[-1].isalpha() else sid, sid.lower()])
    for s in variants:
        for n in dict.fromkeys([no.lstrip('0') or '0', no]):
            h = page(f'https://limitlesstcg.com/cards/jp/{s}/{n}')
            m = IMG.findall(h)
            if m:
                big = [u for u in m if '_LG' in u] or m
                return big[0]
    return None

with concurrent.futures.ThreadPoolExecutor(4) as ex:
    for cid, url in zip(todo, ex.map(look, todo)):
        if url: found[cid] = url; misses.pop(cid, None)
        else: misses[cid] = today
print('photos found:', sum(1 for k in todo if k in found), 'of', len(todo), '· total kept:', len(found))

for f, lst in files.items():
    ch = False
    for c in lst:
        u = found.get(c['src'] + ':' + c['id'])
        if u and not c.get('img'): c['img'] = c['sm'] = u; ch = True
    if ch: json.dump(lst, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(found, open('data/extraimg.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(misses, open('data/extraimg_miss.json', 'w', encoding='utf-8'), indent=0)
