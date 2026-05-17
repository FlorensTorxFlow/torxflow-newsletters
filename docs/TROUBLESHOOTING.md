# Troubleshooting

## Header/logo geeft 404

Check lokaal:

```powershell
cd C:\Users\Florens\Desktop\torxflow-newsletters
Get-ChildItem -Recurse public\assets
```

Verwacht:

```text
public/assets/header/torxflow-news-header.png
public/assets/logo/torxflow-mark.png
```

Check Cloudflare config:

```powershell
Get-Content wrangler.jsonc
```

Moet bevatten:

```json
"assets": {
  "directory": "./public"
}
```

Als daar `"."` staat, fixen.

## Cloudflare URL werkt niet na push

Check:

```text
Cloudflare
→ Workers & Pages
→ torxflow-newsletters
→ Deployments
```

Laatste deployment moet `Success` zijn.

## GitHub push lukt niet

Check remote:

```powershell
git remote -v
```

Push:

```powershell
git push origin main
```

Als permission denied verschijnt, Windows Credential Manager gebruikt mogelijk het verkeerde GitHub-account.

## Email preview toont {{ARTICLE_1_IMAGE_URL}}

Dat is normaal zolang Hermes de template nog niet gevuld heeft.

Production master template:

```text
bevat placeholders
```

Final email HTML:

```text
moet echte https URLs bevatten
```

## Afbeelding wordt uitgerekt of rare crop

Oorzaak: Hermes heeft geen 1040 x 300 output gemaakt, of de optimizer/validator is niet uitgevoerd.

Fix:

```text
Genereer wide banner
Run image preparation: npm.cmd run images:prepare -- YYYY-MM-DD
Gebruik alleen article-1.jpg t/m article-5.jpg
```

## Cloudflare PR wil config aanpassen

Niet zomaar accepteren.

Check vooral:

```json
"assets": {
  "directory": "./public"
}
```

Als een PR dit verandert naar `"."`, niet mergen of direct corrigeren.


## Image preparation faalt

Als `npm.cmd run images:prepare -- YYYY-MM-DD` faalt, mag Hermes niet verder.

Hermes mag dan niet:

```text
- committen
- pushen
- final email HTML vullen
- testmail sturen
- productiemail sturen
- in een retry-loop blijven
```

Hermes moet de exacte terminal-output rapporteren.

Veelvoorkomende oorzaken:

```text
article-N.jpg ontbreekt
image is niet 1040 x 300 px
image is groter dan de max target
image is corrupt/onleesbaar
```

## Render output bevat oude placeholdertekst

Als `email-preview.html` nog dit bevat:

```text
Titel artikel
Korte introductie van het artikel
20 mei 2025
{{...}}
â
```

dan is één van deze dingen fout:

```text
1. templates/torxflow-news-email-template.html is niet de dynamic template
2. data/newsletter-runs/YYYY-MM-DD.json mist velden
3. npm.cmd run email:render -- YYYY-MM-DD is niet opnieuw uitgevoerd
4. JSON bevat een BOM/encoding-probleem
```

Check:

```powershell
Select-String -Path templates\torxflow-news-email-template.html -Pattern "{{NEWSLETTER_TITLE}}","{{ARTICLE_1_TITLE}}","Titel artikel","20 mei 2025","â"
```

Render opnieuw:

```powershell
npm.cmd run email:render -- YYYY-MM-DD
```

Controleer output:

```powershell
Select-String -Path public\newsletter\YYYY-MM-DD\email-preview.html -Pattern "{{","data:image","Titel artikel","Korte introductie","20 mei 2025","â"
```

Ideaal: geen output.
