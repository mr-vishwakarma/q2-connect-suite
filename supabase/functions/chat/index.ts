import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PATTERNS: { pattern: RegExp; type: string }[] = [
  // Student fee queries
  { pattern: /\b(my|mera|meri)\s*(fee|fees|payment|paisa)\b/i, type: "my_fees" },
  { pattern: /\b(fee\s*status|pending\s*fee|how\s*much\s*fee|kitna\s*fee|fees?\s*details?)\b/i, type: "my_fees" },
  // Student room queries
  { pattern: /\b(my|mera|meri)\s*(room|kamra)\b/i, type: "my_room" },
  { pattern: /\b(room\s*number|which\s*room|konsa\s*room)\b/i, type: "my_room" },
  // Student complaint queries
  { pattern: /\b(my|mera|meri)\s*(complaint|complaints|shikayat)\b/i, type: "my_complaints" },
  { pattern: /\b(complaint\s*status|show\s*complaint)/i, type: "my_complaints" },
  // Student suggestion queries
  { pattern: /\b(my|mera|meri)\s*(suggestion|suggestions)\b/i, type: "my_suggestions" },
  // Student leave queries
  { pattern: /\b(my|mera|meri)\s*(leave|mess.?off|chutti)\b/i, type: "my_leaves" },
  { pattern: /\b(leave\s*status|my\s*leave)\b/i, type: "my_leaves" },
  // Student profile
  { pattern: /\b(my|mera|meri)\s*(detail|details|profile|info)\b/i, type: "my_profile" },
  // Admin: total students
  { pattern: /\b(total|kitne|how\s*many|number\s*of)\s*(student|students)\b/i, type: "total_students" },
  // Admin: pending/unpaid fees
  { pattern: /\b(pending|unpaid|remaining)\s*(fee|fees|payment)\b/i, type: "pending_fees" },
  { pattern: /\b(unpaid\s*students)\b/i, type: "pending_fees" },
  // Admin: complaints
  { pattern: /\b(total|kitne|how\s*many)\s*(complaint|complaints)\b/i, type: "total_complaints" },
  { pattern: /\b(pending)\s*(complaint|complaints)\b/i, type: "pending_complaints" },
  // Admin: rooms
  { pattern: /\b(total|kitne|how\s*many)\s*(room|rooms)\b/i, type: "total_rooms" },
  { pattern: /\b(available|khali)\s*(room|rooms)\b/i, type: "available_rooms" },
  { pattern: /\b(room\s*capacity)\b/i, type: "room_capacity" },
  // Admin: leaves
  { pattern: /\b(pending)\s*(leave|leaves|request)\b/i, type: "pending_leaves" },
  // Greetings
  { pattern: /^(hi|hello|hey|namaste|hii+)\b/i, type: "greeting" },
  // Help
  { pattern: /\b(help|what\s*can\s*you|kya\s*kar\s*sakte)\b/i, type: "help" },
];

function detectQueryType(message: string): string | null {
  for (const { pattern, type } of PATTERNS) {
    if (pattern.test(message)) return type;
  }
  return null;
}

