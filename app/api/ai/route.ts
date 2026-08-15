import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    console.log("=== PAYPILOT AI REQUEST ===");

    const body = await request.json();
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a question.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------
    // 1. Gemini configuration
    // ---------------------------------------------

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GEMINI_API_KEY is missing from .env.local.",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    console.log("Gemini API configured");

    // ---------------------------------------------
    // 2. Fetch payments from Supabase
    // ---------------------------------------------

    const { data: payments, error: paymentsError } =
      await supabase
        .from("payments")
        .select(`
          id,
          amount,
          currency,
          status,
          payment_method,
          failure_reason,
          created_at,
          customer:customers (
            name,
            email,
            company,
            segment,
            country
          )
        `)
        .order("created_at", {
          ascending: false,
        });

    if (paymentsError) {
      console.error(
        "SUPABASE ERROR:",
        paymentsError
      );

      return NextResponse.json(
        {
          success: false,
          error: `Supabase error: ${paymentsError.message}`,
        },
        { status: 500 }
      );
    }

    const paymentData = payments ?? [];

    console.log(
      `Loaded ${paymentData.length} payments`
    );

    // ---------------------------------------------
    // 3. Calculate payment intelligence
    // ---------------------------------------------

    const successful = paymentData.filter(
      (payment) => payment.status === "success"
    );

    const failed = paymentData.filter(
      (payment) => payment.status === "failed"
    );

    const refunded = paymentData.filter(
      (payment) => payment.status === "refunded"
    );

    const totalRevenue = successful.reduce(
      (sum, payment) =>
        sum + Number(payment.amount),
      0
    );

    const revenueAtRisk = failed.reduce(
      (sum, payment) =>
        sum + Number(payment.amount),
      0
    );

    const refundedAmount = refunded.reduce(
      (sum, payment) =>
        sum + Number(payment.amount),
      0
    );

    const context = {
      summary: {
        totalPayments: paymentData.length,
        successfulPayments: successful.length,
        failedPayments: failed.length,
        refundedPayments: refunded.length,
        totalRevenue,
        revenueAtRisk,
        refundedAmount,
      },

      failedPayments: failed.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        failureReason:
          payment.failure_reason,
        paymentMethod:
          payment.payment_method,
        customer: payment.customer,
        createdAt: payment.created_at,
      })),

      recentPayments: paymentData
        .slice(0, 30)
        .map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          currency: payment.currency,
          status: payment.status,
          failureReason:
            payment.failure_reason,
          paymentMethod:
            payment.payment_method,
          customer: payment.customer,
          createdAt: payment.created_at,
        })),
    };

    // ---------------------------------------------
    // 4. Build PayPilot AI prompt
    // ---------------------------------------------

    const prompt = `
You are PayPilot AI, an intelligent payment
operations analyst.

You help businesses understand their payment
infrastructure and recover lost revenue.

USER QUESTION:
${question}

PAYMENT DATA:
${JSON.stringify(context, null, 2)}

Your responsibilities:

1. Analyze the payment data.
2. Answer the user's question directly.
3. Identify failed payments and revenue at risk.
4. Prioritize recovery opportunities.
5. Detect unusual payment patterns.
6. Recommend practical next actions.

Rules:

- Use ONLY the supplied payment data.
- Never invent customers or transactions.
- Never invent amounts or statistics.
- If the data does not support a conclusion,
  explicitly say so.
- Prioritize high-value recoverable payments.
- Explain WHY you recommend an action.
- Keep the response concise.
- Use ₹ for INR values.
- Format important numbers clearly.

You are not a generic chatbot.

You are the payment intelligence layer
inside PayPilot.
`;

    // ---------------------------------------------
    // 5. Ask Gemini
    // ---------------------------------------------

    console.log("Sending request to Gemini...");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const answer = response.text;

    if (!answer) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    console.log(
      "Gemini response received successfully"
    );

    // ---------------------------------------------
    // 6. Return AI response
    // ---------------------------------------------

    return NextResponse.json({
      success: true,
      question,
      answer,
    });

  } catch (error: unknown) {
    console.error(
      "=== PAYPILOT AI ERROR ==="
    );

    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unknown PayPilot AI error.",
      },
      { status: 500 }
    );
  }
}