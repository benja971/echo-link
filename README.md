# Echo-Link

Partage de fichiers auto-hébergé : interface SvelteKit, bot Discord, PostgreSQL et MinIO/S3. Monolithe modulaire côté web, avec un bot séparé. Bun gère les workspaces et le serveur de production utilise `adapter-node` exécuté par Bun.

## Fonctionnalités

- Dépôt, collage et sélection de plusieurs fichiers, anonymes ou authentifiés.
- Comptes par magic link et espace `/app` pour gérer fichiers, titres et slugs.
- Pages de partage `/v/:uuid-ou-slug`, métadonnées Open Graph, QR code et formats de copie.
- Proxy `/files/*` vers un bucket S3 privé, avec streaming des médias.
- Validation par magic bytes, miniatures WebP d'images et miniatures vidéo via FFmpeg.
- Expiration, quotas configurables et nettoyage périodique.
- Bot Discord séparé, PWA installable et thèmes clair/sombre avec quatre accents.

Types acceptés : images JPEG/PNG/GIF/WebP/AVIF, vidéos MP4/WebM/MOV, audio MP3/WAV/OGG/FLAC, ZIP/7z/TAR/GZip et PDF.

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
bun run test              # backend et régressions UI
bun run build             # web et bot
bun run check             # lint + tests + build
bun run test:integration  # serveur construit + PostgreSQL/MinIO isolés via Docker
```

La CI exécute les mêmes contrôles et les tests d’intégration à chaque push et pull request. Les tests UI couvrent le clavier, les modales, la copie avec repli, les suppressions partielles, la migration des thèmes, les contrastes des tokens et les formats de partage. Le suivi des corrections UI et des validations navigateur est dans [l’audit d’interface](docs/audits/2026-10-05-interface.md).

Les tests d'intégration créent leurs propres conteneurs et secrets éphémères, sans lire `.env.production`. Construire le projet avant de les lancer. Les tests stockage utilisent un serveur S3 simulé; les tests HTTP utilisent un vrai MinIO, compilé par Docker depuis un commit amont fixé dans `tests/integration/Minio.Dockerfile`. Le premier lancement nécessite le téléchargement des sources et dépendances Go; les suivants réutilisent le cache Docker.

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

## Configuration

Les modèles sont [`.env.example`](.env.example) pour le local et [`.env.production.example`](.env.production.example) pour la production.

- `PUBLIC_BASE_URL` est l'URL externe des pages de partage.
- `CDN_PUBLIC_BASE_URL` est la base des URLs de contenu. Mettez-la égale à `PUBLIC_BASE_URL` quand `/files/*` est servi par l'application.
- `DATABASE_*` et `S3_*` configurent PostgreSQL et le stockage objet.
- `RESEND_API_KEY` et `EMAIL_FROM` servent aux magic links. L'expéditeur doit être vérifié par Resend.
- `SESSION_SECRET` doit avoir au moins 32 caractères, `ANONYMOUS_IP_SALT` au moins 16.
- `FILE_EXPIRATION_DAYS`, `MAX_PER_USER` et `MAX_SIZE_MB_PER_USER` règlent les limites de compte standard.
- `ANON_*` configure le mode public anonyme.
- `DISCORD_*`, `ECHOLINK_BOT_TOKEN` et `ECHOLINK_BASE_URL` configurent le bot.

Générez les secrets avec `openssl rand -hex 32` et `openssl rand -hex 16`.

## Endpoints utiles

| Méthode | Route               | Usage                                                  |
| ------- | ------------------- | ------------------------------------------------------ |
| `GET`   | `/api/health`       | Health check.                                          |
| `POST`  | `/api/upload`       | Upload anonyme ou authentifié, champ multipart `file`. |
| `POST`  | `/api/auth/request` | Demande de magic link, JSON `{ "email": "..." }`.      |
| `POST`  | `/api/auth/logout`  | Supprime la session courante.                          |
| `GET`   | `/files/[...path]`  | Stream d'un objet enregistré.                          |
| `GET`   | `/v/[id]`           | Page de partage par UUID ou slug.                      |
| `POST`  | `/api/cleanup`      | Purge les fichiers expirés, Bearer `CLEANUP_TOKEN`.    |

`/api/upload` est une API navigateur, sans Bearer token générique. Sans cookie de session, elle applique les limites anonymes :

```bash
curl -X POST http://localhost:5173/api/upload -F 'file=@/chemin/vers/image.png'
```

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

`docker-compose.prod.yml` expose l'application sur `127.0.0.1:3006` et rejoint le réseau Docker externe `infra-net`, où PostgreSQL et MinIO doivent déjà être accessibles. Le proxy inverse doit envoyer le trafic HTTPS vers ce port. Ne rendez pas le bucket S3 public.

```bash
./deploy.sh
```

Le reverse proxy peut imposer sa propre limite ou son propre timeout : les adapter au plafond choisi. Pour les quotas anonymes par IP derrière un proxy de confiance, configurer `ADDRESS_HEADER=x-forwarded-for` et `XFF_DEPTH` pour le nombre réel de proxies. Le web doit rester accessible uniquement par ce proxy, comme dans `docker-compose.prod.yml` (port publié sur `127.0.0.1`). Ne pas faire confiance aux headers IP d'un client qui pourrait joindre directement le web.

Le nettoyage s'exécute au premier passage puis toutes les heures. `/api/cleanup` permet aussi un déclenchement protégé par `CLEANUP_TOKEN`. Les suppressions S3 échouées restent suivies en base pour être réessayées.

## Vérification avant déploiement

Vérifiez un upload anonyme, un magic link avec réception réelle de l’email, un upload authentifié, une page `/v/...`, le téléchargement `/files/...` et les aperçus dans le client de messagerie visé. Les tests locaux ne certifient pas les lecteurs d’écran, les téléphones physiques ou tous les navigateurs.

## Documentation connexe

- [Architecture backend](docs/architecture.md)
- [Recherche sur les quotas d'upload](docs/upload-quota-research.md)
- [Design system](apps/web/DESIGN.md)
- [Audit d’interface](docs/audits/2026-10-05-interface.md)
- [Intégration Discord](docs/discord-bot.md)
- [`docs/superpowers/`](docs/superpowers/) contient les archives de conception et de migration v2, pas une procédure opérationnelle.
