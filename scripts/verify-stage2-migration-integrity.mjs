import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const DB_HOST = "aws-0-ap-south-1.pooler.supabase.com";
const DB_PORT = 6543;
const DB_USER = "postgres.jrknrglxivqmddoqqcjh";
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!DB_PASSWORD) {
  console.error("❌ Missing SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const baseConfig = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

// All migration files found in migrationsDir, sorted lexicographically
const lexicalMigrations = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function createAdminClient(db = "postgres") {
  const client = new Client({ ...baseConfig, database: db });
  await client.connect();
  return client;
}

async function runLexicalFreshDbTest() {
  console.log("\n============================================================");
  console.log("TEST: Fresh Database Construction in Lexical Order");
  console.log("============================================================");
  console.log("Lexical order of migrations:");
  lexicalMigrations.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

  const rootClient = await createAdminClient("postgres");
  const freshDbName = "edulive_release_fresh_test";

  try {
    await rootClient.query(`DROP DATABASE IF EXISTS ${freshDbName} WITH (FORCE);`);
    await rootClient.query(`CREATE DATABASE ${freshDbName};`);
    console.log(`✓ Created fresh database: ${freshDbName}`);
  } catch (err) {
    console.error(`Failed to create database ${freshDbName}:`, err.message);
    await rootClient.end();
    return { success: false, error: err.message };
  }

  let freshClient;
  const migrationResults = [];

  try {
    freshClient = await createAdminClient(freshDbName);

    // Provide standard Supabase environment stubs
    await freshClient.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT);
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000000'::UUID $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::TEXT $$;
      DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF; END $$;
    `);

    let allSucceeded = true;
    for (let i = 0; i < lexicalMigrations.length; i++) {
      const filename = lexicalMigrations[i];
      process.stdout.write(`Executing [${i + 1}/${lexicalMigrations.length}] ${filename}... `);
      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
      const start = Date.now();
      try {
        await freshClient.query(sql);
        const duration = Date.now() - start;
        console.log(`✅ OK (${duration}ms)`);
        migrationResults.push({ file: filename, success: true, duration });
      } catch (err) {
        console.log(`❌ FAILED: ${err.message}`);
        migrationResults.push({ file: filename, success: false, error: err.message });
        allSucceeded = false;
        break;
      }
    }

    if (!allSucceeded) {
      return { success: false, migrationResults };
    }

    // Now compare fresh schema against production schema!
    console.log("\n============================================================");
    console.log("Comparing Fresh Test DB against Live Production DB");
    console.log("============================================================");

    const prodClient = await createAdminClient("postgres");
    const comparison = await compareSchemas(prodClient, freshClient);
    await prodClient.end();

    return {
      success: true,
      migrationResults,
      comparison,
    };
  } finally {
    if (freshClient) await freshClient.end();
    try {
      await rootClient.query(`DROP DATABASE IF EXISTS ${freshDbName} WITH (FORCE);`);
      console.log(`✓ Cleaned up fresh database: ${freshDbName}`);
    } catch {}
    await rootClient.end();
  }
}

async function extractSchemaDetails(client, dbLabel) {
  // 1. Tables
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const tables = tablesRes.rows.map((r) => r.table_name);

  // 2. Columns
  const colsRes = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, column_name;
  `);
  const columns = colsRes.rows;

  // 3. Constraints (PK, FK, Unique)
  const constraintsRes = await client.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name, kcu.column_name;
  `);
  const constraints = constraintsRes.rows;

  // 4. Indexes
  const indexesRes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  const indexes = indexesRes.rows;

  // 5. Enum types and labels
  const enumsRes = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder;
  `);
  const enums = enumsRes.rows;

  // 6. Custom Functions (excluding extension-defined functions)
  const functionsRes = await client.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_admin', 'is_teacher_of_student', 'ensure_user_role_profile', 'rls_auto_enable')
    ORDER BY p.proname;
  `);
  const functions = functionsRes.rows;

  // 7. Triggers
  const triggersRes = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `);
  const triggers = triggersRes.rows;

  // 8. RLS Enabled Status
  const rlsRes = await client.query(`
    SELECT relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY relname;
  `);
  const rlsStatus = rlsRes.rows;

  // 9. RLS Policies
  const policiesRes = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  const policies = policiesRes.rows;

  return {
    tables,
    columns,
    constraints,
    indexes,
    enums,
    functions,
    triggers,
    rlsStatus,
    policies,
  };
}

