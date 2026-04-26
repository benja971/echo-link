import { config } from '../config';

interface DiscordMessageButton {
  type: 2; // Button
  style: 1 | 2 | 5; // Primary, Secondary, Link
  label: string;
  custom_id?: string;
  url?: string;
  emoji?: { name: string };
}

interface DiscordMessageComponent {
  type: 1; // Action Row
  components: DiscordMessageButton[];
}

/**
 * Send an ephemeral followup message using interaction webhook
 * This allows sending a private message visible only to the user who initiated the interaction
 */
export async function sendEphemeralFollowup(
  applicationId: string,
  interactionToken: string,
  content: string,
  components?: DiscordMessageComponent[]
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          components,
          flags: 64, // EPHEMERAL flag
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to send ephemeral followup: ${response.status} ${error}`);
      return false;
    }

    console.log('Ephemeral followup message sent');
    return true;
  } catch (error) {
    console.error('Error sending ephemeral followup:', error);
    return false;
  }
}

/**
 * Send upload completion message as ephemeral followup
 */
export async function sendUploadCompletionMessage(
  applicationId: string | null,
  interactionToken: string | null,
  channelId: string,
  userId: string,
  userName: string,
  fileName: string,
  fileSize: number,
  shareUrl: string,
  fileId: string
): Promise<boolean> {
  // If we don't have interaction token, we can't send ephemeral message
  if (!applicationId || !interactionToken) {
    console.warn('No interaction token available, cannot send ephemeral message');
    return false;
  }

  const fileSizeFormatted = formatBytes(fileSize);

  // Create message with buttons
  const components: DiscordMessageComponent[] = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 5, // Link
          label: 'Ouvrir le lien',
          url: shareUrl,
          emoji: { name: '🔗' },
        },
        {
          type: 2,
          style: 1, // Primary
          label: 'Envoyer dans le chat',
          custom_id: `share_${fileId}_${channelId}`,
          emoji: { name: '💬' },
        },
      ],
    },
  ];

  const content = `✅ **Upload réussi !**\n\n📁 **Fichier:** ${fileName}\n📦 **Taille:** ${fileSizeFormatted}\n🔗 **Lien:** ${shareUrl}`;

  return sendEphemeralFollowup(applicationId, interactionToken, content, components);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
