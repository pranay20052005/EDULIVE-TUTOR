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

  console.log("=== MATERIALS COLUMNS ===");
  const matRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'materials'
    ORDER BY ordinal_position;
  `);
  console.table(matRes.rows);

  console.log("\n=== QUESTION_PAPERS COLUMNS ===");
  const qpRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'question_papers'
    ORDER BY ordinal_position;
  `);
  console.table(qpRes.rows);

  console.log("\n=== SAMPLE MATERIALS ROWS ===");
  const matRows = await client.query(`SELECT * FROM materials LIMIT 5;`);
  console.table(matRows.rows);

  console.log("\n=== SAMPLE QUESTION_PAPERS ROWS ===");
  const qpRows = await client.query(`SELECT * FROM question_papers LIMIT 5;`);
  console.table(qpRows.rows);

  await client.end();
}

main();
