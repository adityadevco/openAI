import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function recoveryPolicy(reason: string | null) {
  const value = (reason ?? "").toLowerCase();
  if (value.includes("authentication")) return { strategy: "send_authentication_link", score: 86, rationale: "Customer authentication is required before a payment retry can succeed." };
  if (value.includes("expired")) return { strategy: "request_updated_payment_method", score: 81, rationale: "An expired card requires an updated payment method." };
  if (value.includes("insufficient")) return { strategy: "retry_in_72_hours", score: 72, rationale: "A delayed retry may succeed after funds are available; approval is required first." };
  if (value.includes("declined")) return { strategy: "request_alternate_payment_method", score: 66, rationale: "Issuer decline needs customer outreach or an alternate payment method." };
  return { strategy: "manual_review", score: 50, rationale: "There is not enough failure detail for an automated recovery recommendation." };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const paymentId = body?.paymentId;

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { success: false, error: "paymentId is required." },
        { status: 400 },
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { success: false, error: "Supabase server credentials are missing." },
        { status: 500 },
      );
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError) {
      console.error("Recovery payment lookup error:", paymentError);
      return NextResponse.json(
        { success: false, error: paymentError.message },
        { status: 500 },
      );
    }

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found." },
        { status: 404 },
      );
    }

    const policy = recoveryPolicy(payment.failure_reason);
    const { data: recoveryCase, error: caseError } = await supabase
      .from("recovery_cases")
      .insert({
        payment_id: payment.id,
        status: "approval_pending",
        strategy: policy.strategy,
        rationale: policy.rationale,
        recovery_score: policy.score,
        draft_message: `Draft only: We noticed your ${payment.currency} payment could not be completed. Please update your payment method or complete the required step.`,
      })
      .select()
      .single();

    if (caseError) {
      const message = caseError.code === "23505"
        ? "An active approval case already exists for this payment."
        : caseError.message;
      return NextResponse.json({ success: false, error: message }, { status: caseError.code === "23505" ? 409 : 500 });
    }

    const { data: event, error: eventError } = await supabase
      .from("payment_events")
      .insert({
        payment_id: payment.id,
        event_type: "recovery.initiated",
        event_data: {
          amount: payment.amount,
          currency: payment.currency,
          failure_reason: payment.failure_reason,
          source: "paypilot",
          recovery_case_id: recoveryCase.id,
          status: "approval_pending",
        },
      })
      .select()
      .single();

    if (eventError) {
      console.error("Recovery event insert error:", eventError);
      return NextResponse.json(
        { success: false, error: eventError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Approval-gated recovery case created. No customer was contacted.",
      recovery: {
        paymentId: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        eventId: event.id,
        caseId: recoveryCase.id,
        status: recoveryCase.status,
        strategy: recoveryCase.strategy,
        recoveryScore: recoveryCase.recovery_score,
      },
    });
  } catch (error) {
    console.error("Recovery API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Recovery failed.",
      },
      { status: 500 },
    );
  }
}
