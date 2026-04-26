import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { botConfig } from './config';

// Session response from Echo-Link API
interface EchoLinkSessionResponse {
  sessionId: string;
  uploadUrl: string;
  expiresAt: string;
}

interface EchoLinkErrorResponse {
  error: string;
  message?: string;
}

interface EchoLinkLinkResponse {
  status: 'linked' | 'already_linked' | 'merged';
  accountId: string;
  message: string;
}

// Discord bot client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Slash command definitions
const uploadCommand = new SlashCommandBuilder()
  .setName('upload')
  .setDescription('Obtenir un lien pour uploader un fichier volumineux vers Echo-Link');

const linkCommand = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Lier ton compte Discord à ton compte Echo-Link')
  .addStringOption(option =>
    option
      .setName('code')
      .setDescription('Le code de liaison obtenu depuis le site Echo-Link')
      .setRequired(true)
  );

// Register slash commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(botConfig.discordToken);

  try {
    const commands = [uploadCommand.toJSON(), linkCommand.toJSON()];

    if (botConfig.discordGuildId) {
      // Guild commands (instant, for development)
      console.log(`🔄 Registering guild commands for ${botConfig.discordGuildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(botConfig.discordClientId, botConfig.discordGuildId),
        { body: commands }
      );
      console.log('✅ Guild commands registered (instant)');
    } else {
      // Global commands (up to 1h propagation, for production)
      console.log('🔄 Registering global commands...');
      await rest.put(
        Routes.applicationCommands(botConfig.discordClientId),
        { body: commands }
      );
      console.log('✅ Global commands registered (may take up to 1h to propagate)');
    }
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
    throw error;
  }
}

// Create upload session on Echo-Link
async function createUploadSession(
  userId: string,
  userName: string,
  channelId: string,
  guildId: string | null,
  interactionToken: string,
  applicationId: string
): Promise<EchoLinkSessionResponse> {
  console.log(`📝 Creating upload session for Discord user ${userId}`);

  const response = await fetch(`${botConfig.echolinkBaseUrl}/api/discord/upload-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botConfig.echolinkBotToken}`,
      'Content-Type': 'application/json',
      'X-Discord-User-Id': userId,
      'X-Discord-User-Name': userName,
      'X-Discord-Channel-Id': channelId,
      'X-Discord-Guild-Id': guildId || '',
      'X-Discord-Interaction-Token': interactionToken,
      'X-Discord-Application-Id': applicationId,
    },
  });

  const responseData = await response.json();

  if (!response.ok) {
    const errorData = responseData as EchoLinkErrorResponse;
    throw new SessionError(
      response.status,
      errorData.error,
      errorData.message || 'Failed to create session'
    );
  }

  return responseData as EchoLinkSessionResponse;
}

// Custom error class for session errors
class SessionError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

// Handle upload command
async function handleUploadCommand(interaction: ChatInputCommandInteraction) {
  // Defer reply
  await interaction.deferReply({ flags: ['Ephemeral'] });

  try {
    const session = await createUploadSession(
      interaction.user.id,
      interaction.user.username,
      interaction.channelId,
      interaction.guildId,
      interaction.token,
      interaction.applicationId
    );

    console.log(`✅ Session created: ${session.sessionId}`);

    // Create button to open upload page
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('📤 Ouvrir la page d\'upload')
        .setStyle(ButtonStyle.Link)
        .setURL(session.uploadUrl)
    );

    const expiresAt = new Date(session.expiresAt);
    const expiresInMinutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);

    await interaction.editReply({
      content: `🔗 **Ta session d'upload est prête !**\n\nClique sur le bouton ci-dessous pour ouvrir la page d'upload Echo-Link dans ton navigateur.\n\n⏱️ *Ce lien expire dans ${expiresInMinutes} minutes.*`,
      components: [row],
    });
  } catch (error) {
    console.error('❌ Failed to create session:', error);

    if (error instanceof SessionError) {
      if (error.status === 401) {
        await interaction.editReply({
          content: `❌ **Erreur d'authentification**\n\nLe bot n'a pas pu s'authentifier auprès d'Echo-Link. Contacte un administrateur.`,
        });
      } else if (error.status === 429) {
        await interaction.editReply({
          content: `⚠️ **Limite atteinte**\n\n${error.message}`,
        });
      } else {
        await interaction.editReply({
          content: `❌ **Erreur**\n\n${error.message}`,
        });
      }
    } else {
      await interaction.editReply({
        content: `❌ **Erreur inattendue**\n\nUn problème est survenu. Réessaie plus tard.`,
      });
    }
  }
}

// Link Discord account to Echo-Link account
async function linkDiscordAccount(
  userId: string,
  userName: string,
  guildId: string | null,
  code: string
): Promise<EchoLinkLinkResponse> {
  console.log(`🔗 Linking Discord user ${userId} with code ${code}`);

  const response = await fetch(`${botConfig.echolinkBaseUrl}/api/discord/link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botConfig.echolinkBotToken}`,
      'Content-Type': 'application/json',
      'X-Discord-User-Id': userId,
      'X-Discord-User-Name': userName,
      'X-Discord-Guild-Id': guildId || '',
    },
    body: JSON.stringify({ code }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    const errorData = responseData as EchoLinkErrorResponse;
    throw new SessionError(
      response.status,
      errorData.error,
      errorData.message || 'Failed to link account'
    );
  }

  return responseData as EchoLinkLinkResponse;
}

// Handle link command
async function handleLinkCommand(interaction: ChatInputCommandInteraction) {
  // Defer reply (ephemeral)
  await interaction.deferReply({ flags: ['Ephemeral'] });

  try {
    const code = interaction.options.getString('code', true);

    const result = await linkDiscordAccount(
      interaction.user.id,
      interaction.user.username,
      interaction.guildId,
      code
    );

    console.log(`✅ Link successful: ${result.status}`);

    // Get emoji based on status
    const emoji = result.status === 'merged' ? '🔀' : '✅';

    await interaction.editReply({
      content: `${emoji} **Liaison réussie !**\n\n${result.message}`,
    });
  } catch (error) {
    console.error('❌ Failed to link account:', error);

    if (error instanceof SessionError) {
      await interaction.editReply({
        content: `❌ **Erreur de liaison**\n\n${error.message}`,
      });
    } else {
      await interaction.editReply({
        content: `❌ **Erreur inattendue**\n\nUn problème est survenu. Réessaie plus tard.`,
      });
    }
  }
}

// Event handlers
client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖 Discord bot logged in as ${readyClient.user.tag}`);
  console.log(`📊 Connected to ${readyClient.guilds.cache.size} guild(s)`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'upload') {
      await handleUploadCommand(interaction);
    } else if (interaction.commandName === 'link') {
      await handleLinkCommand(interaction);
    }
    return;
  }

  // Handle button clicks
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('share_')) {
      // Format: share_{fileId}_{channelId}
      const parts = interaction.customId.replace('share_', '').split('_');
      const fileId = parts[0];
      const channelId = parts[1] || interaction.channelId;
      const shareUrl = `${botConfig.echolinkBaseUrl}/v/${fileId}`;

      // Get the channel to send the message
      const channel = await client.channels.fetch(channelId);
      if (channel && 'send' in channel) {
        await channel.send({
          content: `🔗 ${interaction.user} a partagé : ${shareUrl}`,
        });
      }

      // Update the original message to show it was shared
      await interaction.update({
        content: interaction.message.content + '\n\n✅ *Lien envoyé dans le chat !*',
        components: [], // Remove buttons after sharing
      });
    }
    return;
  }
});

// Start the bot
export async function startBot(): Promise<void> {
  try {
    console.log('🚀 Starting Echo-Link Discord bot...');
    console.log(`📡 Echo-Link API: ${botConfig.echolinkBaseUrl}`);

    // Register commands first
    await registerCommands();

    // Login to Discord
    await client.login(botConfig.discordToken);
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}
