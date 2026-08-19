import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// Load .env.local
const envLocal = fs.readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envLocal
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runNotificationsVerification() {
  console.log("==================================================");
  console.log("PHASE 4: REALTIME NOTIFICATIONS & READ STATUS AUDIT");
  console.log("==================================================");

  // 1. Fetch student user
  console.log("\n[1/5] Fetching Student User...");
  const { data: students, error: sErr } = await supabaseAdmin
    .from("students")
    .select("*, user:users(*)")
    .limit(1);

  if (sErr) throw sErr;
  const student = students[0];
  const userId = student.user_id;

  console.log(`✓ Student: ${student.user?.name} (User ID: ${userId})`);

  // 2. Insert Test Notifications
  console.log("\n[2/5] Inserting Test Notifications into Supabase...");
  const { data: n1, error: n1Err } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      type: "class",
      title: "Class in 15 Minutes: Mathematics Live",
      message: "Join room for Quadratic Equations discussion.",
      read: false,
    })
    .select()
    .single();

  if (n1Err) throw n1Err;

  const { data: n2, error: n2Err } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      type: "content",
      title: "New Lecture Notes Available",
      message: "CBSE Chapter 4 Formula sheet has been uploaded.",
      read: false,
    })
    .select()
    .single();

  if (n2Err) throw n2Err;

  console.log(`✓ Created 2 notifications in Supabase: (ID1: ${n1.id}, ID2: ${n2.id})`);

  // 3. Query Unread Count for these notifications
  console.log("\n[3/5] Querying Unread Notification Count from Supabase...");
  const { data: unreadList, error: countErr } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .in("id", [n1.id, n2.id])
    .eq("read", false);

  if (countErr) throw countErr;
  if (unreadList.length !== 2) {
    throw new Error(`Expected 2 unread notifications, got ${unreadList.length}`);
  }
  console.log(`✓ Unread count verified: ${unreadList.length} notifications.`);

  // 4. Mark Single Notification as Read
  console.log("\n[4/5] Marking Single Notification as Read...");
  const { data: updatedN1, error: un1Err } = await supabaseAdmin
    .from("notifications")
    .update({ read: true, updated_at: new Date().toISOString() })
    .eq("id", n1.id)
    .select()
    .single();

  if (un1Err) throw un1Err;
  if (!updatedN1.read) throw new Error("Notification read flag was not updated!");
  console.log(`✓ Notification 1 read status: ${updatedN1.read}`);

  const { data: remList } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .in("id", [n1.id, n2.id])
    .eq("read", false);

  if (remList.length !== 1 || remList[0].id !== n2.id) {
    throw new Error(`Expected 1 remaining unread notification (n2), got ${remList.length}`);
  }
  console.log(`✓ Remaining unread count verified: ${remList.length} (n2 is still unread)`);

  // 5. Mark All As Read for this User
  console.log("\n[5/5] Marking All Notifications As Read for User...");
  const { data: markedAll, error: markAllErr } = await supabaseAdmin
    .from("notifications")
    .update({ read: true, updated_at: new Date().toISOString() })
    .in("id", [n1.id, n2.id])
    .select();

  if (markAllErr) throw markAllErr;
  console.log(`✓ Batch marked ${markedAll.length} notification(s) as read in Supabase.`);

  const { data: finalList } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .in("id", [n1.id, n2.id])
    .eq("read", false);

  if (finalList.length !== 0) {
    throw new Error(`Expected 0 unread notifications after markAllAsRead, got ${finalList.length}`);
  }
  console.log(
    `✓ All notifications confirmed read in Supabase (Unread count: ${finalList.length}).`,
  );

  // Cleanup test notifications
  await supabaseAdmin.from("notifications").delete().in("id", [n1.id, n2.id]);
  console.log("✓ Cleaned up test notifications.");

  console.log("\n==================================================");
  console.log("PHASE 4 NOTIFICATIONS CHECKS PASSED!");
  console.log("==================================================");
}

runNotificationsVerification().catch((err) => {
  console.error("Notifications verification failed:", err);
  process.exit(1);
});
