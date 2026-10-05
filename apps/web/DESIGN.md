---
{
  "name": "Echo Link",
  "description": "Un outil sobre de partage de fichiers et de liens récupérables.",
  "colors": {
    "base": "#fafbf9",
    "mantle": "#ffffff",
    "crust": "#f3f4f0",
    "surface0": "#e9ede7",
    "surface1": "#d3d9cf",
    "surface2": "#b8c2b4",
    "text": "#202920",
    "subtext1": "#4a574a",
    "blue": "#1f4f91",
    "teal": "#175e52",
    "yellow": "#76500e",
    "red": "#9c303c",
    "green": "#28612e",
    "peach": "#8a441b",
    "sky": "#205d79",
    "lavender": "#594284",
    "pink": "#8b3764",
    "on-accent": "#ffffff",
    "dark-base": "#18181b",
    "dark-mantle": "#202024",
    "dark-crust": "#131316",
    "dark-surface0": "#2b2b30",
    "dark-surface1": "#3a3a41",
    "dark-surface2": "#51515a",
    "dark-text": "#f4f4f5",
    "dark-subtext1": "#d0d0d6",
    "dark-blue": "#a2c4fb",
    "dark-teal": "#8dd6c5",
    "dark-yellow": "#e9c779",
    "dark-red": "#ffa6ad",
    "dark-green": "#a8d8a4",
    "dark-peach": "#f4bd96",
    "dark-sky": "#a0d2e9",
    "dark-lavender": "#c9b8ef",
    "dark-pink": "#edb0cd",
    "dark-on-accent": "#131316"
  },
  "typography": {
    "display": {
      "fontFamily": "\"Geist Variable\", ui-sans-serif, system-ui, sans-serif",
      "fontSize": "clamp(2.5rem, 6vw, 4.5rem)",
      "fontWeight": 500,
      "lineHeight": 1.05,
      "letterSpacing": "-0.035em"
    },
    "title": {
      "fontFamily": "\"Geist Variable\", ui-sans-serif, system-ui, sans-serif",
      "fontSize": "24px",
      "fontWeight": 500,
      "lineHeight": "32px"
    },
    "body": {
      "fontFamily": "\"Geist Variable\", ui-sans-serif, system-ui, sans-serif",
      "fontSize": "16px",
      "fontWeight": 400,
      "lineHeight": "24px"
    },
    "label": {
      "fontFamily": "\"Geist Variable\", ui-sans-serif, system-ui, sans-serif",
      "fontSize": "14px",
      "fontWeight": 500,
      "lineHeight": "20px"
    },
    "metadata": {
      "fontFamily": "\"JetBrains Mono\", ui-monospace, \"SF Mono\", monospace",
      "fontSize": "12px",
      "fontWeight": 400,
      "lineHeight": "16px"
    },
    "url": {
      "fontFamily": "\"JetBrains Mono\", ui-monospace, \"SF Mono\", monospace",
      "fontSize": "16px",
      "fontWeight": 400,
      "lineHeight": "24px"
    },
    "display-mobile": {
      "fontFamily": "\"Geist Variable\", ui-sans-serif, system-ui, sans-serif",
      "fontSize": "32px",
      "fontWeight": 500,
      "lineHeight": 1.25,
      "letterSpacing": "-0.025em"
    },
    "share-title-mobile": {
      "fontFamily": "\"Geist Variable\", ui-sans-serif, system-ui, sans-serif",
      "fontSize": "20px",
      "fontWeight": 500,
      "lineHeight": "26px"
    },
    "share-metadata-mobile": {
      "fontFamily": "\"Geist Variable\", ui-sans-serif, system-ui, sans-serif",
      "fontSize": "13px",
      "fontWeight": 400,
      "lineHeight": "20px"
    }
  },
  "rounded": {
    "default": "4px",
    "md": "6px",
    "lg": "8px",
    "xl": "12px",
    "full": "9999px"
  },
  "spacing": {
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "12": "48px",
    "16": "64px"
  },
  "components": {
    "button-primary": {
      "backgroundColor": "{colors.blue}",
      "textColor": "{colors.on-accent}",
      "rounded": "{rounded.md}",
      "padding": "8px 16px",
      "height": "44px"
    },
    "button-secondary": {
      "backgroundColor": "{colors.surface0}",
      "textColor": "{colors.subtext1}",
      "rounded": "{rounded.md}",
      "padding": "8px 16px",
      "height": "44px"
    },
    "button-secondary-hover": {
      "backgroundColor": "{colors.surface1}",
      "textColor": "{colors.text}"
    },
    "input-link": {
      "backgroundColor": "{colors.mantle}",
      "textColor": "{colors.text}",
      "typography": "{typography.url}",
      "rounded": "{rounded.md}",
      "padding": "8px 12px",
      "height": "44px"
    },
    "format-chip": {
      "textColor": "{colors.subtext1}",
      "rounded": "{rounded.md}",
      "padding": "0 12px",
      "height": "44px"
    },
    "format-chip-selected": {
      "backgroundColor": "{colors.surface0}",
      "textColor": "{colors.blue}"
    },
    "card-result": {
      "backgroundColor": "{colors.mantle}",
      "textColor": "{colors.text}",
      "rounded": "{rounded.md}",
      "padding": "16px"
    },
    "navigation-action": {
      "backgroundColor": "{colors.mantle}",
      "textColor": "{colors.text}",
      "rounded": "{rounded.md}",
      "padding": "0 16px",
      "height": "44px"
    },
    "dropzone": {
      "backgroundColor": "{colors.mantle}",
      "textColor": "{colors.text}",
      "rounded": "{rounded.lg}",
      "padding": "20px 20px",
      "height": "160px"
    },
    "button-primary-hover": {
      "backgroundColor": "var(--color-accent-hover)",
      "textColor": "var(--color-on-accent)"
    },
    "button-primary-active": {
      "backgroundColor": "var(--color-accent-active)",
      "textColor": "var(--color-on-accent)"
    },
    "button-secondary-active": {
      "backgroundColor": "var(--color-surface2)",
      "textColor": "var(--color-text)"
    },
    "button-danger-hover": {
      "backgroundColor": "color-mix(in srgb, var(--color-red) 18%, var(--color-mantle))",
      "textColor": "var(--color-red)"
    },
    "dropzone-compact": {
      "backgroundColor": "{colors.mantle}",
      "textColor": "{colors.text}",
      "rounded": "{rounded.lg}",
      "padding": "12px 16px",
      "height": "88px"
    },
    "mobile-file-row": {
      "backgroundColor": "{colors.mantle}",
      "textColor": "{colors.text}",
      "padding": "16px 4px"
    }
  }
}
---

