# Audit initial des limites d'upload

Recherche du 5 octobre 2026, avant la refonte. État du code au commit `a81f614`. Les chemins cités ci-dessous désignent cette version historique; consulter [architecture.md](architecture.md) pour le fonctionnement actuel. Audit du dépôt uniquement, sans accès au VPS ni aux secrets. Aucun changement applicatif. Les choix ci-dessous sont des recommandations pour Echo-Link, distinctes des comportements documentés des dépendances.

## État constaté

L'application active est `apps/web`, exécutée avec Bun 1.3 dans le `Dockerfile`. Son `apps/web/package.json` déclare `@sveltejs/adapter-node` avec `^5.2.0`; `bun.lock` résout 5.5.4. `npm start` prévoit Node. Ce n'est pas `adapter-bun`.

| Utilisateur | Limites applicatives par défaut                                                     |
| ----------- | ----------------------------------------------------------------------------------- |
| Authentifié | 25 fichiers et 500 MiB cumulés par **compte**, aucune limite individuelle explicite |
| Anonyme     | 50 MiB par fichier, 3 fichiers par IP sur une fenêtre glissante de 24 heures        |

Sources locales : `apps/web/src/lib/server/env.ts`, `apps/web/src/lib/server/upload.ts`, `apps/web/src/lib/server/files.ts`, `apps/web/src/lib/server/anonymous.ts`. La fenêtre anonyme dépend de `ANON_EXPIRATION_HOURS`, malgré le nom `ANON_MAX_PER_IP_PER_DAY`. `MAX_SIZE_MB=100` reste configuré mais n'est pas utilisé dans le flux actif d'upload.

Les points qui empêchent de simplement retirer les quotas :

- `apps/web/src/routes/api/upload/+server.ts` et `apps/web/src/routes/share-target/+server.ts` font `request.formData()`, puis `file.arrayBuffer()` avant les validations de taille. `processAndStoreUpload` commence par les magic bytes. Le fichier complet est donc déjà matérialisé en mémoire avant le refus de quota, même sans présumer comment Bun implémente `formData()`.
- `apps/web/src/lib/server/s3.ts` transmet un `Buffer` complet à `PutObjectCommand`. Les `apps/web/src/lib/server/thumbnails.ts` conservent ce buffer et écrivent la vidéo entière dans un fichier temporaire avec `writeFileSync`.
- Le contrôle fait `SELECT` des statistiques, écriture S3, puis insertion DB, sans réservation. Deux uploads simultanés peuvent chacun voir assez de place et dépasser ensemble le quota. Le compteur anonyme présente aussi cette course.
- `packages/db/src/schema.ts` existe déjà et relie les identités web/Discord; aucun rôle ou tier. Le `apps/web/src/routes/app/+page.server.ts` renvoie les limites globales, et son `apps/web/src/routes/app/+page.svelte` suppose des nombres pour les ratios.
- La `apps/web/src/lib/server/discord.ts` transfère les fichiers vers le compte web cible et supprime l'ancien compte. Une future politique de tier devra préciser ce qui est conservé.

## Tiers pour la capacité, permissions pour l'administration

Recommandation : un attribut `accounts.uploadTier`, initialement `standard | trusted`, avec `standard` par défaut. Une fonction serveur unique résout les limites effectives à chaque requête depuis la DB :

| Tier       | Nombre de fichiers              | Stockage cumulé                        |
| ---------- | ------------------------------- | -------------------------------------- |
| `standard` | Valeur actuelle `MAX_PER_USER`  | Valeur actuelle `MAX_SIZE_MB_PER_USER` |
| `trusted`  | `null`, illimité au sens métier | `null`, illimité au sens métier        |

Cela couvre le créateur et des comptes choisis sans leur donner accès à l'administration. Un rôle `admin` ne devient utile que pour autoriser des opérations administratives; il ne doit pas être requis pour bénéficier de stockage supplémentaire. Commencer par une commande backend d'attribution contrôlée, sans créer de panneau admin ni système de facturation. `null` appartient aux limites résolues, pas à un override DB ambigu : persister seulement le tier. Conserver l'expiration actuelle, 10 jours par défaut, même pour `trusted`, sauf demande explicite de changer la rétention.

Le tier ne vient jamais du payload client, d'une adresse email déclarée ou d'un cookie de session ancien. Toute identité liée bénéficie de la même politique de **compte**. Lors d'une fusion Discord, conserver le tier du compte cible, sans élévation automatique; l'opérateur peut réattribuer explicitement `trusted`. Une rétrogradation ou fusion dépassant le quota bloque les prochains uploads, sans supprimer les fichiers existants.

Cette séparation est un choix local. OWASP recommande le refus par défaut et la vérification des permissions sur chaque requête : [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). L'API et le workspace doivent utiliser le même résolveur; l'UI doit afficher « Illimité » pour `null`, sans division par `null`.

## Illimité métier, ressources techniques bornées

