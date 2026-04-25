import 'dotenv/config';

interface Config {
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    ssl: boolean;
    logging: boolean;
  };
  s3: {
    endpoint: string;
    port: number;
    useSsl: boolean;
    region: string;
    bucket: string;
    forcePathStyle: boolean;
    accessKey: string;
    secretKey: string;
  };
  publicBaseUrl: string;
  cdnPublicBaseUrl: string;
  email: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
  };
  magicLink: {
    expirationMinutes: number;
  };
  files: {
    expirationDays: number;
    maxSizeBytes: number;
    maxPerUser: number;
    maxSizeBytesPerUser: number;
  };
  discordBot: {
    botToken: string | null;
    baseUrl: string | null;
    discordToken: string | null;
  };
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config: Config = {
  port: parseInt(getEnvOrDefault('PORT', '3000'), 10),
  database: {
    host: getEnvOrThrow('DATABASE_HOST'),
    port: parseInt(getEnvOrDefault('DATABASE_PORT', '5432'), 10),
    username: getEnvOrThrow('DATABASE_USERNAME'),
    password: getEnvOrThrow('DATABASE_PASSWORD'),
    name: getEnvOrThrow('DATABASE_NAME'),
    ssl: getEnvOrDefault('DATABASE_SSL', '0') === '1',
    logging: getEnvOrDefault('DATABASE_LOGGING', '0') === '1',
  },
  s3: {
    endpoint: getEnvOrThrow('S3_ENDPOINT'),
    port: parseInt(getEnvOrDefault('S3_PORT', '9000'), 10),
    useSsl: getEnvOrDefault('S3_USE_SSL', 'false') === 'true',
    region: getEnvOrDefault('S3_REGION', 'us-east-1'),
    bucket: getEnvOrThrow('S3_BUCKET_NAME'),
    forcePathStyle: getEnvOrDefault('S3_FORCE_PATH_STYLE', 'true') === 'true',
    accessKey: getEnvOrThrow('S3_ACCESS_KEY'),
    secretKey: getEnvOrThrow('S3_SECRET_KEY'),
  },
  publicBaseUrl: getEnvOrThrow('PUBLIC_BASE_URL'),
  cdnPublicBaseUrl: getEnvOrThrow('CDN_PUBLIC_BASE_URL'),
  email: {
    host: getEnvOrThrow('EMAIL_HOST'),
    port: parseInt(getEnvOrDefault('EMAIL_PORT', '587'), 10),
    secure: getEnvOrDefault('EMAIL_SECURE', 'false') === 'true',
    auth: {
      user: getEnvOrThrow('EMAIL_USER'),
      pass: getEnvOrThrow('EMAIL_PASSWORD'),
    },
    from: getEnvOrDefault('EMAIL_FROM', getEnvOrThrow('EMAIL_USER')),
  },
  magicLink: {
    expirationMinutes: parseInt(getEnvOrDefault('MAGIC_LINK_EXPIRATION_MINUTES', '15'), 10),
  },
  files: {
    expirationDays: parseInt(getEnvOrDefault('FILE_EXPIRATION_DAYS', '10'), 10),
    maxSizeBytes: parseInt(getEnvOrDefault('MAX_SIZE_MB', '100'), 10) * 1024 * 1024,
    maxPerUser: parseInt(getEnvOrDefault('MAX_PER_USER', '25'), 10),
    maxSizeBytesPerUser: parseInt(getEnvOrDefault('MAX_SIZE_MB_PER_USER', '500'), 10) * 1024 * 1024,
  },
  discordBot: {
    botToken: process.env.ECHOLINK_BOT_TOKEN || null,
    baseUrl: process.env.ECHOLINK_BASE_URL || null,
    discordToken: process.env.DISCORD_BOT_TOKEN || null,
  },
};