# Design System: Echo Link

## Overview

**Creative North Star: "Le comptoir de transmission"**

Le comptoir de transmission privilégie une remise claire : un fichier entre, un lien lisible en sort. Echo Link reste un outil sobre, aux surfaces claires légèrement verdâtres et aux surfaces sombres gris anthracite et aux accents réservés aux actions et aux états. Catppuccin, les halos colorés et le fond à points ont été remplacés.

La densité reste pratique : texte sans empattement, contours discrets, commandes explicites et métadonnées séparées. Les thèmes clair et sombre partagent la même hiérarchie. Le nom Echo Link et la langue anglaise de l’interface restent conservés.

**Key Characteristics:**

- Surfaces séparées par le ton et le contour.
- Action principale identifiable, sans décoration concurrente.
- Liens sélectionnables et feedback correspondant au résultat réel.
- Commandes présentes au clavier et au tactile.

## Colors

Neutres clairs peu saturés et gris anthracite sombres, accents francs. Le frontmatter est normatif ; `src/app.css` est la source d’implémentation. Les clés préfixées `dark-` remplacent leur équivalent dans le thème sombre. Les noms historiques des variables ne signalent pas le maintien de Catppuccin.

### Primary

**Bleu transmission** (blue / dark-blue) : accent initial des actions et liens. L’accent actif pointe vers blue, teal, yellow ou red suivant le choix utilisateur. Le frontmatter des composants montre le bleu initial ; le sidecar reste lié à la variable active. Le texte on-accent suit le thème.

### Secondary

**Sarcelle calme** (teal), **ambre signal** (yellow), **rose franc** (red) : trois autres options d’accent. Les erreurs et suppressions utilisent aussi red avec un libellé explicite.

### Tertiary

**Vert confirmation** (green) : succès des lignes. Cuivre, bleu ciel, violet et rose doux (peach, sky, lavender, pink) : repérage des types média et commandes existantes. Leurs variantes sombres gardent le même rôle.

### Neutral

crust : toile de fond et zone média ; base : niveau intermédiaire ; mantle : contenu et champs. surface0, surface1, surface2 : niveaux tonaux, contours et survols. text : contenu principal ; subtext1 : explications et métadonnées. Les alias CSS subtext0 et overlay0/1/2 partagent subtext1 ; mauve partage lavender. Ne pas inventer de distinction entre ces alias.

**The Action Accent Rule.** L’accent choisi souligne actions, focus et sélection ; les couleurs de succès et d’erreur gardent leur sens propre.

## Typography