async function compareSchemas(prodClient, freshClient) {
  const prod = await extractSchemaDetails(prodClient, "PROD");
  const fresh = await extractSchemaDetails(freshClient, "FRESH");

  console.log(`\nSchema Counts:`);
  console.log(`  Tables:       Prod=${prod.tables.length}, Fresh=${fresh.tables.length}`);
  console.log(`  Columns:      Prod=${prod.columns.length}, Fresh=${fresh.columns.length}`);
  console.log(`  Constraints:  Prod=${prod.constraints.length}, Fresh=${fresh.constraints.length}`);
  console.log(`  Indexes:      Prod=${prod.indexes.length}, Fresh=${fresh.indexes.length}`);
  console.log(`  Enums:        Prod=${prod.enums.length}, Fresh=${fresh.enums.length}`);
  console.log(`  Functions:    Prod=${prod.functions.length}, Fresh=${fresh.functions.length}`);
  console.log(`  Triggers:     Prod=${prod.triggers.length}, Fresh=${fresh.triggers.length}`);
  console.log(`  RLS Policies: Prod=${prod.policies.length}, Fresh=${fresh.policies.length}`);

  // Missing or extra tables
  const prodTableSet = new Set(prod.tables);
  const freshTableSet = new Set(fresh.tables);
  const missingTablesInFresh = prod.tables.filter((t) => !freshTableSet.has(t));
  const extraTablesInFresh = fresh.tables.filter((t) => !prodTableSet.has(t));

  // Compare columns per table
  const colDifferences = [];
  const prodColMap = new Map();
  prod.columns.forEach((c) => prodColMap.set(`${c.table_name}.${c.column_name}`, c));
  const freshColMap = new Map();
  fresh.columns.forEach((c) => freshColMap.set(`${c.table_name}.${c.column_name}`, c));

  for (const [key, pCol] of prodColMap.entries()) {
    const fCol = freshColMap.get(key);
    if (!fCol) {
      colDifferences.push({ key, diff: "Missing in Fresh test DB" });
    } else if (pCol.data_type !== fCol.data_type) {
      colDifferences.push({
        key,
        diff: `Type mismatch: prod=${pCol.data_type}, fresh=${fCol.data_type}`,
      });
    }
  }
  for (const [key] of freshColMap.entries()) {
    if (!prodColMap.has(key)) {
      colDifferences.push({ key, diff: "Extra in Fresh test DB" });
    }
  }

  // Compare RLS policies
  const prodPolMap = new Map();
  prod.policies.forEach((p) => prodPolMap.set(`${p.tablename}::${p.policyname}`, p));
  const freshPolMap = new Map();
  fresh.policies.forEach((p) => freshPolMap.set(`${p.tablename}::${p.policyname}`, p));

  const missingPoliciesInFresh = [];
  const extraPoliciesInFresh = [];
  for (const [key] of prodPolMap.entries()) {
    if (!freshPolMap.has(key)) missingPoliciesInFresh.push(key);
  }
  for (const [key] of freshPolMap.entries()) {
    if (!prodPolMap.has(key)) extraPoliciesInFresh.push(key);
  }

  // Enums comparison
  const prodEnumLabels = new Set(prod.enums.map((e) => `${e.typname}.${e.enumlabel}`));
  const freshEnumLabels = new Set(fresh.enums.map((e) => `${e.typname}.${e.enumlabel}`));
  const missingEnumsInFresh = [...prodEnumLabels].filter((e) => !freshEnumLabels.has(e));
  const extraEnumsInFresh = [...freshEnumLabels].filter((e) => !prodEnumLabels.has(e));

  return {
    tables: {
      prod: prod.tables.length,
      fresh: fresh.tables.length,
      missing: missingTablesInFresh,
      extra: extraTablesInFresh,
    },
    columns: { prod: prod.columns.length, fresh: fresh.columns.length, diffs: colDifferences },
    policies: {
      prod: prod.policies.length,
      fresh: fresh.policies.length,
      missingInFresh: missingPoliciesInFresh,
      extraInFresh: extraPoliciesInFresh,
    },
    enums: {
      prod: prod.enums.length,
      fresh: fresh.enums.length,
      missingInFresh: missingEnumsInFresh,
      extraInFresh: extraEnumsInFresh,
    },
    functions: {
      prod: prod.functions.map((f) => f.proname),
      fresh: fresh.functions.map((f) => f.proname),
    },
    triggers: {
      prod: prod.triggers.map((t) => t.trigger_name),
      fresh: fresh.triggers.map((t) => t.trigger_name),
    },
    rlsStatus: {
      prodRlsDisabled: prod.rlsStatus.filter((r) => !r.rls_enabled).map((r) => r.table_name),
      freshRlsDisabled: fresh.rlsStatus.filter((r) => !r.rls_enabled).map((r) => r.table_name),
    },
  };
}

async function auditDestructiveDDL() {
  console.log("\n============================================================");
  console.log("AUDIT: Destructive DDL Across All Migration Files");
  console.log("============================================================");

  const report = [];
  for (const file of lexicalMigrations) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    const destructive = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (
        /DROP\s+TABLE/i.test(trimmed) ||
        /DROP\s+TYPE/i.test(trimmed) ||
        /DROP\s+COLUMN/i.test(trimmed) ||
        /TRUNCATE/i.test(trimmed) ||
        /CASCADE/i.test(trimmed)
      ) {
        destructive.push({ line: idx + 1, statement: trimmed });
      }
    });

    report.push({ file, destructiveCount: destructive.length, statements: destructive });
  }

  return report;
}

async function main() {
  console.log("============================================================");
  console.log("FINAL RECONCILED MIGRATION & SCHEMA INTEGRITY AUDIT");
  console.log("============================================================");

  const destructiveReport = await auditDestructiveDDL();
  destructiveReport.forEach((r) => {
    console.log(
      `\n📄 ${r.file} (${r.destructiveCount} potentially destructive / cascade statements)`,
    );
    r.statements.forEach((s) => console.log(`   L${s.line}: ${s.statement}`));
  });

  const freshResult = await runLexicalFreshDbTest();

  console.log("\n============================================================");
  console.log("AUDIT COMPLETE");
  console.log("============================================================");

  const finalSummary = {
    lexicalFreshDbWorks: freshResult.success,
    destructiveReportSummary: destructiveReport.map((r) => ({
      file: r.file,
      count: r.destructiveCount,
    })),
    comparison: freshResult.comparison,
  };

  fs.writeFileSync(
    path.join(__dirname, "release-schema-audit-results.json"),
    JSON.stringify(finalSummary, null, 2),
    "utf8",
  );
  console.log("✓ Results saved to scripts/release-schema-audit-results.json");
}

main().catch((err) => {
  console.error("Fatal audit error:", err);
  process.exit(1);
});