async function handleQuery(
  db: ReturnType<typeof createClient>,
  type: string,
  userId: string,
  hostel: string,
  isAdmin: boolean
): Promise<string> {
  try {
    switch (type) {
      case "greeting":
        return isAdmin
          ? `👋 Hello Admin! I'm your **Q2 Campus Hub Assistant** for **${hostel}**.\n\nAsk me about students, fees, rooms, or complaints!`
          : `👋 Hi there! I'm your **Q2 Campus Hub Assistant**.\n\nAsk me about your fees, room, complaints, or leave requests!`;

      case "help":
        return isAdmin
          ? `I can help with:\n• **total students** – student count\n• **pending fees** – unpaid fee records\n• **total rooms** / **available rooms** – room stats\n• **total complaints** / **pending complaints** – complaint summary\n• **pending leaves** – leave requests`
          : `I can help with:\n• **my fee** – your fee details\n• **my room** – your room number\n• **my complaints** – your complaint status\n• **my leave** – your leave requests\n• **my profile** – your profile info`;

      case "my_fees": {
        if (isAdmin) return "Please use admin queries like **pending fees** or **total students**.";
        const { data: student } = await db
          .from("students").select("id, name, fees").eq("user_id", userId).maybeSingle();
        if (!student) return "❌ Student record not found. Please contact admin.";
        const { data: fees } = await db
          .from("fees").select("*").eq("student_id", student.id).order("created_at", { ascending: false }).limit(5);
        if (!fees?.length) return `**${student.name}**, your monthly fee is **₹${student.fees ?? 0}**.\n\nNo payment records found yet.`;
        const summary = fees.map(f => `• **${f.month}**: ₹${f.amount} – ${f.status === 'paid' ? '✅ Paid' : '❌ Unpaid'}`).join("\n");
        return `**Fee Details – ${student.name}**\nMonthly Fee: **₹${student.fees ?? 0}**\n\n${summary}`;
      }

      case "my_room": {
        if (isAdmin) return "Please ask student-specific or admin queries.";
        const { data } = await db
          .from("students").select("name, room_no, hostel").eq("user_id", userId).maybeSingle();
        if (!data) return "❌ Student record not found.";
        return `🏠 **Your Room Details**\n• Name: ${data.name}\n• Room: **${data.room_no ?? "Not assigned"}**\n• Hostel: **${data.hostel ?? "N/A"}**`;
      }

      case "my_complaints": {
        if (isAdmin) return "Use **total complaints** or **pending complaints** for admin view.";
        const { data } = await db
          .from("complaints").select("title, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
        if (!data?.length) return "✅ You have no complaints on record.";
        const list = data.map(c => {
          const status = c.status === 'resolved' ? '✅' : c.status === 'pending' ? '⏳' : '🔄';
          return `• ${status} **${c.title}** – ${c.status} (${new Date(c.created_at).toLocaleDateString()})`;
        }).join("\n");
        return `**Your Complaints**\n${list}`;
      }

      case "my_suggestions": {
        if (isAdmin) return "Use admin-specific queries for suggestions overview.";
        const { data } = await db
          .from("suggestions").select("title, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
        if (!data?.length) return "You have no suggestions on record.";
        const list = data.map(s => `• **${s.title}** – ${s.status}`).join("\n");
        return `**Your Suggestions**\n${list}`;
      }

      case "my_leaves": {
        if (isAdmin) return "Use **pending leaves** for admin view.";
        const { data } = await db
          .from("mess_requests").select("leaving_date, return_date, status, reason").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
        if (!data?.length) return "You have no leave/mess-off requests.";
        const list = data.map(l => {
          const status = l.status === 'approved' ? '✅' : l.status === 'rejected' ? '❌' : '⏳';
          return `• ${status} ${l.leaving_date} → ${l.return_date} – **${l.status}**${l.reason ? ` (${l.reason})` : ""}`;
        }).join("\n");
        return `**Your Leave Requests**\n${list}`;
      }

      case "my_profile": {
        if (isAdmin) return "Use admin queries for student information.";
        const { data } = await db
          .from("students").select("*").eq("user_id", userId).maybeSingle();
        if (!data) return "❌ Student profile not found.";
        return `**Your Profile**\n• Name: **${data.name}**\n• Username: ${data.username}\n• Hostel: **${data.hostel ?? "N/A"}**\n• Room: **${data.room_no ?? "Not assigned"}**\n• Phone: ${data.phone ?? "N/A"}\n• Monthly Fee: **₹${data.fees ?? 0}**`;
      }

      case "total_students": {
        if (!isAdmin) return "🔒 Only admins can view total student counts.";
        const { count } = await db.from("students").select("*", { count: "exact", head: true }).eq("hostel", hostel);
        return `📊 **Total Students in ${hostel}**: **${count ?? 0}**`;
      }

      case "pending_fees": {
        if (!isAdmin) return "🔒 Only admins can view pending fees overview.";
        const { count } = await db.from("fees").select("*", { count: "exact", head: true }).eq("hostel", hostel).eq("status", "unpaid");
        return `💰 **Unpaid Fee Records in ${hostel}**: **${count ?? 0}**`;
      }

      case "total_complaints": {
        if (!isAdmin) return "🔒 Only admins can view total complaint counts.";
        const { count } = await db.from("complaints").select("*", { count: "exact", head: true }).eq("hostel", hostel);
        return `📋 **Total Complaints in ${hostel}**: **${count ?? 0}**`;
      }

      case "pending_complaints": {
        if (!isAdmin) return "🔒 Only admins can view pending complaints.";
        const { count } = await db.from("complaints").select("*", { count: "exact", head: true }).eq("hostel", hostel).eq("status", "pending");
        return `⏳ **Pending Complaints in ${hostel}**: **${count ?? 0}**`;
      }

      case "total_rooms": {
        if (!isAdmin) return "🔒 Only admins can view room counts.";
        const { count } = await db.from("rooms").select("*", { count: "exact", head: true }).eq("hostel", hostel);
        return `🏠 **Total Rooms in ${hostel}**: **${count ?? 0}**`;
      }

      case "available_rooms": {
        if (!isAdmin) return "🔒 Only admins can view available rooms.";
        const { count } = await db.from("rooms").select("*", { count: "exact", head: true }).eq("hostel", hostel).eq("status", "available");
        return `🟢 **Available Rooms in ${hostel}**: **${count ?? 0}**`;
      }

      case "room_capacity": {
        if (!isAdmin) return "🔒 Only admins can view room capacity.";
        const { data } = await db.from("rooms").select("capacity, occupied_count").eq("hostel", hostel);
        if (!data?.length) return `No rooms registered in **${hostel}**.`;
        const totalCap = data.reduce((s, r) => s + r.capacity, 0);
        const totalOcc = data.reduce((s, r) => s + r.occupied_count, 0);
        return `🏠 **Room Capacity in ${hostel}**\n• Total Capacity: **${totalCap}**\n• Occupied: **${totalOcc}**\n• Available Spots: **${totalCap - totalOcc}**`;
      }

      case "pending_leaves": {
        if (!isAdmin) return "🔒 Only admins can view pending leave requests.";
        const { count } = await db.from("mess_requests").select("*", { count: "exact", head: true }).eq("hostel", hostel).eq("status", "pending");
        return `📝 **Pending Leave Requests in ${hostel}**: **${count ?? 0}**`;
      }

      default:
        return "Sorry, I couldn't process that query.";
    }
  } catch (err) {
    console.error("DB query error:", err);
    return "❌ Sorry, I encountered an error fetching data. Please try again.";
  }
}

const DEFAULT_RESPONSE = `🤔 Sorry, I can only answer hostel-related queries.\n\nTry asking:\n• **my fee** / **my room** / **my complaints**\n• **total students** / **pending fees**\n• **available rooms** / **pending complaints**\n• **help** – to see all options`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, hostel, isAdmin, userId } = await req.json();

    if (!message || !userId) {
      return new Response(JSON.stringify({ error: "Message and userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const queryType = detectQueryType(message);

    if (!queryType) {
      return new Response(JSON.stringify({ response: DEFAULT_RESPONSE, source: "database" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await handleQuery(db, queryType, userId, hostel || "Q2", isAdmin || false);
    return new Response(JSON.stringify({ response, source: "database" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
