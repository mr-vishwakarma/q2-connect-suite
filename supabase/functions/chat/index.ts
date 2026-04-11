import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple query patterns that can be answered from DB
const DB_PATTERNS: { pattern: RegExp; type: string }[] = [
  { pattern: /\b(my|mera|meri)\s*(fee|fees|payment|paisa)\b/i, type: "my_fees" },
  { pattern: /\b(my|mera|meri)\s*(room|kamra)\b/i, type: "my_room" },
  { pattern: /\b(my|mera|meri)\s*(complaint|complaints|shikayat)\b/i, type: "my_complaints" },
  { pattern: /\b(my|mera|meri)\s*(suggestion|suggestions)\b/i, type: "my_suggestions" },
  { pattern: /\b(my|mera|meri)\s*(leave|mess.?off|chutti)\b/i, type: "my_leaves" },
  { pattern: /\b(my|mera|meri)\s*(detail|details|profile|info)\b/i, type: "my_profile" },
  { pattern: /\b(total|kitne|how many)\s*(student|students)\b/i, type: "total_students" },
  { pattern: /\b(pending|unpaid)\s*(fee|fees|payment)\b/i, type: "pending_fees" },
  { pattern: /\b(total|kitne|how many)\s*(complaint|complaints)\b/i, type: "total_complaints" },
  { pattern: /\b(total|kitne|how many)\s*(room|rooms)\b/i, type: "total_rooms" },
  { pattern: /\b(available|khali)\s*(room|rooms)\b/i, type: "available_rooms" },
  { pattern: /\b(pending)\s*(complaint|complaints)\b/i, type: "pending_complaints" },
  { pattern: /\b(pending)\s*(leave|leaves|request)\b/i, type: "pending_leaves" },
];

function detectQueryType(message: string): string | null {
  for (const { pattern, type } of DB_PATTERNS) {
    if (pattern.test(message)) return type;
  }
  return null;
}

