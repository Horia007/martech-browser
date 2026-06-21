# Media Browser

Aplicație Next.js pentru căutarea fișierelor media în limbaj natural, pe baza tag-urilor generate anterior. Utilizatorii pot filtra după mood, culori, orientare, tip (imagine/video), nume de fișier, apoi selecta și exporta rezultatele (ZIP + CSV).

## Cerințe

- Node.js 20+
- npm

## Pornire locală

```bash
npm install
cp .env.example .env.local   # completează ANTHROPIC_API_KEY
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000).

## Variabile de mediu

| Variabilă | Obligatoriu | Descriere |
|-----------|-----------|-----------|
| `ANTHROPIC_API_KEY` | Da | Cheie API Anthropic pentru interpretarea cererilor în filtre structurate |

Vezi `.env.example`.

## Date și media

- **Tag-uri:** `data/tags.json` — metadata per fișier (subjects, mood, culori, etc.)
- **Fișiere media:** `public/media/` — imagini și video servite la `/media/{filename}`

## Scripturi

| Comandă | Descriere |
|---------|-----------|
| `npm run dev` | Server de dezvoltare |
| `npm run build` | Build de producție |
| `npm run start` | Pornește build-ul de producție |
| `npm run lint` | ESLint |

## Teste

Proiectul nu are suite de teste automate configurate încă. Verifică manual:

```bash
npm run build
npm run lint
```

## Deploy

Compatibil cu [Vercel](https://vercel.com) sau orice host Node.js:

1. Setează `ANTHROPIC_API_KEY` în variabilele de mediu ale platformei
2. Asigură-te că `data/tags.json` și `public/media/` sunt incluse în deploy
3. `npm run build && npm run start`

## Structura proiectului

```
app/
  page.tsx           # UI căutare, rezultate, selecție, export
  api/search/        # POST — Claude + filtrare tag-uri
components/ui/       # shadcn/ui (button, input, card, badge)
lib/
  search.ts          # filtrare, scoring, prompt Claude
  export.ts          # export ZIP și CSV (client)
data/tags.json       # catalog tag-uri media
public/media/        # fișiere media
```

## Adăugare componente UI

Proiectul folosește [shadcn/ui](https://ui.shadcn.com):

```bash
npx shadcn add <component>
```