SvelteKit expose une limite **globale** de corps HTTP, `BODY_SIZE_LIMIT`, incluant la lecture en flux. Défaut : `512K`; `Infinity` désactive cette borne. Ce réglage ne dépend pas du tier. Sources : [documentation adapter-node](https://svelte.dev/docs/kit/adapter-node#BODY_SIZE_LIMIT) et [code officiel adapter-node 5.5.4 verrouillé dans le dépôt](https://github.com/sveltejs/kit/blob/%40sveltejs%2Fadapter-node%405.5.4/packages/adapter-node/src/handler.js), lignes 25 et 97-100.

Aucun `BODY_SIZE_LIMIT` trouvé dans la configuration versionnée examinée; la valeur effective de production n'est pas connue. Ne pas remplacer cette absence par une hypothèse sur les variables du VPS. `maxRequestBodySize` de `Bun.serve` n'est pas automatiquement le réglage de cet adapter-node.

Retirer seulement les quotas applicatifs autoriserait des buffers énormes. Sous Node, Undici consomme le corps avant de parser `formData()` : [source officielle](https://github.com/nodejs/undici/blob/main/lib/web/fetch/body.js). Ce détail interne Node n'est pas une preuve de l'implémentation Bun; `arrayBuffer()` dans le dépôt suffit à établir le problème.

OWASP recommande de borner la taille des uploads et de protéger la capacité de stockage : [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html#upload-and-download-limits). Pour `trusted`, conserver une borne technique configurable par transfert, une limite de simultanéité et un budget global de stockage disponible. Leur valeur doit dépendre du serveur réel, pas d'un nombre arbitraire choisi ici.

## Flux adapté aux gros fichiers

Deux voies raisonnables :

1. **Streaming via le backend**, compatible avec les points d'entrée actuels : authentifier/résoudre les limites avant la lecture; parser le multipart en flux avec limites de fichiers, champs et en-têtes; compter les octets réels et interrompre au dépassement; transmettre vers S3 en multipart ou vers un temporaire borné. Le `Content-Length` permet un refus anticipé, mais ne remplace jamais le compteur. Limiter également le corps multipart total, y compris les champs ignorés.
2. **Multipart direct navigateur vers S3**, plus adapté aux très gros fichiers et aux reprises : le backend réserve le quota et pilote les signatures, vérifie les parties réelles puis finalise. Stocker en zone privée jusqu'à validation MIME et taille; contrôler le nombre, la taille et la durée de vie des parties. Une simple URL PUT suivie d'un contrôle final laisse le stockage recevoir trop d'octets avant le refus.

Le streaming backend minimise les modifications du parcours existant; le direct réduit le transit par l'application mais exige un protocole de réservation/finalisation, une zone privée et des contrôles côté stockage. Pour les deux voies, traiter les miniatures depuis un fichier/flux avec simultanéité bornée, sans recréer un buffer vidéo entier.

AWS recommande le multipart à partir de 100 MB et permet de réessayer une partie seule : [multipart S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html). `@aws-sdk/lib-storage` accepte les flux et expose `partSize`, `queueSize` et `leavePartsOnError` : [README officiel](https://github.com/aws/aws-sdk-js-v3/tree/main/lib/lib-storage). C'est une extension du SDK déjà utilisé, à valider avec la version MinIO réellement déployée.

Les streams appliquent une backpressure; `highWaterMark` est un seuil, pas une limite mémoire stricte : [Node streams](https://nodejs.org/api/stream.html#buffering). Contrôler ensemble buffers, taille des parties et uploads simultanés. Le stockage conserve les parties multipart abandonnées jusqu'à finalisation/annulation; prévoir annulation immédiate et purge de secours : [lifecycle AWS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html).

Les URL présignées peuvent être réutilisées jusqu'à expiration : [documentation AWS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html). Un POST signé supporte `content-length-range`, spécifique à sa policy : [POST policy](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html). Ne pas supposer qu'une URL PUT fournit automatiquement la même garantie, ni transposer les plafonds AWS à MinIO sans vérifier sa version.

## Réserver le quota avant transfert

Recommandation : sous une courte transaction, verrouiller la ligne compte, calculer `utilisé + réservé + taille demandée`, vérifier bytes **et** nombre de fichiers, puis créer une réservation avec expiration. PostgreSQL documente le verrouillage exclusif de ligne par `SELECT ... FOR UPDATE` : [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

Libérer la transaction avant le transfert réseau. Pendant la réception, ne jamais dépasser la taille réservée; réserver davantage atomiquement avant d'accepter plus, ou annuler. Après validation, convertir la réservation en fichier stocké dans une transaction idempotente. Échec, déconnexion, crash et erreur DB après S3 doivent mener à une libération/réconciliation et au nettoyage des objets orphelins. Toutes les entrées doivent emprunter ce protocole, y compris web share et Discord.

## Critères de validation avant activation

Vérification de l'existant réalisée pendant l'audit : 9 assertions passent sur le bloc exact de validation de `upload.ts`, exécuté isolément sous Node avec dépendances simulées. Couverture : 500 MiB authentifiés acceptés malgré `MAX_SIZE_MB=100`, 501 refusés, quota cumulé et nombre de fichiers, bornes anonymes 50/51 MiB, compteur et désactivation. Deux uploads de 400 MiB lancés avec `Promise.all` et statistiques initiales vides sont tous deux admis, preuve de la course dans le contrôle isolé. Ce n'est pas un test de concurrence DB complet ni une vérification du VPS/proxy.

- `standard` garde exactement les quotas actuels; `trusted` dépasse ces quotas; un compte ordinaire ne peut choisir son tier.
- Requêtes dépassant la borne technique refusées avant matérialisation complète, avec et sans `Content-Length`, sur le serveur **buildé adapter-node + Bun**, pas seulement Vite dev.
- Deux uploads simultanés proches du quota ne le dépassent pas ensemble; déconnexion et reprise ne laissent ni réservation durable ni objet orphelin.
- Gros fichier de plusieurs GiB reçu avec mémoire bornée et miniatures bornées; échec S3/DB nettoyé.
- Upload web, share-target et identités Discord liées ont les mêmes limites effectives; UI gère `null`; fusion ne donne pas automatiquement `trusted`.

Ordre conseillé : tiers et résolution commune, protections avant allocation et réservation atomique, puis activation des gros uploads après migration du transport. Aucun de ces changements n'est implémenté par cette note.
