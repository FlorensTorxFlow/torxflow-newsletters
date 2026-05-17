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
    article-1.jpg
    article-2.jpg
    article-3.jpg
    article-4.jpg
    article-5.jpg
```

Voorbeeld online URL:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/newsletter/2026-05-17/images/article-1.jpg
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
Daarna verplicht optimaliseren naar JPG.
```

Geen square/portrait images genereren en daarna hard croppen.

### 5. Template gebruikt placeholders

De productie-template bevat placeholders zoals:

```text
{{ARTICLE_1_IMAGE_URL}}
{{ARTICLE_1_IMAGE_ALT}}
```

Hermes vervangt die na upload met publieke HTTPS URLs.

Hermes mag nooit raw generated images direct in de email HTML gebruiken. Hermes moet eerst image optimization en validation draaien.

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
          article-1.jpg
          article-2.jpg
          article-3.jpg
          article-4.jpg
          article-5.jpg
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
<img src="public/newsletter/2026-05-17/images/article-1.jpg">
```

Wel:

```html
<img src="https://torxflow-newsletters.empty-hill-4369.workers.dev/newsletter/2026-05-17/images/article-1.jpg">
```

## Productievolgorde

```text
1. Nieuws selecteren
2. Content schrijven
3. 5 brede artikelbeelden genereren als raw images
4. Raw images opslaan in public/newsletter/YYYY-MM-DD/images/
5. Verplicht image preparation draaien: npm.cmd run images:prepare -- YYYY-MM-DD
6. Alleen article-1.jpg t/m article-5.jpg gebruiken in email HTML
8. Online nieuwsbriefpagina maken als public/newsletter/YYYY-MM-DD/index.html
9. Commit + push naar GitHub
10. Wachten op Cloudflare deploy success
11. Publieke .jpg image URLs bouwen
12. Email-template vullen
13. Testmail sturen
14. Pas daarna verzenden
```


## Hermes failure policy

Hermes mag per nieuwsbrief-run maar één centrale image-command uitvoeren:

```powershell
npm.cmd run images:prepare -- YYYY-MM-DD
```

Deze command draait intern:

```text
1. Optimizer
2. Validator
3. Als validator faalt: één automatische herstelpoging
4. Als validator opnieuw faalt: STOP
```

Bij falen mag Hermes niet committen, niet pushen, geen email-template vullen en geen email verzenden. Hermes moet de exacte terminal-output rapporteren.
