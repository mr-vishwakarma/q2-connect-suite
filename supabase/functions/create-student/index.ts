// Lovable Cloud Function: create-student
// Creates a student auth account + inserts student row without switching the admin session.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreateStudentBody = {
  name: string;
  username: string;
  password: string;
  phone?: string;
  room_no?: string;
  fees?: number | string;
  hostel: "Q2" | "Q2.0" | "Q2.1";
  start_date?: string | null; // yyyy-mm-dd
  valid_date?: string | null; // yyyy-mm-dd
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Server misconfigured" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify caller is an authenticated admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return json(401, { error: "Unauthorized" });

  const { data: userRes, error: userErr } = await adminClient.auth.getUser(jwt);
  if (userErr || !userRes?.user) return json(401, { error: "Unauthorized" });

  const { data: isAdmin, error: roleErr } = await adminClient.rpc("has_role", {
    _user_id: userRes.user.id,
    _role: "admin",
  });

  if (roleErr) return json(500, { error: "Role check failed" });
  if (!isAdmin) return json(403, { error: "Forbidden" });

  let body: CreateStudentBody;
  try {
    body = (await req.json()) as CreateStudentBody;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const name = (body.name ?? "").trim();
  const normalizedUsername = (body.username ?? "").toLowerCase().split("@")[0].trim();
  const password = body.password ?? "";
  const hostel = body.hostel;

  if (!name) return json(400, { error: "Name is required" });
  if (!normalizedUsername) return json(400, { error: "User ID is required" });
  if (!password || password.length < 6) return json(400, { error: "Password must be at least 6 characters" });
  if (!hostel) return json(400, { error: "Hostel is required" });

  // Prevent duplicates (students table is the source of truth)
  const { data: existingStudent, error: existingErr } = await adminClient
    .from("students")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existingErr) return json(500, { error: "Failed to validate User ID" });
  if (existingStudent) return json(409, { error: "User ID already exists" });

  const email = `${normalizedUsername}@q2student.local`;

  // 1) Create auth user
  const { data: createdUser, error: createUserErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createUserErr || !createdUser.user) {
    // Common case: already exists
    return json(409, { error: createUserErr?.message || "Failed to create user" });
  }

  const studentAuthUserId = createdUser.user.id;

  try {
    // 2) Insert student record
    const feesValue =
      body.fees === undefined || body.fees === null || body.fees === ""
        ? null
        : typeof body.fees === "number"
          ? body.fees
          : Number(body.fees);

    const { error: insertErr } = await adminClient.from("students").insert({
      user_id: studentAuthUserId,
      name,
      username: normalizedUsername,
      phone: body.phone ?? null,
      room_no: body.room_no ?? null,
      fees: Number.isFinite(feesValue) ? feesValue : null,
      hostel,
      start_date: body.start_date ?? null,
      valid_date: body.valid_date ?? null,
    });

    if (insertErr) throw insertErr;

    // 3) Assign student role
    const { error: roleInsertErr } = await adminClient.from("user_roles").insert({
      user_id: studentAuthUserId,
      role: "student",
    });

    if (roleInsertErr) throw roleInsertErr;

    return json(200, {
      ok: true,
      user_id: studentAuthUserId,
      username: normalizedUsername,
      hostel,
    });
  } catch (e) {
    // Rollback auth user if DB insert fails
    await adminClient.auth.admin.deleteUser(studentAuthUserId);
    return json(500, { error: e instanceof Error ? e.message : "Failed to register student" });
  }
});
