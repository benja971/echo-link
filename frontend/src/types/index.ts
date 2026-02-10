export interface UploadResponse {
  id: string
  shareUrl: string
  directUrl?: string
}

export interface FileItem {
  id: string
  title: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  shareUrl: string
  directUrl?: string
}

export interface UserStats {
  user: {
    id: string
    email: string
    createdAt: string
    lastLoginAt: string
  }
  quota: {
    files: { used: number; max: number; percentage: number }
    storage: { usedBytes: number; maxBytes: number; percentage: number }
  }
  recentFiles: FileItem[]
}

export interface GlobalStats {
  totals: {
    users: number
    files: number
    storageBytes: number
  }
  today: {
    files: number
    storageBytes: number
  }
  thisWeek: {
    files: number
    storageBytes: number
  }
  thisMonth: {
    files: number
    storageBytes: number
  }
  recentFiles: FileItem[]
}

export type AuthState = 'checking' | 'unauthenticated' | 'waiting_email' | 'authenticated' | 'discord_session'
export type StatsTab = 'user' | 'global'

export interface DiscordIdentity {
  id: string
  displayName: string | null
  externalId: string
  createdAt: string
}

export interface DiscordLinkStatus {
  hasDiscordLinked: boolean
  discordIdentities: DiscordIdentity[]
  pendingRequests: { code: string; expiresAt: string }[]
}

export interface DiscordLinkRequest {
  code: string
  expiresAt: string
  instructions: string
}

export const TOKEN_KEY = 'echolink_upload_token'
export const ONBOARDING_KEY = 'echolink_onboarding_completed'
