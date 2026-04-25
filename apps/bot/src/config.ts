// Configuration for Discord bot
// Note: Bun loads .env files automatically; no dotenv import needed.
interface BotConfig {
  echolinkBaseUrl: string;
  echolinkBotToken: string;
  discordToken: string;
  discordClientId: string;
  discordGuildId: string | null; // null = global commands (production)
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const botConfig: BotConfig = {
  echolinkBaseUrl: process.env.ECHOLINK_BASE_URL ?? 'http://localhost:5173',
  echolinkBotToken: getEnvOrThrow('ECHOLINK_BOT_TOKEN'),
  discordToken: getEnvOrThrow('DISCORD_BOT_TOKEN'),
  discordClientId: getEnvOrThrow('DISCORD_CLIENT_ID'),
  discordGuildId: process.env.DISCORD_GUILD_ID || null,
};
