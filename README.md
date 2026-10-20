# Gotta Catch 'em All

Raccoglitore digitale delle mie carte Pokémon: 1025 Pokémon divisi per generazione, più Megaevoluzioni e forme regionali, con le stesse pagine e tasche del raccoglitore fisico.

- Pokémon mancanti: sprite in scala di grigi. Pokémon presenti: a colori, o con l'immagine della carta scelta.
- Tocca un Pokémon per registrare/modificare la carta e sceglierla dal catalogo (pokemontcg.io), oppure incollare un'immagine da TCGCollector.
- Sprite: [PMDCollab SpriteCollab](https://sprites.pmdcollab.org/).

## Pubblicazione (GitHub Pages)
1. Carica questi file nella radice del repository (branch `main`).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Il sito sarà su `https://<utente>.github.io/<repository>/`.

## Salvare le modifiche
Le modifiche restano subito nel browser. Per renderle permanenti e visibili ovunque: **Salva & sync → Salva su GitHub**, con un token *fine-grained* limitato a questo repository (permesso *Contents: Read and write*). Il sito aggiorna `data/collection.json`.

## File
- `data/pokedex.json` — elenco Pokémon, pagina/tasca, sprite (generato dal foglio Google)
- `data/collection.json` — le mie carte
- `data/sets.json` — espansioni per l'autocompletamento
