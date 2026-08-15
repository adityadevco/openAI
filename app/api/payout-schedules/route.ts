import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("payout_schedules")
    .select("id, amount, currency, frequency, day_of_week, purpose, status, next_run_at, created_at, customer:customers(name, email, company)")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, schedules: data ?? [] });
}
