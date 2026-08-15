import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

type ToolActivity = { tool: string; label: string; status: "completed" | "failed" };
type PaymentRow = { id: string; customer_id: string | null; amount: number | string; currency: string; status: string; failure_reason: string | null; created_at: string; customer?: { name: string; email: string; company: string | null }[] | null };

const toolDefinitions: OpenAI.Responses.FunctionTool[] = [
  { type: "function", name: "get_recovery_queue", description: "Fetch the highest-priority failed payments. Returns payment IDs, amounts, failure reasons, and customer details.", parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true },
  { type: "function", name: "get_customer_payment_history", description: "Fetch aggregate payment history for one customer. Use it to support a recovery recommendation with evidence.", parameters: { type: "object", properties: { customer_id: { type: "string", description: "The customer UUID." } }, required: ["customer_id"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_recovery_policy", description: "Return the safe, deterministic recovery policy for a payment failure reason. This tool never contacts a customer.", parameters: { type: "object", properties: { failure_reason: { type: "string", description: "The payment failure reason." } }, required: ["failure_reason"], additionalProperties: false }, strict: true },
];

function policyFor(reason: string) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("insufficient")) return { strategy: "retry_in_72_hours", score: 72, rationale: "Balance-related failures often benefit from a delayed retry; do not retry more than once without approval." };
  if (normalized.includes("authentication")) return { strategy: "send_authentication_link", score: 86, rationale: "The customer needs to complete authentication before a retry can succeed." };
  if (normalized.includes("expired")) return { strategy: "request_updated_payment_method", score: 81, rationale: "An expired card requires a new payment method rather than an automatic retry." };
  if (normalized.includes("declined")) return { strategy: "request_alternate_payment_method", score: 66, rationale: "Issuer declines need customer outreach or an alternate payment method; do not automatically retry." };
  return { strategy: "manual_review", score: 50, rationale: "The reason is not specific enough for automatic action. Request human review." };
}

function paymentSummary(payment: PaymentRow) {
  const customer = Array.isArray(payment.customer) ? payment.customer[0] : undefined;
  return { id: payment.id, customerId: payment.customer_id, customer: customer ? { company: customer.company, name: customer.name } : null, amount: Number(payment.amount), currency: payment.currency, failureReason: payment.failure_reason, createdAt: payment.created_at };
}

async function executeTool(name: string, args: Record<string, string>, supabase: SupabaseClient) {
  if (name === "get_recovery_queue") {
    const { data, error } = await supabase.from("payments").select("id, customer_id, amount, currency, status, failure_reason, created_at, customer:customers(name, email, company)").eq("status", "failed").order("amount", { ascending: false }).limit(10);
    if (error) throw new Error(error.message);
    return ((data as unknown as PaymentRow[] | null) ?? []).map(paymentSummary);
  }
  if (name === "get_customer_payment_history") {
    const { data, error } = await supabase.from("payments").select("id, amount, status, failure_reason, created_at").eq("customer_id", args.customer_id).order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    const payments = data ?? [];
    const successful = payments.filter((payment) => payment.status === "success");
    const failed = payments.filter((payment) => payment.status === "failed");
    return { paymentCount: payments.length, successfulCount: successful.length, failedCount: failed.length, successfulValue: successful.reduce((sum, payment) => sum + Number(payment.amount), 0), recentPayments: payments.slice(0, 5) };
  }
  if (name === "get_recovery_policy") return policyFor(args.failure_reason);
  throw new Error(`Unsupported tool: ${name}`);
}

export async function runRecoveryAgent(question: string, supabase: SupabaseClient) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing from the server environment.");
  const client = new OpenAI({ apiKey });
  const activity: ToolActivity[] = [];
  let response = await client.responses.create({
    model: "gpt-5.6-luna", reasoning: { effort: "low" }, text: { verbosity: "low" }, tools: toolDefinitions,
    input: `You are PayPilot Recovery Agent. Answer the operator's question using tools for payment facts. You must never claim outreach, charging, refunds, retries, or recovery was performed. Recommend only approval-gated actions. Cite payment IDs and evidence you received from tools.\n\nOperator question: ${question}`,
  });
  for (let turn = 0; turn < 4; turn += 1) {
    const calls = response.output.filter((item) => item.type === "function_call");
    if (!calls.length) break;
    const outputs = await Promise.all(calls.map(async (call) => {
      try {
        const result = await executeTool(call.name, JSON.parse(call.arguments) as Record<string, string>, supabase);
        activity.push({ tool: call.name, label: call.name.replaceAll("_", " "), status: "completed" });
        return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(result) };
      } catch (error) {
        activity.push({ tool: call.name, label: call.name.replaceAll("_", " "), status: "failed" });
        return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify({ error: error instanceof Error ? error.message : "Tool failed" }) };
      }
    }));
    response = await client.responses.create({ model: "gpt-5.6-luna", previous_response_id: response.id, tools: toolDefinitions, input: outputs });
  }
  return { answer: response.output_text || "The agent could not produce an answer.", activity, responseId: response.id };
}
