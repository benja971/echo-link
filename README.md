# echo-link

Service auto-hébergé de partage de fichiers : déposez un fichier, obtenez une URL partageable et servez le contenu depuis votre propre stockage S3/MinIO. L'application privilégie les liens courts, les aperçus Open Graph et une utilisation rapide au clavier.

## Fonctionnalités

- Dépôt, collage et sélection de plusieurs fichiers anonymes.
- Comptes par magic link et espace `/app` pour gérer fichiers, titres et slugs.
- Pages de partage `/v/:uuid-ou-slug`, métadonnées Open Graph, QR code et formats de copie.
- Proxy `/files/*` vers un bucket S3 privé, avec streaming des médias.
- Validation par magic bytes, miniatures WebP d'images et miniatures vidéo via FFmpeg.
- Expiration, quotas configurables et nettoyage quotidien.
- Bot Discord séparé, PWA installable et thèmes clair/sombre avec quatre accents.

## Architecture

| Emplacement       | Rôle                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| `apps/web`        | SvelteKit 2 : interface, API et pages de partage. Runtime Bun.                  |
| `apps/bot`        | Bot Discord `discord.js`, exécuté avec Bun.                                     |
| `packages/db`     | Schéma Drizzle, client PostgreSQL et migrations.                                |
| `apps/api-legacy` | Application v1 Express/React, conservée comme référence et non utilisée par v2. |

`POST /api/upload` reçoit un `multipart/form-data`, détecte le type réel du fichier, applique les limites de session ou anonymes, stocke l'objet dans S3 puis persiste ses métadonnées dans PostgreSQL. Les fichiers ne sont pas publics dans MinIO : `/files/[...path]` les sert à travers l'application.

Types acceptés : images JPEG/PNG/GIF/WebP/AVIF, vidéos MP4/WebM/MOV, audio MP3/WAV/OGG/FLAC, ZIP/7z/TAR/GZip et PDF.

## Démarrage local

Prérequis : Bun `>= 1.1`, PostgreSQL, un stockage S3 compatible et FFmpeg pour les miniatures vidéo. Docker Compose v2 est optionnel.

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run db:migrate
bun run dev
```

Le serveur Vite écoute habituellement sur `http://localhost:5173`. Lancez le bot dans un autre terminal, après configuration de ses secrets :

```bash
bun run dev:bot
```

Le schéma exécuté par `apps/web/src/lib/server/env.ts` rejette une configuration sans variables PostgreSQL, S3, URLs publiques, Resend, `SESSION_SECRET` ou `ANONYMOUS_IP_SALT`.

### Docker local

`docker-compose.yml` démarre `web`, `bot`, PostgreSQL et MinIO, puis crée le bucket sans le rendre public.

```bash
docker compose up --build
docker compose run --rm --entrypoint sh web -c 'cd packages/db && bun src/migrate.ts'
curl http://localhost:3000/api/health
```

Les identifiants MinIO et PostgreSQL de ce compose sont réservés au développement.

## Configuration

Les modèles sont [`.env.example`](.env.example) pour le local et [`.env.production.example`](.env.production.example) pour la production.

- `PUBLIC_BASE_URL` est l'URL externe des pages de partage.
- `CDN_PUBLIC_BASE_URL` est la base des URLs de contenu. Mettez-la égale à `PUBLIC_BASE_URL` quand `/files/*` est servi par l'application.
- `DATABASE_*` et `S3_*` configurent PostgreSQL et le stockage objet.
- `RESEND_API_KEY` et `EMAIL_FROM` servent aux magic links. L'expéditeur doit être vérifié par Resend.
- `SESSION_SECRET` doit avoir au moins 32 caractères, `ANONYMOUS_IP_SALT` au moins 16.
- `FILE_EXPIRATION_DAYS`, `MAX_PER_USER` et `MAX_SIZE_MB_PER_USER` règlent les limites de compte.
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

## Production

`docker-compose.prod.yml` expose l'application sur `127.0.0.1:3006` et rejoint le réseau Docker externe `infra-net`, où PostgreSQL et MinIO doivent déjà être accessibles. `deploy.sh` vérifie l'environnement, construit les images, applique les migrations dans le conteneur web, démarre les services et interroge `/api/health`.

```bash
./deploy.sh
```

Le proxy inverse doit envoyer le trafic HTTPS vers `127.0.0.1:3006`. Ne rendez pas le bucket S3 public.

## Vérification

```bash
bun run test
bun run lint
bun run build
```

Les tests de régression couvrent le clavier, les modales, la copie avec repli, les suppressions partielles, la migration des thèmes, les contrastes des tokens et les formats de partage. Le suivi des corrections UI et des validations navigateur est dans [l’audit d’interface](docs/audits/2026-10-05-interface.md).

Avant déploiement, vérifiez un upload anonyme, un magic link avec réception réelle de l’email, un upload authentifié, une page `/v/...`, le téléchargement `/files/...` et les aperçus dans le client de messagerie visé. Les tests locaux ne certifient pas les lecteurs d’écran, les téléphones physiques ou tous les navigateurs.

## Documentation connexe

- [Intégration Discord](docs/discord-bot.md)
- [`docs/superpowers/`](docs/superpowers/) contient les archives de conception et de migration v2, pas une procédure opérationnelle.
