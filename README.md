# Gotta Catch 'em All

Raccoglitore digitale delle mie carte Pokémon: 1025 Pokémon divisi per generazione, più Megaevoluzioni e forme regionali, con le stesse pagine e tasche del raccoglitore fisico.

- Pokémon mancanti: sprite in scala di grigi. Pokémon presenti: a colori, o con l'immagine della carta scelta.
- Tocca un Pokémon: vedi il catalogo di tutte le sue carte (internazionali e giapponesi) con foto, rarità e prezzo Cardmarket; tocca una carta per aggiungerla. Puoi averne più di una e scegliere con ★ quella da mostrare come anteprima.
- Catalogo: `data/cards/NNNN.json`, generato da [pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data) e [TCGdex](https://github.com/tcgdex/cards-database). Prezzi live da pokemontcg.io e api.tcgdex.net.
- Sprite: [PMDCollab SpriteCollab](https://sprites.pmdcollab.org/).

## Pubblicazione (GitHub Pages)
1. Carica questi file nella radice del repository (branch `main`).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Il sito sarà su `https://<utente>.github.io/<repository>/`.

## Salvare le modifiche
Le modifiche restano subito nel browser. Per renderle permanenti e visibili ovunque: **Salva & sync → Salva su GitHub**, con un token *fine-grained* limitato a questo repository (permesso *Contents: Read and write*). Il sito aggiorna `data/collection.json`.

## Aggiornamenti automatici
Il workflow `.github/workflows/update.yml` ricostruisce il catalogo (`tools/build_cards.py`) e aggiorna i prezzi della collezione (`tools/update_prices.py`) il 1° e il 15 di ogni mese. Si può avviare a mano da GitHub → Actions → “Aggiorna catalogo e prezzi” → Run workflow, oppure dal sito con “Aggiorna ora”.

## File
- `data/pokedex.json` — elenco Pokémon, pagina/tasca, sprite (generato dal foglio Google)
- `data/collection.json` — le mie carte
- `data/sets.json` — espansioni per l'autocompletamento
- `data/collection.json` → `targets`: le carte target (lista desideri), segnate come prese quando la stessa carta entra nella collezione
