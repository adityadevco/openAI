import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(_request: Request, context: RouteContext<"/api/payout-schedules/[id]/approve">) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("payout_schedules")
    .update({ status: "active", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approval_pending")
    .select("id, amount, currency, frequency, status, next_run_at, approved_at")
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: "Payout schedule not found or not pending approval." }, { status: 404 });
  return NextResponse.json({ success: true, schedule: data, message: "Payout schedule activated. The Friday run remains provider-ready until a payout-creation integration is configured." });
}
