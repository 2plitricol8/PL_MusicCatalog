# Vinili — catalogo dei dischi in vinile (PWA)

App web installabile, senza server: tutti i dati restano sul telefono (IndexedDB).

## Pubblicazione
1. Carica l'intera cartella sul tuo hosting (anche in una sottocartella, es. `https://tuosito.it/vinili/`).
2. Serve **HTTPS** (fotocamera e installazione non funzionano senza).
3. Apri l'indirizzo dal telefono.
   - Android/Chrome: menu ⋮ → "Installa app".
   - iPhone/Safari: Condividi → "Aggiungi alla schermata Home".

## Aggiornare l'app
Dopo aver sostituito i file sul server, cambia `VERSION` in `sw.js` (es. `vinili-v2`):
al successivo avvio l'app scarica i file nuovi.

## Uso
- **Aggiungi disco**: scegli la categoria, inquadra il codice a barre sul retro della copertina
  (oppure "Foto del codice", oppure digita codice / n. catalogo / titolo). Scegli il risultato giusto,
  controlla i campi e salva. "Salva e aggiungi altro" riapre subito lo scanner.
- **Importa**: dal menu, un file Excel come il tuo `Libreria_Catalog.xlsx` oppure un backup JSON.
- **Esporta**: Excel (un foglio per categoria, stesso schema del tuo catalogo) o backup JSON con copertine.
- Fai ogni tanto un backup: i dati esistono solo su questo dispositivo.

## Fonti dati
MusicBrainz (ricerca per codice a barre, catalogo, titolo) e Cover Art Archive (copertine). Gratuiti, senza chiave.
Librerie incluse in `vendor/`: SheetJS (Excel) e ZXing (lettura codici a barre dove il browser non la offre).
