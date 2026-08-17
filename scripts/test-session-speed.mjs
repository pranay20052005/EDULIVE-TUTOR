import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, anonKey);

async function main() {
  console.log("=== TESTING JOINED USER + ROLE PROFILE QUERY SPEED ===");

  const t0 = performance.now();
  const { data: userWithProfile, error } = await client
    .from("users")
    .select("id, email, role, name, phone, student:students(*), teacher:teachers(*)")
    .limit(1)
    .single();

  const t1 = performance.now();
  console.log(`✓ Single joined query resolved in ${(t1 - t0).toFixed(2)}ms`);
  console.log("Result:", {
    id: userWithProfile?.id,
    email: userWithProfile?.email,
    role: userWithProfile?.role,
    student: userWithProfile?.student,
    teacher: userWithProfile?.teacher,
  });
}

main();
