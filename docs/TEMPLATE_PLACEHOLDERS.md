# Template Placeholders

De productie-template gebruikt placeholders die Hermes moet vervangen.

## Standard assets

Deze zijn vast en staan al online:

```text
{{HEADER_IMAGE_URL}}
{{LOGO_IMAGE_URL}}
```

In de huidige productie-template mogen deze ook al hardcoded staan als:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/assets/header/torxflow-news-header.png
https://torxflow-newsletters.empty-hill-4369.workers.dev/assets/logo/torxflow-mark.png
```

## Article image placeholders

```text
{{ARTICLE_1_IMAGE_URL}}
{{ARTICLE_2_IMAGE_URL}}
{{ARTICLE_3_IMAGE_URL}}
{{ARTICLE_4_IMAGE_URL}}
{{ARTICLE_5_IMAGE_URL}}
```

Worden vervangen door:

```text
https://torxflow-newsletters.empty-hill-4369.workers.dev/newsletter/YYYY-MM-DD/images/article-1.png
```

## Article alt placeholders

```text
{{ARTICLE_1_IMAGE_ALT}}
{{ARTICLE_2_IMAGE_ALT}}
{{ARTICLE_3_IMAGE_ALT}}
{{ARTICLE_4_IMAGE_ALT}}
{{ARTICLE_5_IMAGE_ALT}}
```

Alt text regels:

```text
- kort
- beschrijvend
- geen keyword stuffing
- geen punt nodig
- max ongeveer 80 tekens
```

Voorbeeld:

```text
Garagehouder bekijkt klantinformatie op laptop
```

## Article content placeholders, optioneel

Als de template later volledig dynamisch wordt, gebruik:

```text
{{NEWSLETTER_TITLE}}
{{NEWSLETTER_SUBTITLE}}
{{NEWSLETTER_DATE}}

{{ARTICLE_1_TITLE}}
{{ARTICLE_1_SUMMARY}}
{{ARTICLE_1_CONTEXT}}

{{ARTICLE_2_TITLE}}
{{ARTICLE_2_SUMMARY}}
{{ARTICLE_2_CONTEXT}}
```

## CTA placeholders, optioneel

```text
{{CTA_TITLE}}
{{CTA_BODY}}
{{CTA_BUTTON_LABEL}}
{{CTA_BUTTON_URL}}
```

Default:

```text
CTA_TITLE=TorxFlow
CTA_BUTTON_LABEL=Talk to us
CTA_BUTTON_URL=https://torxflow.com
```

## Email safety

Niet gebruiken in productie-email:

```text
data:image/png;base64,...
assets/local-file.png
C:\Users\...
public/newsletter/...
```

Wel gebruiken:

```text
https://...
```
