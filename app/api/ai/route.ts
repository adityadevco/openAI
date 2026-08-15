import { NextResponse } from "next/server";
import { runRecoveryAgent } from "@/lib/recovery-agent";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ success: false, error: "Please provide a question." }, { status: 400 });
    }

    if (question.length > 600) {
      return NextResponse.json({ success: false, error: "Keep questions under 600 characters." }, { status: 400 });
    }

    const result = await runRecoveryAgent(question, supabase);

    // Observability is best-effort: a missing migration must not hide an agent answer.
    const { error: runError } = await supabase.from("agent_runs").insert({
      workflow: "recovery_agent",
      status: "completed",
      summary: result.answer.slice(0, 800),
      tool_activity: result.activity,
    });
    if (runError) console.warn("Could not persist agent run:", runError.message);

    return NextResponse.json({
      success: true,
      question,
      answer: result.answer,
      activity: result.activity,
      responseId: result.responseId,
    });
  } catch (error) {
    console.error("PayPilot recovery agent error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "PayPilot agent failed." },
      { status: 500 },
    );
  }
}
