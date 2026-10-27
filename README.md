# LibreriaMusicalePL: catalogo di LP e CD (PWA)

LibreriaMusicalePL by PL & IA. App web installabile, senza server: tutti i dati restano sul dispositivo (IndexedDB).

## Formati e indici
- **LP**: indici LP0001, LP0002… (vinili)
- **CD**: indici CD0001, CD0002… (compact disc)
- Il selettore LP / CD in alto separa le due liste. Categorie in entrambe: Classica, Lirica, Pop/Rock, Altro.
- Il formato di un disco lo decide il prefisso dell'indice: cambiando "LP0005" in "CD0005" il disco passa all'altra lista.

## Pubblicazione
1. Carica l'intera cartella nel repository (comprese `vendor`, `icons` e `version.js`).
2. Serve **HTTPS** (GitHub Pages lo fornisce): fotocamera e installazione non funzionano senza.
3. Apri l'indirizzo dal telefono.
   - Android/Chrome: menu ⋮ → "Installa app".
   - iPhone/Safari: Condividi → "Aggiungi alla schermata Home".

## Versione e aggiornamenti
Il numero di versione sta **solo** in `version.js` (`self.APP_VERSION`). Si vede nella testata, nel menu e a fondo pagina.
Dopo aver sostituito i file sul server, cambia quel numero: al secondo avvio l'app si aggiorna da sola.

## Se dopo un aggiornamento l'app non cambia
Il telefono può tenere una copia vecchia dei file. Dalla versione 1.0.1 l'app scarica sempre i file nuovi quando c'è rete.
- Controlla che nell'intestazione compaia il numero di versione atteso (v1.0.1).
- Chiudi e riapri l'app due o tre volte, oppure usa Menu → "Forza aggiornamento dell'app".
- Se l'app non parte, dopo qualche secondo compare l'avviso "Aggiorna l'app".
- Questi comandi non cancellano i dischi. Non eliminare l'icona dalla schermata Home e non cancellare i dati del sito: i dischi sono lì.
- Verifica sul sito: l'indirizzo `.../version.js` deve mostrare la versione nuova; se dà errore 404, manca un file nel repository.

## Uso
- **Aggiungi LP / Aggiungi CD**: scegli formato e categoria, inquadra il codice a barre sul retro della copertina
  (oppure "Foto del codice", oppure digita codice / n. catalogo / titolo). Scegli il risultato giusto,
  controlla i campi e salva. "Salva e aggiungi altro" riapre subito lo scanner. L'indice successivo è assegnato per formato.
- **Importa**: dal menu, un file Excel (anche quello originale `Libreria_Catalog.xlsx`) oppure un backup JSON.
  Gli indici LP e CD vengono riconosciuti dal prefisso.
- **Esporta**: Excel con un foglio per formato e categoria ("LP Classica", "CD Pop-Rock"…), oppure backup JSON con le copertine.
- Fai ogni tanto un backup: i dati esistono solo su questo dispositivo.
- Non caricare nel repository i file di catalogo o di backup: contengono la tua collezione.

## Fonti dati
MusicBrainz (ricerca per codice a barre, catalogo, titolo) e Cover Art Archive (copertine). Gratuiti, senza chiave.
Librerie incluse in `vendor/`: SheetJS (Excel) e ZXing (lettura codici a barre dove il browser non la offre).
