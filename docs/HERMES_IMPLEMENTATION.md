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
    article-1.png
    article-2.png
    article-3.png
    article-4.png
    article-5.png
```

## Image workflow

Per artikel:

```text
1. Maak wide editorial banner prompt
2. Genereer beeld als brede banner
3. Crop/resize naar exact 1040 x 300 px
4. Compress naar redelijke bestandsgrootte
5. Sla op als article-N.png
6. Plaats in public/newsletter/YYYY-MM-DD/images/
```

Bestandsnamen zijn verplicht:

```text
article-1.png
article-2.png
article-3.png
article-4.png
article-5.png
```

Geen spaties, geen hoofdletters, geen extra suffixes.

## URL construction

Hermes bouwt URLs deterministisch:

```text
{PUBLIC_BASE_URL}/newsletter/{YYYY-MM-DD}/images/article-1.png
```

Voorbeeld:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/newsletter/2026-05-17/images/article-1.png
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
{PUBLIC_BASE_URL}/newsletter/{YYYY-MM-DD}/images/article-1.png
```

Als image URL 404 geeft, mag de email nog niet verzonden worden.

## Email generation order

```text
1. Content + images genereren
2. Lokale bestanden in /public/newsletter/YYYY-MM-DD plaatsen
3. Commit + push
4. Cloudflare deploy success afwachten
5. URLs valideren
6. Template vullen
7. Final email HTML exporteren
8. Testmail sturen
9. Pas daarna verzenden
```

## Hard rules

Hermes mag nooit:

```text
- data:image/base64 gebruiken in productie-email
- lokale paths in email HTML gebruiken
- afbeeldingen buiten /public zetten
- Cloudflare config aanpassen naar assets.directory = "."
- square/portrait images uploaden zonder vooraf 1040x300 export
- email verzenden voordat Cloudflare URLs werken
```
