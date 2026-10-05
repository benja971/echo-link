# Intégration Discord

Le bot est une application Bun distincte (`apps/bot`) bâtie avec `discord.js`. Il enregistre deux slash commands : `/upload`, qui demande une session, et `/link code:ABC-123`, qui lie une identité Discord à un compte Echo-Link.

## Configuration

Créez une application Discord, ajoutez un bot, puis invitez-le avec les scopes `bot` et `applications.commands`. La permission `Send Messages` suffit aux commandes actuelles.

```env
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
# ID de serveur en développement, vide pour les commandes globales en production.
DISCORD_GUILD_ID=
ECHOLINK_BOT_TOKEN=un-secret-aleatoire-partage-avec-web
ECHOLINK_BASE_URL=http://localhost:5173
```

Générez `ECHOLINK_BOT_TOKEN` avec `openssl rand -hex 32`. En Docker, utilisez `ECHOLINK_BASE_URL=http://web:3000`.

```bash
bun install --frozen-lockfile
bun run db:migrate
bun run dev
# Dans un autre terminal
bun run dev:bot
```

Pour la production : `bun run build`, puis `bun run start` et `bun run start:bot`.

## API interne

Ces routes requièrent `Authorization: Bearer <ECHOLINK_BOT_TOKEN>` et ne sont pas une API publique.

### Session d'upload

`POST /api/discord/upload-session`

```json
{
  "discordUserId": "123456789",
  "discordChannelId": "111222333",
  "discordInteractionToken": "optionnel"
}
```

La réponse contient un token, une URL `/discord/upload/<token>` et une expiration de 30 minutes. Cette URL redirige vers `/app?discord_session=<token>`.

### Liaison de compte

Un utilisateur authentifié crée un code avec `POST /api/me/discord/link/start`, puis lance `/link`. L'API attend :

`POST /api/discord/link`

```json
{
  "code": "ABC-123",
  "discordUserId": "123456789",
  "discordDisplayName": "pseudo"
}
```

Elle renvoie `linked`, `already_linked` ou `merged`. Une fusion rattache au compte web les fichiers du compte Discord préexistant.

## Limite connue

Le client du bot n'est pas encore aligné sur ce contrat : il envoie les identifiants de `/upload` en en-têtes, sans JSON, et n'envoie que `code` pour `/link`. Les routes web valident ces données dans le corps JSON, donc les deux commandes ne peuvent pas aboutir actuellement.

Le token `discord_session` n'est pas non plus consommé par l'interface `/app`. Le flux Discord doit être corrigé et testé de bout en bout avant d'être présenté comme disponible.
