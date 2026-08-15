import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(_request: Request, context: RouteContext<"/api/payment-requests/[id]/approve">) {
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("payment_requests")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approval_pending")
    .select("id, amount, currency, status, purpose, approved_at")
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: "Payment request not found or is no longer pending approval." }, { status: 404 });

  return NextResponse.json({
    success: true,
    request: data,
    message: "Payment request approved. Configure a matching Dodo product before creating a customer checkout link.",
  });
}
