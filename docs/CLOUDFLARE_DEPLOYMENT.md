# Cloudflare Deployment

Deze repo gebruikt Cloudflare Workers Static Assets om statische nieuwsbriefbestanden online te hosten.

## Doel

Cloudflare maakt bestanden uit `/public` bereikbaar via HTTPS.

Voorbeeld:

```text
public/assets/header/torxflow-news-header.png
```

wordt:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/assets/header/torxflow-news-header.png
```

## Verplichte config

Gebruik `wrangler.jsonc` met:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "torxflow-newsletters",
  "compatibility_date": "2026-05-17",
  "observability": {
    "enabled": true
  },
  "assets": {
    "directory": "./public"
  },
  "compatibility_flags": [
    "nodejs_compat"
  ]
}
```

## Kritieke regel

Deze regel mag niet veranderd worden:

```json
"directory": "./public"
```

Niet accepteren als Cloudflare of een PR dit terugzet naar:

```json
"directory": "."
```

Dat veroorzaakt verkeerde asset paths en 404’s.

## GitHub → Cloudflare flow

```text
Local repo
→ git commit
→ git push origin main
→ Cloudflare ziet GitHub push
→ Cloudflare deployt nieuwe static assets
→ URLs worden publiek bereikbaar
```

## Cloudflare dashboard check

Ga naar:

```text
Cloudflare
→ Workers & Pages
→ torxflow-newsletters
→ Deployments
```

De laatste deployment moet `Success` zijn.

## Eerste URLs om altijd te testen

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/
https://torxflow-newsletters.empty-hill-4369.workers.dev/assets/header/torxflow-news-header.png
https://torxflow-newsletters.empty-hill-4369.workers.dev/assets/logo/torxflow-mark.png
```

## Custom domain later

Later kan deze Workers URL vervangen worden door:

```text
https://news.torxflow.com
```

Tot die tijd gebruikt Hermes de Workers URL als `PUBLIC_BASE_URL`.

## Geen Supabase nodig

Deze setup gebruikt:

```text
GitHub repo
Cloudflare Workers Static Assets
```

Niet:

```text
Supabase Storage
AWS S3
Cloudflare R2
```

R2 kan later, maar is niet nodig voor deze fase.
