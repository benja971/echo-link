# echo-link

Service auto-hébergé pour partager des fichiers volumineux via Discord avec stockage MinIO/S3.

## 🎯 Fonctionnalités

- Upload de fichiers volumineux vers un stockage objet MinIO (compatible S3)
- Génération d'URLs de partage avec preview Discord (Open Graph)
- Support de la lecture vidéo intégrée dans Discord (MP4/H.264)
- Authentification par token Bearer pour les uploads
- Base de données PostgreSQL pour le tracking des fichiers
- Architecture modulaire et typée en TypeScript

## 🚀 Installation

### Prérequis

- Node.js >= 20.0.0
- PostgreSQL
- MinIO ou service S3-compatible
- Docker et Docker Compose (optionnel)

### Installation locale

1. **Cloner le dépôt**

```bash
git clone <repository-url>
cd echo-link
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Configurer les variables d'environnement**

Copier le fichier `.env.example` vers `.env` et ajuster les valeurs :

```bash
cp .env.example .env
```

Variables requises :

```env
# Server
PORT=3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=echo-link
DATABASE_SSL=0
DATABASE_LOGGING=0

# S3/MinIO Configuration
S3_ENDPOINT=localhost
S3_PORT=9000
S3_USE_SSL=false
S3_REGION=us-east-1
S3_BUCKET_NAME=echo-link
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Public URLs
PUBLIC_BASE_URL=https://echo-link.mondomaine.fr
CDN_PUBLIC_BASE_URL=https://files.mondomaine.fr

# Security
UPLOAD_TOKEN=your-secret-token-here
```

4. **Initialiser la base de données**

Exécuter la migration SQL :

```bash
psql -h localhost -U postgres -d echolink -f src/db/migrations/001_init_files.sql
```

5. **Lancer en développement**

```bash
npm run dev
```

6. **Build pour production**

```bash
npm run build
npm start
```

## 🐳 Déploiement

### Développement local

Le projet inclut un `docker-compose.yml` pour le développement :

```bash
# Lancer tous les services
docker-compose up -d

# Vérifier les logs
docker-compose logs -f echo-link

# Arrêter les services
docker-compose down
```

Services exposés :
- **echo-link** : http://localhost:3000
- **MinIO Console** : http://localhost:9001 (admin: minioadmin/minioadmin)
- **MinIO API** : http://localhost:9000
- **PostgreSQL** : localhost:5432

### Production

Pour un déploiement en production avec domaine public :

```bash
# 1. Copier et configurer .env.production
cp .env.production.example .env.production
nano .env.production

# 2. Configurer tes domaines DNS
# echo-link.ton-domaine.fr → IP serveur
# cdn.ton-domaine.fr → IP serveur

# 3. Build et lancer
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Vérifier
curl https://echo-link.ton-domaine.fr/health
```

**📖 Guide complet** : Voir [DEPLOYMENT.md](DEPLOYMENT.md) pour les instructions détaillées

## 📡 Utilisation

### Interface Web

L'interface web minimale est accessible à l'adresse racine du serveur :

```
http://localhost:3000/
```

Fonctionnalités :
- Champ pour saisir le token d'upload (UPLOAD_TOKEN)
- Sélection de fichier
- Upload et génération automatique du lien de partage

### Upload via API (curl)

```bash
curl -X POST http://localhost:3000/upload \
  -H "Authorization: Bearer your-secret-token-here" \
  -F "file=@/path/to/video.mp4"
```

Réponse :

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "shareUrl": "https://echo-link.mondomaine.fr/v/550e8400-e29b-41d4-a716-446655440000",
  "directUrl": "https://files.mondomaine.fr/videos/550e8400-e29b-41d4-a716-446655440000.mp4"
}
```

### Partage dans Discord

1. Copier la `shareUrl` retournée
2. La coller dans Discord
3. Discord affichera automatiquement un embed avec :
   - Titre et description
   - Thumbnail (si configuré)
   - Lecteur vidéo intégré (pour les vidéos MP4/H.264)

### Health check

```bash
curl http://localhost:3000/health
```

Réponse :

```json
{
  "status": "ok"
}
```

## 🏗️ Architecture

```
src/
├── server.ts              # Point d'entrée Express
├── config.ts              # Configuration et validation des variables d'environnement
├── routes/
│   ├── upload.ts          # POST /upload - Upload de fichiers
│   ├── public.ts          # GET /v/:id - Page publique avec Open Graph
│   └── health.ts          # GET /health - Health check
├── services/
│   ├── s3Service.ts       # Intégration MinIO/S3
│   └── fileService.ts     # Logique métier fichiers
└── db/
    ├── pool.ts            # Pool de connexions PostgreSQL
    └── migrations/
        └── 001_init_files.sql
```

## 🔐 Sécurité

- **Authentification** : Upload protégé par token Bearer
- **IDs non-devinables** : UUIDs v4 pour tous les fichiers
- **Validation** : Vérification stricte des variables d'environnement au démarrage
- **Expiration** : Support de TTL via `expires_at` (à implémenter via tâche cron)

## 🔧 Configuration reverse proxy

### Caddy

```caddy
echo-link.mondomaine.fr {
    reverse_proxy echo-link:3000
}

files.mondomaine.fr {
    reverse_proxy minio:9000
}
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name echo-link.mondomaine.fr;

    location / {
        proxy_pass http://echo-link:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name files.mondomaine.fr;

    client_max_body_size 1G;

    location / {
        proxy_pass http://minio:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📝 Configuration MinIO

Pour permettre l'accès public aux fichiers, configurer une policy sur le bucket :

```bash
mc alias set myminio http://localhost:9000 minioadmin minioadmin
mc mb myminio/echo-link
mc anonymous set download myminio/echo-link
```

## 🚧 Extensions futures

- [ ] Génération automatique de thumbnails pour vidéos
- [ ] Tâche cron de purge des fichiers expirés
- [ ] Filtrage MIME types
- [ ] Support de métadonnées personnalisées

## 📄 Licence

MIT
