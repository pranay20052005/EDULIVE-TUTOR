#!/usr/bin/env node

/**
 * Phase 1 Database Migration Runner
 * Executes all SQL migrations against Supabase using PostgreSQL client
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

// Extract project ID from Supabase URL
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error("❌ ERROR: Missing Supabase credentials");
  console.error("   VITE_SUPABASE_URL:", SUPABASE_URL ? "✓ Set" : "✗ Missing");
  console.error("   SUPABASE_DB_PASSWORD:", DB_PASSWORD ? "✓ Set" : "✗ Missing");
  console.error("\n📝 Make sure .env.local exists with credentials");
  process.exit(1);
}

// Parse project ID from URL
const projectIdMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectId = projectIdMatch ? projectIdMatch[1] : null;

if (!projectId) {
  console.error("❌ ERROR: Could not extract project ID from Supabase URL");
  process.exit(1);
}

// Connection configuration - using Supabase pooler connection
const dbConfig = {
  host: `db.${projectId}.pooler.supabase.com`,
  port: 6543,
  database: "postgres",
  user: "postgres",
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
};

// Migration files
const migrations = [
  {
    name: "20250814000001_init_schema.sql",
    order: 1,
    description: "Create tables, indexes, and constraints",
  },
  {
    name: "20250814000002_rls_policies.sql",
    order: 2,
    description: "Enable Row-Level Security and policies",
  },
  {
    name: "20250814000003_seed_data.sql",
    order: 3,
    description: "Insert development test data",
  },
];

async function runMigrations() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     EduLive Phase 1 - Database Migration Runner            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`📦 Project: ${projectId}`);
  console.log(`📍 Database: ${dbConfig.host}:${dbConfig.port}\n`);

  const client = new Client(dbConfig);

  try {
    // Connect to database
    console.log("🔗 Connecting to Supabase database...");
    await client.connect();
    console.log("✓ Connected successfully\n");

    // Run each migration
    let successCount = 0;
    let failureCount = 0;

    for (const migration of migrations) {
      const sqlPath = path.join(__dirname, "..", "supabase", "migrations", migration.name);

      if (!fs.existsSync(sqlPath)) {
        console.log(`❌ FAILED: ${migration.name} - File not found`);
        failureCount++;
        continue;
      }

      console.log(`⏳ [${migration.order}/3] ${migration.name}`);
      console.log(`   ${migration.description}`);

      try {
        const sql = fs.readFileSync(sqlPath, "utf-8");
        const fileSize = (fs.statSync(sqlPath).size / 1024).toFixed(2);
        console.log(`   📄 Size: ${fileSize} KB`);

        // Execute migration
        console.log("   ⏱️  Executing...");
        await client.query(sql);

        console.log("   ✅ Success\n");
        successCount++;
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message.split("\n")[0]}\n`);
        failureCount++;
      }
    }

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log(
      `║ RESULTS: ${successCount} passed | ${failureCount} failed${" ".repeat(failureCount === 0 ? 22 : 20)}║`,
    );
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    if (successCount === 3) {
      console.log("🎉 All migrations executed successfully!\n");
      console.log("📊 Verifying schema...");

      // Verify tables
      const result = await client.query(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const tableCount = result.rows[0].count;

      console.log(`   ✓ Tables created: ${tableCount}\n`);

      if (tableCount >= 24) {
        console.log("✅ Phase 1 Database Foundation verified!\n");
        console.log("🚀 Next steps:");
        console.log("   1. Run: npm run dev");
        console.log("   2. Test accounts created (see MANUAL_MIGRATION_GUIDE.md)");
        console.log("   3. Verify database connection works");
        process.exit(0);
      }
    } else {
      console.log("⚠️  Some migrations failed. Check errors above.\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Connection error:", error.message);
    console.error("\n📝 Troubleshooting:");
    console.error("   • Verify .env.local exists with correct credentials");
    console.error("   • Check Supabase project is active");
    console.error("   • Verify database password is correct");
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