**Display Font:** Geist Variable, repli système sans empattement.
**Body Font:** Geist Variable.
**Label/Mono Font:** JetBrains Mono, repli monospace système, pour URLs, métadonnées, notation clavier et marque compacte.

Base document 16px ; réglages ss01, ss02 et cv11 activés globalement. Caractère direct et discret, sans police d’affiche supplémentaire.

### Hierarchy

- **Display** : titre fluide d’accueil à partir de 640px ; sur mobile, titre de 32px avec une seule phrase introductive, selon display-mobile.
- **Title** : titres de workspace et de fichier ; le titre partagé ajoute -0.025em de resserrement.
- **Body** : texte et champs ; l’explication introductive utilise aussi 18px avec interligne ample.
- **Label** : commandes et libellés, poids moyen selon leur rôle.
- **Metadata / URL** : monospace compact pour attributs sur desktop ; taille courante pour URL copiable. Sur mobile, titres de consultation et aperçu à 20px / 26px, métadonnées en Geist à 13px / 20px. La liste du workspace utilise des titres à 16px / 24px et métadonnées à 14px / 20px. Les raccourcis peuvent descendre à 10-11px sans porter une instruction essentielle.

## Layout

Conteneurs centrés : accueil 1152px, workspace 768px, consultation 896px. Marges latérales généralement 20px puis 32px à partir de 640px ; certaines sections média utilisent 16px sur mobile. Les actions se replient et les champs restent rétrécissables.

L’accueil empile introduction et sélection puis utilise deux colonnes 1 / 1.1 à partir de 1024px. Dépôt : minimum 160px sur accueil mobile (environ 162px avec son contenu), 88px dans le workspace compact, puis 288px à partir de 640px. Sur mobile, une seule collection de lignes remplace la section Recent et la grille. La grille desktop utilise 4 colonnes à 640px et 6 à 768px. Aperçus sans déformation, titres longs repliables.

Sur desktop, modales limitées à la fenêtre moins 32px et palette à 600px, avec défilement interne. Sur mobile, aperçu et palette utilisent calc(100% - 16px), avec marges centrées de 8px tenant compte de la zone utile après scrollbar ; une fenêtre de 320px peut ainsi donner environ 289px de contenu modal. Hauteur maximale : calc(100dvh - 16px). Média aperçu plafonné à 40dvh ; commandes regroupées en deux colonnes de 44px. Lignes de palette à 48px et autres commandes principales à 44px. Padding inférieur de palette et aperçu intégrant env(safe-area-inset-bottom).

## Elevation & Depth

La profondeur vient des fonds et contours. Des ombres ponctuelles existent ; ne pas transformer ce parti pris plat en interdiction globale.

### Shadow Vocabulary

- **Anneau de fichier** : `0 0 0 2px var(--color-accent)`, focus ou sélection dans la grille.
- **Toast** : `0 25px 50px -12px rgb(0 0 0 / 0.25)`, avec fond mélangeant 14% d’accent et léger flou du fond.
- **Fond modal** : crust mélangé à 80% avec du transparent, isolant la couche native.

**The Flat Surface Rule.** Les surfaces ordinaires restent plates. Réserver ombres et anneaux aux sélections et notifications flottantes.

## Shapes

Arrondis modérés : compact sur notation clavier et petits éléments, moyen sur commandes et lignes, plus ample sur dépôt, aperçu partagé et modales. Pastilles et fermetures rondes : exceptions fonctionnelles. Contours fins pour champs et groupes ; pointillés pour le dépôt. Le média est clippé au conteneur. Sur consultation mobile, la carte globale perd contour, fond et arrondi ; seul le média conserve son arrondi de 8px et son plafond de 32vh.

## Components

### Buttons

Actions explicites, poids moyen, sans levitation. Primaire : accent actif / on-accent ; au survol, mélange à 76% d’accent avec 24% de noir en clair ou de blanc en sombre ; à l’activation, 64% d’accent avec 36% de noir ou de blanc. Secondaire : surface neutre et contour ; survol surface1, bordure overlay1 et texte principal ; activation surface2. Danger : au survol, mélange à 18% de red sur mantle, texte et contour red. Les transitions couleur durent 150ms et les survols s’appliquent uniquement aux dispositifs qui les prennent en charge. Focus global : contour de 2px décalé de 3px, réduit à 1px pour champs. Actions désactivées identifiables et atténuées.

### Chips

