// Deep diagnostic - checks what tables actually exist
const SUPABASE_URL = "https://crmlhrxktfgusbaieurv.supabase.co";
const ANON_KEY = "sb_publishable_jDwWMT5wpCmkp3nORkEdzw_5g8Y_2uT";

const tables = [
  "profiles", "posts", "post_media", "friendships", "friend_requests",
  "notifications", "conversations", "conversation_participants", "messages",
  "reactions", "comments", "post_tags", "reels"
];

async function checkTable(name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${name}?limit=0`, {
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
      "Prefer": "count=exact",
    },
  });
  const range = res.headers.get("content-range");
  const body = res.status !== 200 ? await res.text() : "";
  return { name, status: res.status, range, error: body.substring(0, 100) };
}

async function main() {
  console.log("=== Table Existence Check ===\n");
  const results = await Promise.all(tables.map(checkTable));
  
  for (const r of results) {
    const icon = r.status === 200 ? "✅" : "❌";
    const rows = r.range ? r.range.replace("*/", "") + " rows" : "";
    console.log(`${icon} ${r.name.padEnd(30)} status=${r.status} ${rows}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  }
  
  // Now try inserting a notification without auth (should fail with 401)
  console.log("\n=== Notification Insert Test (no auth - expect 401) ===");
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: "POST",
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: "00000000-0000-0000-0000-000000000001",
      sender_id: "00000000-0000-0000-0000-000000000002",
      type: "friend_request",
      target_type: "friend_request",
      target_id: "00000000-0000-0000-0000-000000000003",
    }),
  });
  console.log("Status:", insertRes.status);
  console.log("Body:", (await insertRes.text()).substring(0, 300));
}

main().catch(console.error);
