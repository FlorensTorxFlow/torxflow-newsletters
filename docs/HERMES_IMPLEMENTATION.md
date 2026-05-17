# Hermes Implementation Spec

Deze file beschrijft exact hoe Hermes de TorxFlow newsletter automation moet uitvoeren.

## Environment constants

```text
PUBLIC_BASE_URL=https://torxflow-newsletters.empty-hill-4369.workers.dev
PUBLIC_DIR=public
NEWSLETTER_ROOT=public/newsletter
STANDARD_HEADER_PATH=public/assets/header/torxflow-news-header.png
STANDARD_LOGO_PATH=public/assets/logo/torxflow-mark.png
```

## Per-run input

Hermes heeft per run nodig:

```text
run_date: YYYY-MM-DD
articles: 5 artikelen
template_path: production email template
```

Elke artikelstructuur:

```json
{
  "index": 1,
  "title": "...",
  "summary": "...",
  "context": "... optional",
  "image_prompt": "...",
  "image_alt": "Korte beschrijvende alt text"
}
```

## Per-run output structure

Voor datum `YYYY-MM-DD`:

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

## Image workflow

Per artikel:

```text
1. Maak wide editorial banner prompt
2. Genereer beeld als brede banner
3. Sla raw image tijdelijk op in public/newsletter/YYYY-MM-DD/images/
4. Run verplicht optimizer-script
5. Run verplicht validator-script
6. Gebruik alleen de geoptimaliseerde article-N.jpg output in email HTML
```

Final email bestandsnamen zijn verplicht:

```text
article-1.jpg
article-2.jpg
article-3.jpg
article-4.jpg
article-5.jpg
```

Geen spaties, geen hoofdletters, geen extra suffixes.

Raw generated images mogen tijdelijk `.png`, `.jpg`, `.jpeg`, of `.webp` zijn, maar Hermes mag die raw files nooit direct in de email-template gebruiken.

## Mandatory image preparation gate

Hermes must never use raw generated images directly in final email HTML.

Per run, after raw image generation and before template filling, Hermes must run exactly one central command:

```powershell
npm.cmd run images:prepare -- YYYY-MM-DD
```

This command internally runs optimization and validation, including one recovery attempt if validation fails.

The final optimizer output must be:

```text
article-1.jpg
article-2.jpg
article-3.jpg
article-4.jpg
article-5.jpg
```

The validator must confirm:

```text
1040 x 300 px
JPG
<= 350 KB target per article image
```

If image preparation fails, Hermes must stop the run.

Hermes must not:

```text
- regenerate images repeatedly
- enter retry loops
- commit
- push
- fill final email HTML
- send a test or production email
```

Hermes must report the exact terminal output from the failed preparation command.


## URL construction

Hermes bouwt URLs deterministisch:

```text
{PUBLIC_BASE_URL}/newsletter/{YYYY-MM-DD}/images/article-1.jpg
```

Voorbeeld:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/newsletter/2026-05-17/images/article-1.jpg
```

## Template replacement

Hermes vervangt:

```text
{{ARTICLE_1_IMAGE_URL}}
{{ARTICLE_2_IMAGE_URL}}
{{ARTICLE_3_IMAGE_URL}}
{{ARTICLE_4_IMAGE_URL}}
{{ARTICLE_5_IMAGE_URL}}
```

met de publieke image URLs.

Hermes vervangt ook:

```text
{{ARTICLE_1_IMAGE_ALT}}
{{ARTICLE_2_IMAGE_ALT}}
{{ARTICLE_3_IMAGE_ALT}}
{{ARTICLE_4_IMAGE_ALT}}
{{ARTICLE_5_IMAGE_ALT}}
```

met korte beschrijvende alt text.

## Git workflow

Na generatie:

```powershell
git status
git add public/newsletter/YYYY-MM-DD
git commit -m "Add TorxFlow newsletter YYYY-MM-DD"
git push origin main
```

## Deployment wait

Na push moet Hermes wachten/controleren dat Cloudflare deployed is voordat final email HTML wordt gebruikt.

Minimale test:

```text
Open/check:
{PUBLIC_BASE_URL}/newsletter/{YYYY-MM-DD}/images/article-1.jpg
```

Als image URL 404 geeft, mag de email nog niet verzonden worden.

## Email generation order

```text
1. Content + images genereren
2. Raw images in /public/newsletter/YYYY-MM-DD/images plaatsen
3. npm.cmd run images:prepare -- YYYY-MM-DD
4. Alleen article-1.jpg t/m article-5.jpg gebruiken
6. Commit + push
7. Cloudflare deploy success afwachten
8. URLs valideren
9. Template vullen
10. Final email HTML exporteren
11. Testmail sturen
12. Pas daarna verzenden
```

## Hard rules

Hermes mag nooit:

```text
- data:image/base64 gebruiken in productie-email
- lokale paths in email HTML gebruiken
- afbeeldingen buiten /public zetten
- Cloudflare config aanpassen naar assets.directory = "."
- square/portrait images uploaden zonder vooraf 1040x300 export
- raw generated images direct in final email HTML gebruiken
- validation failure negeren
- meer dan één automatische herstelpoging doen
- email verzenden voordat Cloudflare URLs werken
```

## Email render workflow

Hermes must render final email HTML using the render script. Hermes must not manually edit final HTML.

Per run, Hermes must create:

```text
data/newsletter-runs/YYYY-MM-DD.json
```

Required JSON shape:

```json
{
  "newsletter": {
    "title": "TorxFlow News",
    "subtitle": "Nieuws voor garage-eigenaren",
    "date": "17 mei 2026",
    "readTime": "4 min lezen"
  },
  "articles": [
    {
      "index": 1,
      "title": "Artikel titel",
      "summary": "Korte samenvatting van het artikel.",
      "imageAlt": "Beschrijvende alt text"
    }
  ]
}
```

Hermes must run this after image preparation:

```powershell
npm.cmd run email:render -- YYYY-MM-DD
```

The render script must output:

```text
public/newsletter/YYYY-MM-DD/email-preview.html
```

The render script replaces:

```text
{{NEWSLETTER_TITLE}}
{{NEWSLETTER_SUBTITLE}}
{{NEWSLETTER_DATE}}
{{READ_TIME}}
{{ARTICLE_1_TITLE}}
{{ARTICLE_1_SUMMARY}}
{{ARTICLE_1_IMAGE_URL}}
{{ARTICLE_1_IMAGE_ALT}}
...
{{ARTICLE_5_TITLE}}
{{ARTICLE_5_SUMMARY}}
{{ARTICLE_5_IMAGE_URL}}
{{ARTICLE_5_IMAGE_ALT}}
```

If rendering fails, Hermes must stop. Hermes must not commit, push, send a test email, or send a production email.
