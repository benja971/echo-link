import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core';

// ─── accounts ───────────────────────────────────────────────────────────────
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  primaryEmail: text('primary_email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ─── upload_identities ──────────────────────────────────────────────────────
export const uploadIdentities = pgTable(
  'upload_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => accounts.id, { onDelete: 'cascade' })
      .notNull(),
    kind: text('kind').notNull(), // 'web_user' | 'discord_user'
    externalId: text('external_id').notNull(),
    displayName: text('display_name'),
    extraMetadata: jsonb('extra_metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (t) => [
    uniqueIndex('upload_identities_kind_external_uq').on(t.kind, t.externalId),
    index('upload_identities_account_idx').on(t.accountId)
  ]
);

// ─── users (legacy magic-link auth) ─────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// ─── magic_links ────────────────────────────────────────────────────────────
export const magicLinks = pgTable(
  'magic_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (t) => [index('magic_links_user_idx').on(t.userId)]
);

// ─── upload_tokens (long-lived bearer for bot/devices) ──────────────────────
export const uploadTokens = pgTable(
  'upload_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    token: text('token').notNull().unique(),
    deviceInfo: text('device_info'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
  }
);

// ─── files ──────────────────────────────────────────────────────────────────
export const files = pgTable(
  'files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    s3Key: text('s3_key').notNull().unique(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    title: text('title'),
    width: integer('width'),
    height: integer('height'),
    thumbnailS3Key: text('thumbnail_s3_key'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    // legacy refs
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    uploadIdentityId: uuid('upload_identity_id').references(() => uploadIdentities.id, {
      onDelete: 'set null'
    }),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),

    // new in v2
    isAnonymous: boolean('is_anonymous').default(false).notNull(),
    anonymousIpHash: text('anonymous_ip_hash'),

    // v2.1 — custom slug for shareable URL
    slug: text('slug').unique()
  },
  (t) => [
    index('files_account_idx').on(t.accountId),
    index('files_expires_idx').on(t.expiresAt),
    index('files_anon_rate_idx').on(t.anonymousIpHash, t.createdAt)
  ]
);

// ─── discord_upload_sessions ────────────────────────────────────────────────
export const discordUploadSessions = pgTable(
  'discord_upload_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    token: text('token').notNull().unique(),
    discordUserId: text('discord_user_id').notNull(),
    discordChannelId: text('discord_channel_id').notNull(),
    discordInteractionToken: text('discord_interaction_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  }
);

// ─── discord_link_requests ──────────────────────────────────────────────────
export const discordLinkRequests = pgTable(
  'discord_link_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => accounts.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  }
);

// ─── exports ────────────────────────────────────────────────────────────────
export type Account = typeof accounts.$inferSelect;
export type UploadIdentity = typeof uploadIdentities.$inferSelect;
export type User = typeof users.$inferSelect;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type MagicLink = typeof magicLinks.$inferSelect;
export type UploadToken = typeof uploadTokens.$inferSelect;
export type DiscordUploadSession = typeof discordUploadSessions.$inferSelect;
export type DiscordLinkRequest = typeof discordLinkRequests.$inferSelect;
