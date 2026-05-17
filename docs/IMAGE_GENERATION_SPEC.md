# Image Generation Spec

Deze specificatie bepaalt hoe Hermes artikelbeelden voor TorxFlow News maakt.

## Doel

Elke artikelafbeelding moet eruitzien als een brede newsletter-banner, niet als een normaal square/portrait AI-plaatje dat hard is gecropt.

## Final output

```text
Width: 1040 px
Height: 300 px
Aspect ratio: 3.47:1
Format: PNG or JPG
Display in email: 520 x 150 px
```

## Waarom 1040 x 300?

De email toont de afbeelding als:

```text
520 x 150 px
```

1040 x 300 is retina-ready 2x output en blijft scherp in emailclients.

## Prompt principles

Hermes moet image prompts altijd sturen op brede compositie:

```text
wide editorial banner image
automotive newsletter style
garage-owner relevant
main subject centered
important elements inside center 60%
no important details near edges
no text inside image
clean composition
professional B2B SaaS/newsletter aesthetic
readable at small size
```

## Niet doen

```text
portrait image
square image
vertical phone wallpaper
image with text inside
crowded scene
important subject on extreme left/right edge
faces or vehicles cut off by crop
```

## Wel doen

```text
wide garage scene
mechanic with diagnostic equipment
front desk / customer call intake
vehicle on lift
EV maintenance context
parts/planning/operations visual
clean editorial lighting
subtle TorxFlow orange accent where appropriate
```

## Safe area

Belangrijke details moeten binnen de middelste 60% staan.

```text
Left 20%: safe background/negative space
Center 60%: main subject
Right 20%: safe background/negative space
```

## Crop process

Als de generator niet exact 1040 x 300 kan leveren:

```text
1. Genereer zo breed mogelijk, bij voorkeur 3:1 of 7:2
2. Center-crop naar 3.47:1
3. Resize naar 1040 x 300
4. Visueel checken: subject niet afgesneden
5. Compress
```

## Naming

```text
article-1.png
article-2.png
article-3.png
article-4.png
article-5.png
```

## Output path

```text
public/newsletter/YYYY-MM-DD/images/article-1.png
```

## Quality target

Gebruik liever:

```text
200–500 KB per image
```

Vermijd:

```text
5–10 MB per image
```

Email moet snel laden.
