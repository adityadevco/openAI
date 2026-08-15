import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: payments, error } = await supabase
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
          company
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const allPayments = payments ?? [];

    const successfulPayments = allPayments.filter(
      (payment) => payment.status === "success"
    );

    const failedPayments = allPayments.filter(
      (payment) => payment.status === "failed"
    );

    const refundedPayments = allPayments.filter(
      (payment) => payment.status === "refunded"
    );

    const totalRevenue = successfulPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    const revenueAtRisk = failedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    const refundedAmount = refundedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    const recoveryOpportunities = failedPayments
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
      .map((payment) => ({
        id: payment.id,
        customer: payment.customer,
        amount: Number(payment.amount),
        reason: payment.failure_reason,
        priority:
          Number(payment.amount) >= 50000
            ? "HIGH"
            : Number(payment.amount) >= 25000
              ? "MEDIUM"
              : "LOW",
      }));

    return NextResponse.json({
      success: true,

      metrics: {
        totalRevenue,
        revenueAtRisk,
        successfulPayments: successfulPayments.length,
        failedPayments: failedPayments.length,
        refundedAmount,
        totalPayments: allPayments.length,
      },

      payments: allPayments.slice(0, 10),

      recoveryOpportunities,
    });
  } catch (error) {
    console.error("Payments API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load payment data",
      },
      { status: 500 }
    );
  }
}