async function handleDbQuery(
  supabaseAdmin: ReturnType<typeof createClient>,
  queryType: string,
  userId: string,
  hostel: string,
  isAdmin: boolean
): Promise<string> {
  try {
    switch (queryType) {
      case "my_fees": {
        const { data: student } = await supabaseAdmin
          .from("students").select("id, name, fees").eq("user_id", userId).maybeSingle();
        if (!student) return "I couldn't find your student record. Please contact admin.";
        const { data: fees } = await supabaseAdmin
          .from("fees").select("*").eq("student_id", student.id).order("created_at", { ascending: false }).limit(5);
        if (!fees?.length) return `No fee records found for you (${student.name}). Your monthly fee is ₹${student.fees ?? 0}.`;
        const summary = fees.map(f => `• ${f.month}: ₹${f.amount} - ${f.status}`).join("\n");
        return `**Fee Details for ${student.name}**\nMonthly Fee: ₹${student.fees ?? 0}\n\nRecent Records:\n${summary}`;
      }
      case "my_room": {
        const { data } = await supabaseAdmin
          .from("students").select("name, room_no, hostel").eq("user_id", userId).maybeSingle();
        if (!data) return "Student record not found.";
        return `**Your Room Details**\nName: ${data.name}\nRoom: ${data.room_no ?? "Not assigned"}\nHostel: ${data.hostel ?? "N/A"}`;
      }
      case "my_complaints": {
        const { data } = await supabaseAdmin
          .from("complaints").select("title, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
        if (!data?.length) return "You have no complaints on record.";
        const list = data.map(c => `• **${c.title}** - ${c.status} (${new Date(c.created_at).toLocaleDateString()})`).join("\n");
        return `**Your Complaints**\n${list}`;
      }
      case "my_suggestions": {
        const { data } = await supabaseAdmin
          .from("suggestions").select("title, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
        if (!data?.length) return "You have no suggestions on record.";
        const list = data.map(s => `• **${s.title}** - ${s.status}`).join("\n");
        return `**Your Suggestions**\n${list}`;
      }
      case "my_leaves": {
        const { data } = await supabaseAdmin
          .from("mess_requests").select("leaving_date, return_date, status, reason").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
        if (!data?.length) return "You have no leave/mess-off requests.";
        const list = data.map(l => `• ${l.leaving_date} to ${l.return_date} - ${l.status}${l.reason ? ` (${l.reason})` : ""}`).join("\n");
        return `**Your Leave Requests**\n${list}`;
      }
      case "my_profile": {
        const { data } = await supabaseAdmin
          .from("students").select("*").eq("user_id", userId).maybeSingle();
        if (!data) return "Student profile not found.";
        return `**Your Profile**\nName: ${data.name}\nUsername: ${data.username}\nHostel: ${data.hostel ?? "N/A"}\nRoom: ${data.room_no ?? "Not assigned"}\nPhone: ${data.phone ?? "N/A"}\nFees: ₹${data.fees ?? 0}`;
      }
      case "total_students": {
        if (!isAdmin) return "Only admins can view total student counts.";
        const { count } = await supabaseAdmin.from("students").select("*", { count: "exact", head: true }).eq("hostel", hostel);
        return `**Total Students in ${hostel}**: ${count ?? 0}`;
      }
      case "pending_fees": {
        if (!isAdmin) return "Only admins can view pending fees overview.";
        const { count } = await supabaseAdmin.from("fees").select("*", { count: "exact", head: true }).eq("hostel", hostel).eq("status", "unpaid");
        return `**Pending (Unpaid) Fees in ${hostel}**: ${count ?? 0} records`;
      }
      case "total_complaints": {
        if (!isAdmin) return "Only admins can view total complaint counts.";
        const { count } = await supabaseAdmin.from("complaints").select("*", { count: "exact", head: true }).eq("hostel", hostel);
        return `**Total Complaints in ${hostel}**: ${count ?? 0}`;
      }
      case "total_rooms": {
        if (!isAdmin) return "Only admins can view room counts.";
        const { count } = await supabaseAdmin.from("rooms").select("*", { count: "exact", head: true }).eq("hostel", hostel);
        return `**Total Rooms in ${hostel}**: ${count ?? 0}`;
      }
      case "available_rooms": {
        if (!isAdmin) return "Only admins can view available rooms.";
        const { count } = await supabaseAdmin.from("rooms").select("*", { count: "exact", head: true }).eq("hostel", hostel).eq("status", "available");
        return `**Available Rooms in ${hostel}**: ${count ?? 0}`;
      }
      case "pending_complaints": {
        if (!isAdmin) return "Only admins can view pending complaints.";
        const { count } = await supabaseAdmin.from("complaints").select("*", { count: "exact", head: true }).eq("hostel", hostel).eq("status", "pending");
        return `**Pending Complaints in ${hostel}**: ${count ?? 0}`;
      }
      case "pending_leaves": {
        if (!isAdmin) return "Only admins can view pending leave requests.";
        const { count } = await supabaseAdmin.from("mess_requests").select("*", { count: "exact", head: true }).eq("hostel", hostel).eq("status", "pending");
        return `**Pending Leave Requests in ${hostel}**: ${count ?? 0}`;
      }
      default:
        return "I couldn't process that query.";
    }
  } catch (err) {
    console.error("DB query error:", err);
    return "Sorry, I encountered an error fetching data. Please try again.";
  }
}

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Check for simple DB query
    const queryType = detectQueryType(message);
    if (queryType) {
      const dbResponse = await handleDbQuery(supabaseAdmin, queryType, userId, hostel || "Q2", isAdmin || false);
      return new Response(JSON.stringify({ response: dbResponse, source: "database" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Use AI for complex queries
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather context for AI
    let context = "";
    if (isAdmin) {
      const { count: studentCount } = await supabaseAdmin.from("students").select("*", { count: "exact", head: true }).eq("hostel", hostel || "Q2");
      const { count: complaintCount } = await supabaseAdmin.from("complaints").select("*", { count: "exact", head: true }).eq("hostel", hostel || "Q2");
      const { count: roomCount } = await supabaseAdmin.from("rooms").select("*", { count: "exact", head: true }).eq("hostel", hostel || "Q2");
      const { count: pendingFees } = await supabaseAdmin.from("fees").select("*", { count: "exact", head: true }).eq("hostel", hostel || "Q2").eq("status", "unpaid");
      context = `Admin context for hostel ${hostel}: ${studentCount} students, ${complaintCount} complaints, ${roomCount} rooms, ${pendingFees} unpaid fees.`;
    } else {
      const { data: student } = await supabaseAdmin.from("students").select("*").eq("user_id", userId).maybeSingle();
      if (student) {
        context = `Student: ${student.name}, Hostel: ${student.hostel}, Room: ${student.room_no ?? "unassigned"}, Fees: ₹${student.fees ?? 0}.`;
      }
    }

    const systemPrompt = `You are Q2 Campus Hub Assistant, an AI helper for a hostel management system. 
You help ${isAdmin ? "administrators" : "students"} with hostel-related queries.
Current hostel context: ${hostel || "Q2"}.
${context}
Keep responses concise, helpful, and formatted with markdown. Use ₹ for currency.
If asked about specific data you don't have, suggest the user check the relevant section in the dashboard.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact admin." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ response: aiResponse, source: "ai" }), {
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
