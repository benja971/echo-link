# Discord Bot Integration

This document explains how to set up and use the Echo-Link Discord bot.

## Overview

The Discord bot allows users to upload **large files** directly from their browser to Echo-Link, initiated via a Discord slash command. This bypasses Discord's file size limits.

## Architecture

### Why Browser Upload?

Discord imposes strict file size limits on attachments (8-25MB depending on server boost level). Echo-Link is designed for **large files** (videos, archives, etc.), so having the bot transport files would defeat the purpose.

Instead:
1. User runs `/upload` in Discord (no file attached)
2. Bot creates an **upload session** on Echo-Link
3. Bot returns a **one-time upload URL**
4. User clicks the link → opens Echo-Link in browser
5. User selects their large file → uploads directly to Echo-Link
6. Echo-Link returns the share URL

### Flow Diagram

```
Discord User → /upload (no attachment)
           ↓
     Discord Bot
           ↓
  POST /discord/upload-session
  Authorization: Bearer <ECHOLINK_BOT_TOKEN>
  X-Discord-User-Id: 123456789
  X-Discord-User-Name: username
  X-Discord-Channel-Id: 111222333
  X-Discord-Guild-Id: 987654321
           ↓
    Echo-Link API
           ↓
  Creates upload_identity for Discord user
  Creates discord_upload_session (expires in 15 min)
  Returns: { uploadUrl: "/discord/upload/<token>" }
           ↓
     Discord Bot
           ↓
  Replies with button: "📤 Ouvrir la page d'upload"
           ↓
    User clicks → Browser opens Echo-Link upload page
           ↓
    User selects file → Direct upload to Echo-Link
           ↓
    Echo-Link returns shareUrl
```

## Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Copy the bot token (keep it secret!)
5. Go to "OAuth2" > "URL Generator"
6. Select scopes: `bot`, `applications.commands`
7. Select permissions: `Send Messages`
8. Use the generated URL to invite the bot to your server

### 2. Environment Variables

Add the following to your `.env` file:

```env
# Discord Bot Token (from Discord Developer Portal)
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-application-id
# Guild ID for development (instant). Leave empty for global commands in production.
DISCORD_GUILD_ID=your-server-id-for-dev

# Echo-Link API URL (where the bot will send uploads)
ECHOLINK_BASE_URL=https://echo-link.example.com

# Technical token for bot authentication (generate a secure random string)
ECHOLINK_BOT_TOKEN=your-secure-random-token-at-least-32-chars
```

Generate a secure `ECHOLINK_BOT_TOKEN`:
```bash
openssl rand -hex 32
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Database Migrations

The bot requires the `upload_identities` and `discord_upload_sessions` tables:

```bash
npm run dev:api  # Runs migrations automatically
```

## Running

### Development

```bash
# Terminal 1: API server
npm run dev:api

# Terminal 2: Discord bot
npm run dev:bot
```

### Production

```bash
npm run build
npm run start:api  # Start API server
npm run start:bot  # Start Discord bot
```

## Usage

1. In any Discord channel, type: `/upload`
2. Bot replies with a button: "📤 Ouvrir la page d'upload"
3. Click the button → Browser opens Echo-Link upload page
4. Select your file (any size!) and upload
5. Copy the share URL and paste it in Discord

## Upload Sessions

Each `/upload` command creates a session that:
- Expires in **15 minutes**
- Can only be used **once**
- Is tied to the Discord user's identity

## Quotas and Limits

Quotas are enforced per **Discord user identity**, not per session:

| Limit | Value |
|-------|-------|
| Files per 24h | 50 |
| Bytes per 24h | 2 GB |
| Total files | 500 |
| Total storage | 10 GB |

## Database Schema

### Upload Sessions

```sql
discord_upload_sessions (
  id UUID PRIMARY KEY,
  token VARCHAR(64) UNIQUE,       -- Used in upload URL
  upload_identity_id UUID,        -- Link to user identity
  discord_user_id TEXT,
  discord_user_name TEXT,
  discord_channel_id TEXT,
  discord_guild_id TEXT,
  status TEXT,                    -- 'pending', 'completed', 'expired'
  file_id UUID,                   -- Linked after upload
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
```

## API Endpoints

### Create Upload Session
```
POST /discord/upload-session
Authorization: Bearer <ECHOLINK_BOT_TOKEN>
X-Discord-User-Id: 123456789
X-Discord-User-Name: username
X-Discord-Channel-Id: 111222333
X-Discord-Guild-Id: 987654321

Response:
{
  "sessionId": "uuid",
  "uploadUrl": "https://echo-link.example.com/discord/upload/<token>",
  "expiresAt": "2024-01-01T12:15:00Z"
}
```

### Upload Page
```
GET /discord/upload/:token
→ Renders HTML upload page
```

### File Upload
```
POST /discord/upload/:token
Content-Type: multipart/form-data
file: <binary>

Response:
{
  "id": "uuid",
  "shareUrl": "https://echo-link.example.com/v/uuid",
  "directUrl": "https://echo-link.example.com/files/videos/uuid.mp4"
}
```

## Security

1. **Bot Token**: `ECHOLINK_BOT_TOKEN` authenticates the bot to the API
2. **Session Tokens**: One-time, short-lived (15 min), tied to Discord user
3. **Identity Isolation**: Each Discord user has their own quotas
4. **HTTPS**: Always use HTTPS in production
