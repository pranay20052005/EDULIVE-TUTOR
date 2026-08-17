import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

const hosts = [
  "aws-0-ap-south-1.pooler.supabase.com",
  "aws-0-us-east-1.pooler.supabase.com",
  "aws-0-eu-central-1.pooler.supabase.com",
  "db.jrknrglxivqmddoqqcjh.supabase.co",
];

async function tryHost(host, port, user) {
  const client = new Client({
    host,
    port,
    database: "postgres",
    user,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000,
  });

  try {
    await client.connect();
    console.log(`✓ Connected to ${host}:${port} as ${user}`);
    const res = await client.query("SELECT current_user, current_database();");
    console.log("Result:", res.rows);
    return client;
  } catch (e) {
    console.log(`✗ Failed ${host}:${port} as ${user}:`, e.message);
    try {
      await client.end();
    } catch {}
    return null;
  }
}

async function main() {
  for (const host of hosts) {
    for (const user of ["postgres.jrknrglxivqmddoqqcjh", "postgres"]) {
      for (const port of [6543, 5432]) {
        const cl = await tryHost(host, port, user);
        if (cl) {
          console.log(`\n🎉 WORKING CONNECTION: host=${host}, port=${port}, user=${user}`);
          await cl.end();
          return;
        }
      }
    }
  }
}

main();
