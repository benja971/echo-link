import { z } from "zod";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().url(),
  CDN_PUBLIC_BASE_URL: z.string().url(),

  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_USERNAME: z.string(),
  DATABASE_PASSWORD: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_SSL: z.enum(["0", "1"]).default("0"),
  DATABASE_LOGGING: z.enum(["0", "1"]).default("0"),

  S3_ENDPOINT: z.string(),
  S3_PORT: z.coerce.number().default(9000),
  S3_USE_SSL: z.string().transform((v) => v === "true"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET_NAME: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  EMAIL_FROM: z
    .string()
    .min(
      1,
      "EMAIL_FROM is required (must be a verified Resend sender, or onboarding@resend.dev for early dev)",
    ),

  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be ≥ 32 chars"),
  MAGIC_LINK_EXPIRATION_MINUTES: z.coerce.number().default(15),
  ANONYMOUS_IP_SALT: z.string().min(16, "ANONYMOUS_IP_SALT must be ≥ 16 chars"),

  FILE_EXPIRATION_DAYS: z.coerce.number().default(10),
  MAX_PER_USER: z.coerce.number().int().positive().default(25),
  MAX_SIZE_MB_PER_USER: z.coerce.number().positive().default(500),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().positive().max(65536).default(1024),
  UPLOAD_MAX_CONCURRENT: z.coerce.number().int().positive().default(2),
  UPLOAD_TIMEOUT_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(86400)
    .default(1800),
  UPLOAD_MIN_FREE_SPACE_MB: z.coerce.number().nonnegative().default(512),
  UPLOAD_TEMP_DIR: z
    .string()
    .refine(isAbsolute, "UPLOAD_TEMP_DIR must be absolute")
    .default(join(tmpdir(), "echo-link-uploads")),
  ANON_MAX_SIZE_MB: z.coerce.number().positive().default(50),
  ANON_MAX_PER_IP_PER_DAY: z.coerce.number().int().positive().default(3),
  ANON_EXPIRATION_HOURS: z.coerce.number().positive().default(24),
  ANON_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  ECHOLINK_BOT_TOKEN: z.string().optional(),
  ECHOLINK_BASE_URL: z.string().url().optional(),
});

let _env: z.infer<typeof envSchema> | null = null;

export function env() {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("[env] invalid configuration:", parsed.error.format());
    throw new Error("Invalid environment configuration");
  }
  _env = parsed.data;
  return _env;
}
