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
  const phone = (body.phone ?? "").trim();

  // Validate name
  if (!name) return json(400, { error: "Name is required" });
  if (name.length > 100) return json(400, { error: "Name must be less than 100 characters" });
  if (!/^[a-zA-Z\s.\-']+$/.test(name)) return json(400, { error: "Name contains invalid characters" });

  // Validate username format
  if (!normalizedUsername) return json(400, { error: "User ID is required" });
  const usernameRegex = /^[a-z0-9._\-]{3,50}$/;
  if (!usernameRegex.test(normalizedUsername)) {
    return json(400, { error: "User ID must be 3-50 characters and contain only letters, numbers, dots, hyphens, or underscores" });
  }

  // Validate password
  if (!password || password.length < 6) return json(400, { error: "Password must be at least 6 characters" });
  if (password.length > 72) return json(400, { error: "Password must be less than 72 characters" });

  // Validate hostel enum
  const validHostels = ["Q2", "Q2.0", "Q2.1"];
  if (!hostel || !validHostels.includes(hostel)) return json(400, { error: "Invalid hostel value" });

  // Validate phone if provided
  if (phone && !/^[\d\s+()-]{7,20}$/.test(phone)) {
    return json(400, { error: "Invalid phone number format" });
  }

  // Validate dates if provided
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (body.start_date && !dateRegex.test(body.start_date)) {
    return json(400, { error: "Invalid start date format" });
  }
  if (body.valid_date && !dateRegex.test(body.valid_date)) {
    return json(400, { error: "Invalid end date format" });
  }

  // Validate fees if provided
  if (body.fees !== undefined && body.fees !== null && body.fees !== "") {
    const feesNum = typeof body.fees === "number" ? body.fees : Number(body.fees);
    if (!Number.isFinite(feesNum) || feesNum < 0 || feesNum > 1000000) {
      return json(400, { error: "Fees must be a valid number between 0 and 1,000,000" });
    }
  }

  // Prevent duplicates (students table is the source of truth)
  const { data: existingStudent, error: existingErr } = await adminClient
    .from("students")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (existingErr) return json(500, { error: "Failed to validate User ID" });
  if (existingStudent) return json(409, { error: "User ID already exists" });

  const email = `${normalizedUsername}@q2student.local`;

  // 1) Create auth user (or reuse if an orphaned auth user exists from a prior failed attempt)
  let studentAuthUserId: string | null = null;
  let createdNewAuthUser = false;

  const { data: createdUser, error: createUserErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createUserErr || !createdUser?.user) {
    const msg = (createUserErr?.message || "").toLowerCase();
    const isDuplicate = msg.includes("already") || msg.includes("registered") || msg.includes("exists");

    if (!isDuplicate) {
      return json(500, { error: createUserErr?.message || "Failed to create user" });
    }

    // Find existing auth user by email (paginate defensively)
    let foundId: string | null = null;
    for (let page = 1; page <= 20 && !foundId; page++) {
      const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) break;
      const match = list.users.find((u) => (u.email || "").toLowerCase() === email);
      if (match) foundId = match.id;
      if (!list.users.length || list.users.length < 200) break;
    }

    if (!foundId) {
      return json(409, { error: "User ID already exists" });
    }

    // Ensure no student row already linked to this auth user
    const { data: linked } = await adminClient
      .from("students")
      .select("id")
      .eq("user_id", foundId)
      .maybeSingle();
    if (linked) {
      return json(409, { error: "User ID already exists" });
    }

    studentAuthUserId = foundId;
  } else {
    studentAuthUserId = createdUser.user.id;
    createdNewAuthUser = true;
  }

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
      phone: phone || null,
      room_no: body.room_no ?? null,
      fees: Number.isFinite(feesValue) ? feesValue : null,
      hostel,
      start_date: body.start_date ?? null,
      valid_date: body.valid_date ?? null,
    });

    if (insertErr) throw insertErr;

    // 3) Assign student role (ignore if already exists)
    const { error: roleInsertErr } = await adminClient.from("user_roles").insert({
      user_id: studentAuthUserId,
      role: "student",
    });

    if (roleInsertErr && !String(roleInsertErr.message || "").toLowerCase().includes("duplicate")) {
      throw roleInsertErr;
    }

    return json(200, {
      ok: true,
      user_id: studentAuthUserId,
      username: normalizedUsername,
      hostel,
    });
  } catch (e) {
    // Only rollback the auth user if we created it in this request
    if (createdNewAuthUser && studentAuthUserId) {
      await adminClient.auth.admin.deleteUser(studentAuthUserId);
    }
    return json(500, { error: e instanceof Error ? e.message : "Failed to register student" });
  }
});
