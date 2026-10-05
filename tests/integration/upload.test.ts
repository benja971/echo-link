import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const integration = describe.skipIf(process.env.RUN_INTEGRATION !== "1");
const MiB = 1024 * 1024;
const testSecret = "integration-only-secret-with-at-least-32-characters";
const root = new URL("../../", import.meta.url).pathname;
const prefix = `echo-link-integration-${process.pid}-${Date.now()}`;
const containers: string[] = [];
let database: any;
let storage: any;
let s3Commands: any;
let application: ReturnType<typeof Bun.spawn> | undefined;
let applicationLog = "";
let temporaryDirectory: string | undefined;
let baseUrl: string;
let bucket: string;
let databaseUrl: string;

async function command(
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
) {
  const child = Bun.spawn(args, {
    cwd: options.cwd ?? root,
    env: options.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code !== 0)
    throw new Error(`${args.join(" ")} failed (${code}): ${stderr}\n${stdout}`);
  return stdout.trim();
}

async function eventually(check: () => Promise<boolean>, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  do {
    if (await check()) return;
    await Bun.sleep(50);
  } while (Date.now() < deadline);
  throw new Error(
    `Condition did not become true. Application log:\n${applicationLog}`,
  );
}

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function containerPort(name: string, port: number) {
  return Number(
    (await command(["docker", "port", name, String(port)])).split(":").at(-1),
  );
}

async function startContainer(
  name: string,
  image: string,
  port: number,
  environment: Record<string, string>,
  args: string[] = [],
) {
  await command([
    "docker",
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--publish",
    `127.0.0.1::${port}`,
    ...Object.entries(environment).flatMap(([key, value]) => [
      "--env",
      `${key}=${value}`,
    ]),
    image,
    ...args,
  ]);
  containers.push(name);
  return containerPort(name, port);
}

function pdf(bytes: number) {
  const buffer = Buffer.alloc(bytes, 0x20);
  buffer.write("%PDF-1.7\n");
  buffer.write("\n%%EOF", bytes - 6);
  return buffer;
}

async function account(tier = "standard") {
  const accountId = randomUUID();
  const userId = randomUUID();
  const email = `${accountId}@integration.invalid`;
  await database.query(
    "INSERT INTO accounts (id, primary_email, upload_tier) VALUES ($1, $2, $3)",
    [accountId, email, tier],
  );
  await database.query("INSERT INTO users (id, email) VALUES ($1, $2)", [
    userId,
    email,
  ]);
  const body = Buffer.from(
    JSON.stringify({ accountId, userId, email, exp: Date.now() + 60_000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", testSecret)
    .update(body)
    .digest("base64url");
  return { accountId, userId, cookie: `session=${body}.${signature}` };
}

async function upload(
  bytes: number,
  cookie?: string,
  options: {
    size?: number | null;
    fields?: Record<string, string>;
    filename?: string;
    body?: Buffer;
  } = {},
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(options.fields ?? {}))
    form.set(key, value);
  form.set(
    "file",
    new File(
      [options.body ?? pdf(bytes)],
      options.filename ?? `${randomUUID()}.pdf`,
      { type: "application/pdf" },
    ),
  );
  const headers = new Headers({ origin: baseUrl });
  if (cookie) headers.set("cookie", cookie);
  if (options.size !== null)
    headers.set("x-upload-size", String(options.size ?? bytes));
  return fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers,
    body: form,
  });
}

async function reservations() {
  const result = await database.query(
    "SELECT count(*)::int AS count FROM upload_reservations",
  );
  return result.rows[0].count as number;
}

async function assertClean() {
  await eventually(async () => (await reservations()) === 0);
  expect(await readdir(temporaryDirectory!)).toEqual([]);
}

async function objectKeys() {
  const output = await storage.send(
    new s3Commands.ListObjectsV2Command({ Bucket: bucket }),
  );
  return (output.Contents ?? [])
    .map((object: { Key: string }) => object.Key)
    .sort();
}

async function cleanup() {
  if (application) {
    application.kill();
    const forceExit = setTimeout(() => application?.kill("SIGKILL"), 2_000);
    await application.exited;
    clearTimeout(forceExit);
    application = undefined;
  }
  if (database) await database.end();
  storage?.destroy();
  for (const name of containers.splice(0)) {
    try {
      await command(["docker", "rm", "--force", name]);
    } catch {
      /* Already removed after a failed startup. */
    }
  }
  if (temporaryDirectory)
    await rm(temporaryDirectory, { recursive: true, force: true });
}

integration("production HTTP uploads with PostgreSQL and MinIO", () => {
  beforeAll(async () => {
    try {
      await access(join(root, "apps/web/build/index.js"));
      await command(["docker", "info", "--format", "{{.ServerVersion}}"]);
      const minioDockerfile = join(root, "tests/integration/Minio.Dockerfile");
      const minioImage = `echo-link-integration-minio:${createHash("sha256")
        .update(await readFile(minioDockerfile))
        .digest("hex")
        .slice(0, 16)}`;
      await command([
        "docker",
        "build",
        "--tag",
        minioImage,
        "--file",
        minioDockerfile,
        "tests/integration",
      ]);
      const postgresPort = await startContainer(
        `${prefix}-postgres`,
        "postgres:16-alpine",
        5432,
        {
          POSTGRES_USER: "echolink_test",
          POSTGRES_PASSWORD: "echolink_test",
          POSTGRES_DB: "echolink_test",
        },
      );
      const minioPort = await startContainer(
        `${prefix}-minio`,
        minioImage,
        9000,
        {
          MINIO_ROOT_USER: "echolink_test",
          MINIO_ROOT_PASSWORD: "echolink_test_secret",
        },
        ["server", "/data"],
      );
      databaseUrl = `postgres://echolink_test:echolink_test@127.0.0.1:${postgresPort}/echolink_test`;
      const pg = createRequire(join(root, "packages/db/package.json"))("pg");
      database = new pg.Pool({
        host: "127.0.0.1",
        port: postgresPort,
        user: "echolink_test",
        password: "echolink_test",
        database: "echolink_test",
      });
      await eventually(async () => {
        try {
          await database.query("SELECT 1");
          return true;
        } catch {
          return false;
        }
      });
      await eventually(async () => {
        try {
          return (
            await fetch(`http://127.0.0.1:${minioPort}/minio/health/live`)
          ).ok;
        } catch {
          return false;
        }
      });
      s3Commands = createRequire(join(root, "apps/web/package.json"))(
        "@aws-sdk/client-s3",
      );
      storage = new s3Commands.S3Client({
        endpoint: `http://127.0.0.1:${minioPort}`,
        region: "us-east-1",
        forcePathStyle: true,
        credentials: {
          accessKeyId: "echolink_test",
          secretAccessKey: "echolink_test_secret",
        },
      });
      bucket = "upload-integration";
      await storage.send(
        new s3Commands.CreateBucketCommand({ Bucket: bucket }),
      );
      const port = await availablePort();
      baseUrl = `http://127.0.0.1:${port}`;
      temporaryDirectory = await mkdtemp(join(tmpdir(), `${prefix}-`));
      const environment: Record<string, string> = {
        PATH: process.env.PATH!,
        LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? "",
        HOME: process.env.HOME!,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(port),
        ORIGIN: baseUrl,
        PUBLIC_BASE_URL: baseUrl,
        CDN_PUBLIC_BASE_URL: baseUrl,
        DATABASE_HOST: "127.0.0.1",
        DATABASE_PORT: String(postgresPort),
        DATABASE_USERNAME: "echolink_test",
        DATABASE_PASSWORD: "echolink_test",
        DATABASE_NAME: "echolink_test",
        DATABASE_SSL: "0",
        S3_ENDPOINT: "127.0.0.1",
        S3_PORT: String(minioPort),
        S3_USE_SSL: "false",
        S3_REGION: "us-east-1",
        S3_BUCKET_NAME: bucket,
        S3_ACCESS_KEY: "echolink_test",
        S3_SECRET_KEY: "echolink_test_secret",
        S3_FORCE_PATH_STYLE: "true",
        RESEND_API_KEY: "integration-unused",
        EMAIL_FROM: "integration@integration.invalid",
        ECHOLINK_BOT_TOKEN: "integration-only-bot-token",
        SESSION_SECRET: testSecret,
        ANONYMOUS_IP_SALT: "integration-only-ip-salt",
        MAX_PER_USER: "2",
        MAX_SIZE_MB_PER_USER: "1",
        ANON_MAX_SIZE_MB: "1",
        ANON_MAX_PER_IP_PER_DAY: "3",
        UPLOAD_MAX_SIZE_MB: "12",
        UPLOAD_MIN_FREE_SPACE_MB: "1",
        UPLOAD_TEMP_DIR: temporaryDirectory,
        BODY_SIZE_LIMIT: "16M",
      };
      await command([process.execPath, "src/migrate.ts"], {
        cwd: join(root, "packages/db"),
        env: environment,
      });
      application = Bun.spawn([process.execPath, "build/index.js"], {
        cwd: join(root, "apps/web"),
        env: environment,
        stdout: "pipe",
        stderr: "pipe",
      });
      for (const output of [application.stdout, application.stderr]) {
        void (async () => {
          for await (const chunk of output as ReadableStream<Uint8Array>) {
            applicationLog = (
              applicationLog + new TextDecoder().decode(chunk)
            ).slice(-20_000);
          }
        })();
      }
      await eventually(async () => {
        try {
          return (await fetch(baseUrl)).ok;
        } catch {
          return false;
        }
      });
    } catch (error) {
      await cleanup();
      throw error;
    }
  }, 600_000);

  afterAll(async () => {
    if (/error|Error|failed/.test(applicationLog))
      console.error(applicationLog);
    await cleanup();
  }, 30_000);

  test("source account policy, reservations and tier CLI work on the migrated database", async () => {
    const output = await command(
      [
        process.execPath,
        "test",
        "apps/web/tests/accounts.test.ts",
        "apps/web/tests/accounts.integration.test.ts",
      ],
      {
        env: {
          PATH: process.env.PATH!,
          HOME: process.env.HOME!,
          LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? "",
          UPLOAD_TEST_DATABASE_URL: databaseUrl,
        },
      },
    );
    expect(output).not.toContain("(fail)");
    await assertClean();
  }, 30_000);

  test("workspace preserves upload actions for standard and trusted policies", async () => {
    for (const tier of ["standard", "trusted"]) {
      const owner = await account(tier);
      const response = await fetch(`${baseUrl}/app`, {
        headers: { cookie: owner.cookie },
      });
      expect(response.status).toBe(200);
      const html = await response.text();
      const main = html.match(
        /<main\b[^>]*id="main-content"[^>]*>([\s\S]*?)<\/main>/,
      );
      expect(main).not.toBeNull();
      const text = main![1]!
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      expect(text).toContain("Your files");
      expect(text).toContain("Choose files");
      expect(text).not.toMatch(/NaN|Infinity/);
      if (tier === "standard") {
        expect(text).toContain("0 of 2 files");
        expect(text).not.toContain("unlimited");
      } else {
        expect(text).toContain("0 files");
        expect(text).toContain("unlimited");
        expect(text).not.toContain("0% used");
      }
    }
  });

  test("stores authenticated bytes and serves the original file", async () => {
    const owner = await account();
    const response = await upload(128, owner.cookie);
    expect(response.status).toBe(200);
    const file = await response.json();
    expect(file.sizeBytes).toBe(128);
    expect(file.mimeType).toBe("application/pdf");
    const download = await fetch(file.directUrl);
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer())).toEqual(pdf(128));
    await assertClean();
  });

  test("reserves account capacity atomically across concurrent uploads", async () => {
    const owner = await account();
    const responses = await Promise.all([
      upload(700_000, owner.cookie),
      upload(700_000, owner.cookie),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 413,
    ]);
    const result = await database.query(
      "SELECT count(*)::int AS count, sum(size_bytes)::int AS bytes FROM files WHERE account_id = $1",
      [owner.accountId],
    );
    expect(result.rows[0]).toEqual({ count: 1, bytes: 700_000 });
    await assertClean();
  });

  test("trusted accounts exceed standard count and storage limits", async () => {
    const owner = await account("trusted");
    for (let i = 0; i < 3; i++)
      expect((await upload(1_200_000, owner.cookie)).status).toBe(200);
    const result = await database.query(
      "SELECT count(*)::int AS count, sum(size_bytes)::int AS bytes FROM files WHERE account_id = $1",
      [owner.accountId],
    );
    expect(result.rows[0]).toEqual({ count: 3, bytes: 3_600_000 });
    await assertClean();
  });

  test("streams a trusted file through real S3 multipart upload", async () => {
    const owner = await account("trusted");
    const response = await upload(9 * MiB, owner.cookie);
    expect(response.status).toBe(200);
    const file = await response.json();
    expect(file.sizeBytes).toBe(9 * MiB);
    const row = (
      await database.query("SELECT s3_key FROM files WHERE id = $1", [file.id])
    ).rows[0];
    const stored = await storage.send(
      new s3Commands.HeadObjectCommand({ Bucket: bucket, Key: row.s3_key }),
    );
    expect(stored.ContentLength).toBe(9 * MiB);
    expect(stored.ETag).toContain("-2");
    await assertClean();
  }, 20_000);

  test("standard file count quota survives small uploads", async () => {
    const owner = await account();
    expect((await upload(128, owner.cookie)).status).toBe(200);
    expect((await upload(128, owner.cookie)).status).toBe(200);
    expect((await upload(128, owner.cookie)).status).toBe(413);
    await assertClean();
  });

  test("client-supplied tier cannot elevate a standard account", async () => {
    const owner = await account();
    const response = await upload(1_200_000, owner.cookie, {
      fields: { uploadTier: "trusted", tier: "trusted" },
    });
    expect(response.status).toBe(413);
    expect(
      (
        await database.query("SELECT upload_tier FROM accounts WHERE id = $1", [
          owner.accountId,
        ])
      ).rows[0].upload_tier,
    ).toBe("standard");
    await assertClean();
  });

  test("rejects mismatched declared sizes without committing rows or objects", async () => {
    const owner = await account();
    const keysBefore = await objectKeys();
    const response = await upload(256, owner.cookie, { size: 512 });
    expect(response.status).toBe(400);
    expect(
      (
        await database.query(
          "SELECT count(*)::int AS count FROM files WHERE account_id = $1",
          [owner.accountId],
        )
      ).rows[0].count,
    ).toBe(0);
    expect(await objectKeys()).toEqual(keysBefore);
    await assertClean();
  });

  test("enforces declared bytes while receiving instead of after storing", async () => {
    const owner = await account();
    const before = await objectKeys();
    expect((await upload(128, owner.cookie, { size: 64 })).status).toBe(413);
    expect(await objectKeys()).toEqual(before);
    expect((await upload(MiB, owner.cookie)).status).toBe(200);
    await assertClean();
  });

  test("rejects two multipart file parts without storing either", async () => {
    const owner = await account();
    const before = await objectKeys();
    const form = new FormData();
    form.append("file", new File([pdf(128)], "one.pdf"));
    form.append("file", new File([pdf(128)], "two.pdf"));
    const response = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        cookie: owner.cookie,
        origin: baseUrl,
        "x-upload-size": "128",
      },
      body: form,
    });
    expect(response.status).toBe(400);
    expect(await objectKeys()).toEqual(before);
    await assertClean();
  });

  test("rejects unsupported magic bytes and frees the reservation", async () => {
    const owner = await account();
    const response = await upload(64, owner.cookie, {
      body: Buffer.alloc(64),
      filename: "pretend.pdf",
    });
    expect(response.status).toBe(415);
    expect((await upload(128, owner.cookie)).status).toBe(200);
    await assertClean();
  });

  test("accepts API uploads without a declared file size", async () => {
    const owner = await account();
    expect((await upload(128, owner.cookie, { size: null })).status).toBe(200);
    await assertClean();
  });

  test("rejects trusted uploads exceeding the technical per-file ceiling", async () => {
    const owner = await account("trusted");
    expect((await upload(12 * MiB + 1, owner.cookie)).status).toBe(413);
    await assertClean();
  });

  test("bounds chunked anonymous uploads without trusting Content-Length", async () => {
    const result = JSON.parse(
      await command([
        "node",
        "tests/integration/http-client.mjs",
        "oversize",
        baseUrl,
      ]),
    );
    expect(result.status).toBe(413);
    expect(result.sent).toBeLessThan(2 * MiB);
    await assertClean();
  }, 15_000);

  test("anonymous uploads enforce the shared rolling count", async () => {
    for (let i = 0; i < 3; i++) {
      const response = await upload(128);
      expect(response.status, await response.text()).toBe(200);
    }
    expect((await upload(128)).status).toBe(429);
    await assertClean();
  });

  test("Discord account merge preserves identities, files and pending cleanup without elevating tier", async () => {
    const previous = await account("trusted");
    const target = await account();
    const discordId = randomUUID();
    const code = randomUUID();
    const fileId = randomUUID();
    const reservationId = randomUUID();
    const objectKey = `files/${fileId}.pdf`;
    await database.query(
      `INSERT INTO upload_identities (account_id, kind, external_id) VALUES ($1, 'discord_user', $2), ($1, 'web_user', $3)`,
      [previous.accountId, discordId, previous.userId],
    );
    await database.query(
      `INSERT INTO files (id, s3_key, mime_type, size_bytes, account_id, user_id) VALUES ($1, $2, 'application/pdf', 128, $3, $4)`,
      [fileId, objectKey, previous.accountId, previous.userId],
    );
    await database.query(
      `INSERT INTO upload_reservations (id, account_id, bytes, expires_at, object_keys) VALUES ($1, $2, 128, now() + interval '1 hour', $3::jsonb)`,
      [reservationId, previous.accountId, JSON.stringify([objectKey])],
    );
    await database.query(
      `INSERT INTO discord_link_requests (account_id, code, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [target.accountId, code],
    );
    const link = () =>
      fetch(`${baseUrl}/api/discord/link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer integration-only-bot-token",
        },
        body: JSON.stringify({ code, discordUserId: discordId }),
      });
    const response = await link();
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await response.json()).status).toBe("merged");
    expect(
      (
        await database.query("SELECT upload_tier FROM accounts WHERE id = $1", [
          target.accountId,
        ])
      ).rows[0].upload_tier,
    ).toBe("standard");
    expect(
      (
        await database.query("SELECT id FROM accounts WHERE id = $1", [
          previous.accountId,
        ])
      ).rows,
    ).toEqual([]);
    expect(
      (
        await database.query("SELECT account_id FROM files WHERE id = $1", [
          fileId,
        ])
      ).rows[0].account_id,
    ).toBe(target.accountId);
    expect(
      (
        await database.query(
          "SELECT account_id FROM upload_identities WHERE external_id IN ($1, $2)",
          [discordId, previous.userId],
        )
      ).rows.map((row: { account_id: string }) => row.account_id),
    ).toEqual([target.accountId, target.accountId]);
    expect(
      (
        await database.query(
          "SELECT account_id, object_keys FROM upload_reservations WHERE id = $1",
          [reservationId],
        )
      ).rows[0],
    ).toEqual({ account_id: target.accountId, object_keys: [objectKey] });
    expect((await link()).status).toBe(400);
    await database.query("DELETE FROM upload_reservations WHERE id = $1", [
      reservationId,
    ]);
    await database.query("DELETE FROM files WHERE id = $1", [fileId]);
    await assertClean();
  });

  test("bounds non-upload JSON requests with and without Content-Length", async () => {
    const body = Buffer.from(JSON.stringify({ email: "x".repeat(128 * 1024) }));
    const declared = await fetch(`${baseUrl}/api/auth/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(declared.status).toBe(413);
    const chunked = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        `${baseUrl}/api/auth/request`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "transfer-encoding": "chunked",
          },
        },
        (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode!));
          response.on("error", reject);
        },
      );
      request.on("error", reject);
      request.write(body.subarray(0, 32 * 1024));
      request.write(body.subarray(32 * 1024, 96 * 1024));
      request.end(body.subarray(96 * 1024));
    });
    expect(chunked).toBe(413);
  });

  test("client cancellation removes partial files and releases quota", async () => {
    const owner = await account();
    const before = await objectKeys();
    const client = Bun.spawn(
      [
        "node",
        "tests/integration/http-client.mjs",
        "cancel",
        baseUrl,
        owner.cookie,
      ],
      {
        cwd: root,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    try {
      await eventually(async () => (await reservations()) === 1);
      client.stdin.write("cancel\n");
      client.stdin.end();
      expect(await client.exited).toBe(0);
    } finally {
      client.kill();
    }
    await assertClean();
    expect(await objectKeys()).toEqual(before);
    expect((await upload(700_000, owner.cookie)).status).toBe(200);
    await assertClean();
  }, 20_000);
});
