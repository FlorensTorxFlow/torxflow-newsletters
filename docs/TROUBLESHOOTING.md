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

Oorzaak: Hermes heeft geen 1040 x 300 output gemaakt.

Fix:

```text
Genereer wide banner
Center-crop naar 1040 x 300
Upload opnieuw
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
