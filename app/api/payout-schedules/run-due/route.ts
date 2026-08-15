import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function nextFridayAfter(date: Date) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString();
}

export async function POST(request: Request) {
  if (!process.env.SCHEDULE_SECRET || request.headers.get("x-schedule-secret") !== process.env.SCHEDULE_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized scheduler request." }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data: schedules, error } = await supabase
    .from("payout_schedules")
    .select("id, amount, currency, next_run_at")
    .eq("status", "active")
    .lte("next_run_at", now);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const due = schedules ?? [];
  const results = [];

  for (const schedule of due) {
    const { data: run, error: runError } = await supabase
      .from("payout_runs")
      .insert({ payout_schedule_id: schedule.id, scheduled_for: schedule.next_run_at, amount: schedule.amount, currency: schedule.currency, status: "awaiting_provider" })
      .select("id, status")
      .single();
    if (runError) {
      results.push({ scheduleId: schedule.id, error: runError.message });
      continue;
    }

    await supabase.from("payout_schedules").update({ next_run_at: nextFridayAfter(new Date(schedule.next_run_at)) }).eq("id", schedule.id);
    results.push({ scheduleId: schedule.id, runId: run.id, status: run.status });
  }

  return NextResponse.json({ success: true, dueCount: due.length, results, message: "Due payout runs were recorded as provider-ready instructions. No money was moved." });
}
