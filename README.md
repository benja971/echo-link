# Echo-Link

Partage de fichiers auto-hébergé : interface SvelteKit, bot Discord, PostgreSQL et MinIO/S3. Monolithe modulaire côté web, avec un bot séparé. Bun gère les workspaces et le serveur de production utilise `adapter-node` exécuté par Bun.

## Développer

Prérequis : Bun 1.3+, Node.js 20+ pour les clients des tests d’intégration, Docker et Docker Compose. `ffmpeg` sert aux miniatures vidéo; il est inclus dans l'image de production.

```bash
bun install --frozen-lockfile
cp .env.example .env
# Compléter les secrets, RESEND_API_KEY et EMAIL_FROM dans .env.
docker compose up -d postgres minio minio-init
bun run db:migrate
bun run dev
```

L'interface est sur http://localhost:5173. MinIO est privé : les téléchargements passent par `/files/*`. Resend fournit les liens de connexion; les identifiants SMTP de l'ancienne application ne sont plus utilisés.

```bash
bun run dev:bot           # bot Discord, avec ses identifiants configurés
bun run lint              # Svelte + TypeScript web, DB et bot
bun run test              # réception, limites, HTTP et stockage
bun run build             # web et bot
bun run check             # lint + tests + build
bun run test:integration  # serveur construit + PostgreSQL/MinIO isolés via Docker
```

La CI exécute les mêmes contrôles et les tests d’intégration à chaque push et pull request.

Les tests d'intégration créent leurs propres conteneurs et secrets éphémères, sans lire `.env.production`. Construire le projet avant de les lancer. Les tests stockage utilisent un serveur S3 simulé; les tests HTTP utilisent un vrai MinIO.

Sur NixOS, Sharp peut nécessiter `libstdc++.so.6` dans `LD_LIBRARY_PATH`. Utiliser l'environnement de développement Nix de la machine; ce problème ne concerne pas l'image Alpine ou le runner Ubuntu.

## Organisation

```text
apps/web/src/lib/server/
  accounts/      sessions, identités, tiers et réservations atomiques
  uploads/       réception multipart, validation, capacité et orchestration
  storage/       objets S3 et miniatures depuis le disque
  files/         métadonnées PostgreSQL et URLs lisibles
  integrations/  Resend et Discord
  lifecycle/     suppression et reprise du nettoyage
  http/          limitation des petits corps de requête
  env.ts         configuration validée
apps/web/src/routes/   adaptations HTTP et pages SvelteKit
apps/web/tests/        tests des modules backend
apps/bot/              commandes Discord
packages/db/           schéma et migrations Drizzle
scripts/               opérations contrôlées sur les comptes
```

Une route traduit HTTP vers un module métier. Le parcours partagé `uploads/service.ts` possède l'upload de bout en bout, y compris réservation, temporaires, validation, stockage et compensation. Les règles de quotas vivent dans `accounts/`, pas dans les routes ou le navigateur. Voir [l'architecture](docs/architecture.md) pour les invariants et le parcours d'un fichier.

`apps/api-legacy/` et `public/app/` conservent l'ancienne implémentation. Ils ne font pas partie des workspaces actifs, du build ou du routage de production. Les anciens documents sous `docs/superpowers/` décrivent la migration v2; ce README et `docs/architecture.md` décrivent le code courant.

## Quotas et tiers

| Profil     | Fichiers conservés           | Stockage cumulé               | Taille d'un transfert                             |
| ---------- | ---------------------------- | ----------------------------- | ------------------------------------------------- |
| Anonyme    | 3 uploads/IP/fenêtre de 24 h | Borné par taille et fréquence | 50 Mio                                            |
| `standard` | 25                           | 500 Mio                       | Au plus le quota disponible et la borne technique |
| `trusted`  | Illimité                     | Illimité                      | Borne technique configurable                      |

Valeurs par défaut. Tous les comptes commencent en `standard`. Le tier est lu en base à chaque upload et ne donne aucun droit d'administration.

```bash
bun run set-upload-tier -- utilisateur@example.com trusted
bun run set-upload-tier -- utilisateur@example.com standard
# Un UUID de compte peut remplacer l'email.
```

En production, depuis le checkout du serveur :

```bash
docker compose -f docker-compose.prod.yml exec web bun scripts/set-upload-tier.ts utilisateur@example.com trusted
```

Le script refuse un email ambigu. Il change uniquement le tier; il ne crée pas de compte. La rétention reste de 10 jours par défaut, y compris pour `trusted`.

## Gros fichiers

La requête multipart est lue en flux vers un temporaire privé, puis vérifiée par ses magic bytes et transférée en multipart S3. Les originaux ne sont jamais chargés en entier dans un Buffer. Les miniatures sont facultatives, bornées et synchrones avant suppression du temporaire.

Les limites techniques sont dans `.env.example` et `.env.production.example` :

- `UPLOAD_MAX_SIZE_MB=1024` : 1 Gio par fichier, configurable jusqu'à 64 Gio.
- `UPLOAD_MAX_CONCURRENT=2` : uploads actifs par processus.
- `UPLOAD_TIMEOUT_SECONDS=1800` : budget de 30 minutes pour le parcours principal.
- `UPLOAD_MIN_FREE_SPACE_MB=512` : espace libre minimum sur le volume temporaire.
- `UPLOAD_TEMP_DIR=/tmp/echo-link-uploads` : répertoire des temporaires.
- `BODY_SIZE_LIMIT=Infinity` : l'application contrôle les octets réels; les autres corps de requête sont limités à 64 Kio.

`X-Upload-Size` indique la taille exacte du fichier, indépendamment de l'enveloppe multipart; le client web l'envoie. Les clients sans ce header réservent le budget disponible avant la lecture, ce qui peut réduire les uploads simultanés d'un même compte. Un header mensonger ne permet pas de dépasser le budget. Une requête contient un seul fichier et au plus quatre petits champs.

## Déployer

Les migrations sont additives. Le script existant `deploy.sh` applique les migrations avant le redémarrage du web et du bot. Compléter `.env.production` depuis l'exemple, puis utiliser la procédure de déploiement habituelle. `MAX_SIZE_MB` de l'ancienne implémentation est remplacé par `UPLOAD_MAX_SIZE_MB`.

Le reverse proxy peut imposer sa propre limite ou son propre timeout : les adapter au plafond choisi. Pour les quotas anonymes par IP derrière un proxy de confiance, configurer `ADDRESS_HEADER=x-forwarded-for` et `XFF_DEPTH` pour le nombre réel de proxies. Le web doit rester accessible uniquement par ce proxy, comme dans `docker-compose.prod.yml` (port publié sur `127.0.0.1`). Ne pas faire confiance aux headers IP d'un client qui pourrait joindre directement le web.

Le nettoyage s'exécute au premier passage puis toutes les heures. `/api/cleanup` permet aussi un déclenchement protégé par `CLEANUP_TOKEN`. Les suppressions S3 échouées restent suivies en base pour être réessayées.
