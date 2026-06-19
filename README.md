# NFC Cards — Generatore biglietti da visita per dipendenti

Genera pagine statiche personali (`/cognome/`) con vCard scaricabile, a partire da un unico file `data/employees.json`. Ogni pagina è raggiungibile tramite un tag NFC scritto con l'URL personale.

## Struttura

```
.
├── data/
│   ├── brand.json          # Configurazione brand (nome, sito, colore)
│   └── employees.json      # Elenco dei dipendenti
├── templates/
│   ├── index.html          # Template pagina con placeholder {{...}}
│   └── card.vcf            # Template vCard con placeholder {{...}}
├── public/
│   └── photos/             # (opzionale) foto profilo: <slug>.jpg
├── build.js                # Generatore statico
├── package.json
└── .github/workflows/deploy.yml   # CI/CD verso GitHub Pages
```

## Quick start

1. **Modifica `data/brand.json`** con nome, sito e colore di accento aziendale
2. **Compila `data/employees.json`** con i dipendenti. Campo `slug` opzionale (default: nome-cognome senza accenti)
3. **(opzionale) Aggiungi foto** in `public/photos/<slug>.jpg` (JPEG, idealmente quadrate, max 50KB per la vCard)
4. **Push su `main`**: la GitHub Action compila e pubblica su Pages automaticamente
5. **Attiva Pages** in Settings → Pages → Source: **GitHub Actions**

## Aggiungere un dipendente

Apri `data/employees.json`, aggiungi un oggetto:

```json
{
  "slug": "n.cognome",
  "name": "Nome Cognome",
  "role": "Ruolo",
  "phone": "+393331234567",
  "email": "n.cognome@azienda.it",
  "site": "https://www.azienda.it",
  "linkedin": "https://linkedin.com/in/nomecognome"
}
```

Commit, push. Dopo ~1 minuto la pagina è online a `https://<org>.github.io/<repo>/n.cognome/`.

### Campi supportati per dipendente

| Campo | Tipo | Note |
|---|---|---|
| `slug` | string | Path nell'URL. Default: derivato dal nome |
| `name` | string | **Obbligatorio**. Nome completo |
| `role` | string | Ruolo / job title |
| `org` | string | Override del nome azienda (default: brand.defaultOrg) |
| `phone` | string | E.164 senza spazi, es. `+393331234567` |
| `email` | string | Email professionale |
| `site` | string | URL sito |
| `linkedin` | string | URL profilo |
| `instagram` | string | URL profilo |
| `monogram` | string | Iniziali nel medaglione (default: derivato dal nome) |
| `address` | object | `{street, city, zip, country}` per la vCard |

## Test in locale

```bash
node build.js          # genera dist/
npm run serve          # server http su :8080
```

## Scrittura tag NFC

Ogni dipendente riceve il proprio tag NFC scritto con l'URL personale:

```
https://<org>.github.io/<repo>/<slug>/
```

App consigliata: NFC Tools (Android) → Write → Add URL/URI record → incolla l'URL → scrivi sul tag. Lo slash finale è importante.

## Note privacy

- `robots.txt` blocca l'indicizzazione dei motori di ricerca
- La pagina root reindirizza al sito aziendale, non espone l'elenco dipendenti
- Gli URL sono enumerabili se gli slug seguono un pattern prevedibile (es. `n.cognome`). Se vuoi rendere l'enumerazione più difficile, aggiungi un suffisso casuale agli slug nel JSON (es. `m.rossi-a3f9`)
