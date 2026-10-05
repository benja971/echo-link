# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Echo Link est un service auto-hébergé de partage de fichiers. Déposer ou coller un fichier produit un lien partageable, avec une page de consultation et de téléchargement.

## Operating Context

Interface SvelteKit, PostgreSQL et stockage S3 compatible. Upload anonyme configurable ; comptes par magic link ; workspace pour gérer les fichiers, titres et URLs. Utilisation clavier, souris et tactile, y compris téléphone.

## Capabilities and Constraints

Préserver les limites et expirations configurées, les lots de fichiers, aperçus média, formats de copie, QR codes, thèmes, commandes clavier et gestion des fichiers. Afficher un résultat récupérable même lorsque la copie automatique échoue. Ne pas modifier les contrats backend pendant la refonte UI.

## Brand Commitments

Nom Echo Link conservé. L’utilisateur a demandé de remplacer la palette Catppuccin et de conserver l’anglais dans l’interface. Le style décoratif actuel et ses défauts responsive ont été explicitement rejetés.

## Evidence on Hand

README du dépôt, implémentation et audit `../../docs/audits/2026-10-05-interface.md`. Captures et données de test synthétiques identifiées dans cet audit. Aucune preuve commerciale à inventer.

## Product Principles

- L’upload, les limites et les liens récupérables passent avant la décoration.
- Toutes les fonctions principales restent accessibles sans clavier physique.
- États de succès et d’échec correspondent au résultat réel.
- Le thème et les raccourcis accompagnent l’utilisation sans compliquer le parcours.

## Open Decisions

Audience publique et positionnement commercial non définis dans cette session. Ne pas inventer de personas, témoignages ou avantages concurrentiels.
