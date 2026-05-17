# TorxFlow Newsletters

Dit repository host de publieke assets en webversies voor de TorxFlow News email automation.

De kern:

```text
Hermes genereert nieuwsbriefcontent en artikelbeelden
→ plaatst HTML + afbeeldingen in /public
→ pusht naar GitHub
→ Cloudflare Workers Static Assets deployt /public
→ email-template gebruikt de publieke HTTPS URLs
```

## Belangrijkste regels

### 1. Cloudflare serveert alleen `/public`

De Cloudflare config moet altijd dit blijven gebruiken:

```json
"assets": {
  "directory": "./public"
}
```

Alles wat online beschikbaar moet zijn, moet dus in `/public` staan.

Niet wijzigen naar:

```json
"assets": {
  "directory": "."
}
```

Dat veroorzaakte eerder 404’s, omdat Cloudflare dan het verkeerde pad serveerde.

### 2. Standaard assets staan vast

Deze bestanden worden één keer geüpload en daarna hergebruikt in elke nieuwsbrief:

```text
public/assets/header/torxflow-news-header.png
public/assets/logo/torxflow-mark.png
```

Publieke URLs:

```text
/assets/header/torxflow-news-header.png
/assets/logo/torxflow-mark.png
```

Volledige huidige base URL:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev
```

Voorbeeld:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/assets/header/torxflow-news-header.png
```

### 3. Artikelbeelden zijn dynamisch per nieuwsbrief

Per nieuwsbrief-run maakt Hermes:

```text
public/newsletter/YYYY-MM-DD/
  index.html
  images/
    article-1.png
    article-2.png
    article-3.png
    article-4.png
    article-5.png
```

Voorbeeld online URL:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/newsletter/2026-05-17/images/article-1.png
```

### 4. Artikelbeeld formaat is verplicht

Hermes mag niet vertrouwen op HTML-cropping. Hij moet artikelbeelden vóór uploaden correct maken.

Vaste output:

```text
1040 x 300 px
```

Email display size:

```text
520 x 150 px
```

Regel:

```text
Genereer direct brede newsletter-banner images.
Daarna alleen lichte eind-crop/rescale naar exact 1040 x 300 px.
```

Geen square/portrait images genereren en daarna hard croppen.

### 5. Template gebruikt placeholders

De productie-template bevat placeholders zoals:

```text
{{ARTICLE_1_IMAGE_URL}}
{{ARTICLE_1_IMAGE_ALT}}
```

Hermes vervangt die na upload met publieke HTTPS URLs.

## Repositorystructuur

```text
torxflow-newsletters/
  wrangler.jsonc
  public/
    index.html
    assets/
      header/
        torxflow-news-header.png
      logo/
        torxflow-mark.png
    newsletter/
      YYYY-MM-DD/
        index.html
        images/
          article-1.png
          article-2.png
          article-3.png
          article-4.png
          article-5.png
  docs/
    CLOUDFLARE_DEPLOYMENT.md
    HERMES_IMPLEMENTATION.md
    IMAGE_GENERATION_SPEC.md
    TEMPLATE_PLACEHOLDERS.md
    TROUBLESHOOTING.md
```

## Quick test

Na elke push:

```powershell
git status
git push origin main
```

Controleer in Cloudflare:

```text
Workers & Pages
→ torxflow-newsletters
→ Deployments
→ laatste deployment moet success zijn
```

Test assets:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/assets/header/torxflow-news-header.png
https://torxflow-newsletters.empty-hill-4369.workers.dev/assets/logo/torxflow-mark.png
```

Test nieuwsbriefpagina:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/newsletter/YYYY-MM-DD/
```

## Belangrijk voor Hermes

Hermes moet nooit lokale image paths in email HTML zetten.

Niet:

```html
<img src="public/newsletter/2026-05-17/images/article-1.png">
```

Wel:

```html
<img src="https://torxflow-newsletters.empty-hill-4369.workers.dev/newsletter/2026-05-17/images/article-1.png">
```

## Productievolgorde

```text
1. Nieuws selecteren
2. Content schrijven
3. 5 brede artikelbeelden genereren
4. Beelden exporteren als 1040 x 300 px
5. Beelden opslaan in public/newsletter/YYYY-MM-DD/images/
6. Online nieuwsbriefpagina maken als public/newsletter/YYYY-MM-DD/index.html
7. Commit + push naar GitHub
8. Wachten op Cloudflare deploy success
9. Publieke image URLs bouwen
10. Email-template vullen
11. Testmail sturen
12. Pas daarna verzenden
```
