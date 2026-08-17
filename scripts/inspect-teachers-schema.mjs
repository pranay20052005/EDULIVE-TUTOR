import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const client = new Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.jrknrglxivqmddoqqcjh",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'teachers'
    ORDER BY ordinal_position;
  `);
  console.log("Teachers columns:");
  console.table(res.rows);
  await client.end();
}

main();
