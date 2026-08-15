import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      message: "Recovery workflow initiated.",
      recovery: {
        paymentId: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        eventId: event.id,
        status: "recovery_initiated",
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
