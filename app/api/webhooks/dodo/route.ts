import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    const webhookId = request.headers.get("webhook-id");
    const webhookSignature = request.headers.get("webhook-signature");
    const webhookTimestamp = request.headers.get("webhook-timestamp");

    const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
    const allowUnsignedLocalTest =
      process.env.DODO_ALLOW_UNSIGNED_LOCAL_TEST === "true";

    if (!webhookSecret) {
      console.error("DODO_WEBHOOK_SECRET is missing.");

      return NextResponse.json(
        {
          success: false,
          error: "Dodo webhook secret is not configured.",
        },
        { status: 500 },
      );
    }

    let payload: Record<string, unknown>;

    /*
     * dodo wh trigger sends unsigned mock events.
     *
     * We allow those ONLY when explicitly enabled for
     * local development.
     *
     * Real Dodo webhooks must always be signed.
     */
    if (
      !webhookId ||
      !webhookSignature ||
      !webhookTimestamp
    ) {
      if (!allowUnsignedLocalTest) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing Dodo webhook signature headers.",
          },
          { status: 400 },
        );
      }

      console.warn(
        "⚠️ Accepting unsigned Dodo webhook because local test mode is enabled.",
      );

      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } else {
      const verifier = new Webhook(webhookSecret);

      verifier.verify(rawBody, {
        "webhook-id": webhookId,
        "webhook-signature": webhookSignature,
        "webhook-timestamp": webhookTimestamp,
      });

      payload = JSON.parse(rawBody) as Record<string, unknown>;
    }

    console.log("Dodo webhook received:", payload);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase server credentials are missing.",
        },
        { status: 500 },
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const eventType = typeof payload.type === "string" ? payload.type : "unknown";

    /*
     * Store the webhook event.
     *
     * We will connect the Dodo payment ID to the
     * PayPilot payment ID when checkout is implemented.
     */
    const { error: eventError } = await supabase
      .from("payment_events")
      .insert({
        event_type: `dodo.${eventType}`,
        event_data: payload,
      });

    if (eventError) {
      console.error(
        "Failed to store Dodo webhook:",
        eventError,
      );

      return NextResponse.json(
        {
          success: false,
          error: eventError.message,
        },
        { status: 500 },
      );
    }

    // When a future payout-provider integration stores Dodo's payout ID on a run,
    // signed payout webhooks close the loop without trusting browser input.
    if (eventType.startsWith("payout.")) {
      const eventData = payload.data;
      if (eventData && typeof eventData === "object" && "payout_id" in eventData && typeof eventData.payout_id === "string") {
        const status = eventType === "payout.success"
          ? "success"
          : eventType === "payout.failed"
            ? "failed"
            : "processing";
        const update: { status: string; completed_at?: string } = { status };
        if (status === "success" || status === "failed") update.completed_at = new Date().toISOString();
        const { error: payoutRunError } = await supabase
          .from("payout_runs")
          .update(update)
          .eq("provider_payout_id", eventData.payout_id);
        if (payoutRunError) console.error("Failed to update payout run:", payoutRunError);
      }
    }

    return NextResponse.json({
      success: true,
      received: true,
      eventType,
    });
  } catch (error) {
    console.error("Dodo webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 400 },
    );
  }
}
