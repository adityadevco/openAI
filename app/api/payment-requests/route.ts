import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("payment_requests")
    .select("id, amount, currency, purpose, status, created_at, customer:customers(name, email, company)")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, requests: data ?? [] });
}
