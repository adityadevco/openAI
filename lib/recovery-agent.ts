import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

type ToolActivity = { tool: string; label: string; status: "completed" | "failed" };
type PaymentRow = { id: string; customer_id: string | null; amount: number | string; currency: string; status: string; failure_reason: string | null; created_at: string; customer?: { name: string; email: string; company: string | null }[] | null };

const toolDefinitions: OpenAI.Responses.FunctionTool[] = [
  { type: "function", name: "find_customer", description: "Find a PayPilot customer by name, company, or exact email before creating a payment request.", parameters: { type: "object", properties: { query: { type: "string", description: "Customer name, company, or email." } }, required: ["query"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_recovery_queue", description: "Fetch the highest-priority failed payments. Returns payment IDs, amounts, failure reasons, and customer details.", parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true },
  { type: "function", name: "get_customer_payment_history", description: "Fetch aggregate payment history for one customer. Use it to support a recovery recommendation with evidence.", parameters: { type: "object", properties: { customer_id: { type: "string", description: "The customer UUID." } }, required: ["customer_id"], additionalProperties: false }, strict: true },
  { type: "function", name: "get_recovery_policy", description: "Return the safe, deterministic recovery policy for a payment failure reason. This tool never contacts a customer.", parameters: { type: "object", properties: { failure_reason: { type: "string", description: "The payment failure reason." } }, required: ["failure_reason"], additionalProperties: false }, strict: true },
  { type: "function", name: "create_payment_request_draft", description: "Create an approval-pending payment request draft. This never charges a customer or creates a checkout link.", parameters: { type: "object", properties: { customer_id: { type: "string", description: "The PayPilot customer UUID returned by find_customer." }, amount: { type: "number", description: "Amount in whole currency units, for example 1000 for ₹1,000." }, currency: { type: "string", description: "Three-letter currency code. Use INR unless the operator specifies another supported currency." }, purpose: { type: "string", description: "Short reason for requesting payment." } }, required: ["customer_id", "amount", "currency", "purpose"], additionalProperties: false }, strict: true },
  { type: "function", name: "create_weekly_payout_schedule_draft", description: "Create an approval-pending weekly payout schedule draft. This does not move money or activate a schedule.", parameters: { type: "object", properties: { customer_id: { type: "string", description: "The PayPilot customer UUID returned by find_customer." }, amount: { type: "number", description: "Amount in whole currency units, for example 100 for ₹100." }, currency: { type: "string", description: "Three-letter currency code. Use INR unless specified otherwise." }, purpose: { type: "string", description: "Why this payout is being made." } }, required: ["customer_id", "amount", "currency", "purpose"], additionalProperties: false }, strict: true },
];

function nextFriday() {
  const date = new Date();
  const daysUntilFriday = (5 - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilFriday);
  date.setUTCHours(9, 0, 0, 0);
  return date.toISOString();
}

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
  if (name === "find_customer") {
    const query = args.query.trim();
    const { data, error } = await supabase.from("customers").select("id, name, email, company").or(`email.ilike.%${query}%,name.ilike.%${query}%,company.ilike.%${query}%`).limit(5);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
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
  if (name === "create_payment_request_draft") {
    const amount = Number(args.amount);
    const currency = args.currency.toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) throw new Error("Payment request amount must be between 1 and 1,000,000.");
    if (currency !== "INR") throw new Error("Only INR payment-request drafts are enabled in this demo.");
    const { data, error } = await supabase.from("payment_requests").insert({ customer_id: args.customer_id, amount, currency, purpose: args.purpose, status: "approval_pending" }).select("id, amount, currency, status, purpose").single();
    if (error) throw new Error(error.message);
    return { ...data, nextStep: "Human approval is required before a Dodo checkout link can be created." };
  }
  if (name === "create_weekly_payout_schedule_draft") {
    const amount = Number(args.amount);
    const currency = args.currency.toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) throw new Error("Payout amount must be between 1 and 100,000.");
    if (currency !== "INR") throw new Error("Only INR payout schedules are enabled in this demo.");
    const nextRunAt = nextFriday();
    const { data, error } = await supabase.from("payout_schedules").insert({ customer_id: args.customer_id, amount, currency, frequency: "weekly", day_of_week: 5, purpose: args.purpose, status: "approval_pending", next_run_at: nextRunAt }).select("id, amount, currency, frequency, day_of_week, status, purpose, next_run_at").single();
    if (error) throw new Error(error.message);
    return { ...data, nextStep: "Human approval is required. The first payout run will be created on Friday at 09:00 UTC, but no provider payment is sent automatically." };
  }
  throw new Error(`Unsupported tool: ${name}`);
}

export async function runRecoveryAgent(question: string, supabase: SupabaseClient) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing from the server environment.");
  const client = new OpenAI({ apiKey });
  const activity: ToolActivity[] = [];
  let response = await client.responses.create({
    model: "gpt-5.6-luna", reasoning: { effort: "low" }, text: { verbosity: "low" }, tools: toolDefinitions,
    input: `You are PayPilot Recovery Agent. Answer the operator's question using tools for payment facts. You must never claim outreach, charging, refunds, retries, payouts, or recovery was performed. Recommend only approval-gated actions. Cite payment IDs and evidence you received from tools.\n\nFor payment requests: create a draft only when the operator explicitly asks to create, make, request, or collect a payment. First call find_customer, then call create_payment_request_draft using the returned customer ID. A draft is not a charge and does not create a checkout link.\n\nFor recurring payouts: only when the operator explicitly asks to pay out money every Friday, first call find_customer, then create_weekly_payout_schedule_draft. The draft is not active and does not move money. State the customer, amount, first run time, schedule ID, and that human approval is required.\n\nOperator question: ${question}`,
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