Les formats Link, Markdown, HTML et BBCode sont des boutons avec aria-pressed. Sur mobile, champ et copie viennent avant les formats dans le DOM et dans l’affichage ; More formats révèle les variantes avancées. Desktop montre les quatre choix avant le champ. Le QR est une disclosure séparée sur mobile : Show QR code, summary natif présenté en bouton neutre de 44px, avec chevron SVG qui pivote de 180° en 150ms à l’ouverture ; le bloc Markdown dupliqué a été retiré. Sélection : texte et bordure accentués sur surface neutre ; repos : contour neutre. Les options de thème suivent ce langage. Le survol d’un choix actif conserve le contour et le texte accentués sur une surface neutre plus dense.

### Cards / Containers

Contenu sur mantle, contour neutre, padding issu de l’échelle. Résultats et lignes plats ; fichiers sélectionnés et toasts utilisent les traitements de profondeur documentés.

### Inputs / Fields

Texte lisible et caret accentué. Champs texte : bordure overlay1 imposée par la feuille globale. Une URL readonly reste sélectionnable. Erreurs et confirmations portent un message explicite ; la copie conserve un recours manuel.

### Navigation

Marque compacte, actions textuelles, compte présent au tactile. Les liens textuels sont accentués et soulignés dès le repos : trait 1px, décalage 0.25em, puis trait 2px au survol et au focus. Les liens présentés en boutons, la marque et le lien de saut gardent leur propre traitement. Les indications de raccourcis peuvent disparaître aux petites largeurs. Un lien de saut au contenu apparaît au focus.

### Mobile file collection

Une collection unique de lignes, avec checkbox dans une cible de 44px, titre repliable et métadonnées lisibles. View file et Copy link restent visibles dans deux colonnes de 44px. Sélection : contour accentué et fond à 10% d’accent sur mantle. La barre de sélection devient sticky en haut avec actions sur deux colonnes. Les conseils clavier et Recent restent desktop.

### File handoff

Dépôt, collage et choix convergent vers des résultats récupérables. Progression dans la zone d’upload ; fichiers terminés disponibles après un échec partiel. Le refus de lot nomme le fichier en échec ; si le format est refusé, il propose image, vidéo, audio, PDF ou ZIP et indique que les fichiers déjà terminés restent disponibles au-dessus. Chaque URL reste affichée après copie réussie. Le workspace libère l’état busy avant l’appel au presse-papiers natif pour ne pas bloquer l’upload derrière une demande système. Sur consultation mobile, Download file occupe toute la largeur en primaire avant le champ de partage. Le choix de fichier porte une action visible. Au survol, le dépôt passe sur surface0, sa bordure devient accentuée et son CTA prend la couleur de survol primaire. Les tuiles de la grille ajoutent un contour intérieur accentué de 3px, sans masquer leur contenu ; le focus et la sélection conservent leur anneau extérieur de 2px.

### Dialogs, feedback and tips

Utiliser dialog natif avec focus initial, confinement et retour au déclencheur. Erreurs annoncées, confirmations en statut. Lignes : arrivée sur 6px en 500ms. Toast : 150ms avec déplacement de 12px. Mouvement réduit : supprime arrivée des lignes et déplacement des toasts, conserve les changements d’état. Conseils : changement uniquement avec Next tip.

Le verdict initial de livraison de la revue indépendante a été rejeté par la revue utilisateur sur la qualité visuelle : sombre trop vert, liens indistincts au repos et survols absents. Une seconde revue utilisateur a ensuite rejeté la composition mobile et le verdict de livraison précédent. Le système documenté intègre la refonte mobile actuelle ; la revue finale a résolu le QR mobile (P2) et le refus d’upload partiel (P3), avec verdict de livraison limité à ces deux corrections. L’activation pointeur/Space et les résultats de tests ont été rapportés par l’agent principal, sans nouvelle exécution par ce reviewer. Aucun verdict global de livraison n’est acquis. Aucun verdict ne certifie téléphone physique, lecteur d’écran, zoom 200% ou conformité AA globale ; ces vérifications dédiées restent à faire.

## Do's and Don'ts

### Do:

- Do rendre les liens textuels visibles au repos et les états hover/active perceptibles.
- Do conserver l’anglais des libellés et le nom Echo Link.
- Do donner aux contrôles tactiles principaux une cible de 44px.
- Do conserver un lien sélectionnable lorsque la copie échoue.
- Do vérifier titres longs, thèmes et états de chargement, échec et sélection.
- Do respecter le mouvement réduit et laisser les conseils avancer sur action explicite.

### Don't:

- Don't réintroduire Catppuccin, halos décoratifs, fond à points ou logo géant.
- Don't cacher une fonction principale derrière le survol ou un raccourci clavier.
- Don't confondre upload réussi et copie réussie.
- Don't revendiquer une certification AA, lecteur d’écran, téléphone physique ou zoom 200% sans vérification dédiée.
