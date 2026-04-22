# Lavender Interiors

A small private tool for visualising interior design ideas for our 3BHK apartment ("Lavender 1"). Pick a room from the dropdown, describe the vibe, and Google's Gemini 2.5 Flash Image ("Nano Banana") renders three photorealistic ideas based on the apartment's floor plan. Pick the one closest to what you want and tweak it.

Designed to be readable and tap-friendly on a phone — built for parents.

## Stack

- **Next.js 15** (App Router + TypeScript + Tailwind)
- **Gemini 2.5 Flash Image** (`gemini-2.5-flash-image`) via `@google/genai`, called from server API routes so the key stays off the client
- **Dockerized** with a multi-stage build and `output: "standalone"` for a tiny runtime image
- **Deployed** to a Hostinger VPS behind Traefik (Let's Encrypt) at https://interiors.srv1539585.hstgr.cloud

## Local development

```bash
cp .env.example .env
# edit .env and paste a Gemini key from https://aistudio.google.com/apikey
npm install
npm run dev
# open http://localhost:3000
```

The apartment floor plan ships in `public/photos/floor-plan.jpg` and is loaded automatically as the reference image. You can also drop a real photo of any room when you want a re-styling rather than a from-scratch render.

## Deploy

Same pattern as the other Hostinger services:

1. **Push to `main`** → GitHub Action `.github/workflows/build.yml` builds the Docker image and pushes it to `ghcr.io/kunalkhosla/lavender-interior-reimagine:latest`.
2. **Make the GHCR package public** (one time) so the VPS can pull without auth.
3. **On the VPS** at `/docker/lavender-interior-reimagine/`:
   ```bash
   docker compose pull
   docker compose up -d
   ```
4. Traefik picks up the labels and issues a Let's Encrypt cert for **https://interiors.srv1539585.hstgr.cloud**.

## API

- `POST /api/generate` — `{ imageBase64, mimeType, prompt, room, sourceKind, variations? }` → `{ images: [{ dataUrl }] }`. `sourceKind` is `"floor-plan"` (default) or `"room-photo"`.
- `POST /api/refine` — `{ imageBase64, mimeType, prompt, room }` → `{ image: { dataUrl } }`. Single targeted edit on the selected interior render.

## License

MIT.
