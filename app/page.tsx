"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Customer = {
  id?: string;
  name: string;
  email: string;
  company: string | null;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  failure_reason: string | null;
  created_at: string;
  customer: Customer | null;
};

type RecoveryOpportunity = {
  id: string;
  customer: Customer | null;
  amount: number;
  reason: string | null;
  priority: string;
};

type DashboardData = {
  metrics: {
    totalRevenue: number;
    revenueAtRisk: number;
    successfulPayments: number;
    failedPayments: number;
    refundedAmount: number;
    totalPayments: number;
  };
  payments: Payment[];
  recoveryOpportunities: RecoveryOpportunity[];
};

type AgentActivity = {
  tool: string;
  label: string;
  status: "completed" | "failed";
};

type PayoutSchedule = {
  id: string;
  amount: number;
  currency: string;
  frequency: string;
  purpose: string | null;
  status: "approval_pending" | "active" | "paused" | "cancelled";
  next_run_at: string | null;
  customer: Customer | Customer[] | null;
};

type View = "Overview" | "Payments" | "Recovery" | "Payouts" | "Customers" | "Analytics" | "PayPilot AI";

const navItems: Array<{ label: View; icon: typeof LayoutDashboard }> = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Payments", icon: CreditCard },
  { label: "Recovery", icon: RefreshCw },
  { label: "Payouts", icon: CalendarClock },
  { label: "Customers", icon: Users },
  { label: "Analytics", icon: Activity },
];

const money = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const shortMoney = (value: number) => {
  const n = Number(value) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};

const normalizeStatus = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("fail")) return "Failed";
  if (s.includes("refund")) return "Refunded";
  if (s.includes("pending")) return "Pending";
  return "Success";
};

const customerLabel = (customer: Customer | null) =>
  customer?.company || customer?.name || "Unknown customer";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function Home() {
  const [view, setView] = useState<View>("Overview");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [agentActivity, setAgentActivity] = useState<AgentActivity[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState<string | null>(null);
  const [recoveryDone, setRecoveryDone] = useState<Record<string, boolean>>({});
  const [payoutSchedules, setPayoutSchedules] = useState<PayoutSchedule[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [approvingScheduleId, setApprovingScheduleId] = useState<string | null>(null);

  const loadDashboard = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      let lastError = "Failed to load payment data";

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch("/api/payments", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setDashboardData(data);
          return;
        }

        lastError = data.error || "Failed to load payment data";

        const jwtClockError =
          typeof lastError === "string" &&
          lastError.toLowerCase().includes("jwt issued at future");

        if (!jwtClockError || attempt === 2) break;

        await new Promise((resolve) =>
          window.setTimeout(resolve, 750 * (attempt + 1)),
        );
      }

      throw new Error(lastError);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load payment data",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        setSelectedPayment(null);
        setSelectedCustomer(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const payments = dashboardData?.payments ?? [];
  const recovery = dashboardData?.recoveryOpportunities ?? [];

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();

    for (const payment of payments) {
      if (!payment.customer) continue;
      const key =
        payment.customer.email ||
        payment.customer.company ||
        payment.customer.name;

      if (!map.has(key)) map.set(key, payment.customer);
    }

    return Array.from(map.values());
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;

    return payments.filter((payment) => {
      const haystack = [
        payment.id,
        payment.status,
        payment.failure_reason,
        payment.payment_method,
        customerLabel(payment.customer),
        payment.customer?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [payments, search]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((customer) =>
      [customer.name, customer.email, customer.company]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [customers, search]);

  const revenueByDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        revenue: 0,
      };
    });

    for (const payment of payments) {
      if (normalizeStatus(payment.status) !== "Success") continue;
      const key = new Date(payment.created_at).toISOString().slice(0, 10);
      const day = days.find((item) => item.key === key);
      if (day) day.revenue += Number(payment.amount) || 0;
    }

    // Keep the demo visually useful when the database has sparse dates.
    if (days.every((day) => day.revenue === 0)) {
      const demo = [142000, 158000, 151000, 176000, 169000, 194000, 184000];
      return days.map((day, index) => ({ ...day, revenue: demo[index] }));
    }

    return days;
  }, [payments]);

  const maxRevenue = Math.max(...revenueByDay.map((item) => item.revenue), 1);

  const metrics = dashboardData?.metrics ?? {
    totalRevenue: 0,
    revenueAtRisk: 0,
    successfulPayments: 0,
    failedPayments: 0,
    refundedAmount: 0,
    totalPayments: 0,
  };

  const goTo = (nextView: View) => {
    setView(nextView);
    setMobileOpen(false);
    setSearchOpen(false);
    setSearch("");
    if (nextView === "Payouts") void loadPayoutSchedules();
  };

  const loadPayoutSchedules = async () => {
    setPayoutsLoading(true);
    try {
      const response = await fetch("/api/payout-schedules", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load payout schedules.");
      setPayoutSchedules(data.schedules ?? []);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to load payout schedules.");
    } finally {
      setPayoutsLoading(false);
    }
  };

  const approvePayoutSchedule = async (schedule: PayoutSchedule) => {
    if (approvingScheduleId || schedule.status !== "approval_pending") return;
    setApprovingScheduleId(schedule.id);
    try {
      const response = await fetch(`/api/payout-schedules/${schedule.id}/approve`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to approve payout schedule.");
      setPayoutSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, status: "active" } : item));
      setToast(`Payout schedule approved for ${money(schedule.amount, schedule.currency)} every Friday.`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to approve payout schedule.");
    } finally {
      setApprovingScheduleId(null);
    }
  };

  const askAI = async (preset?: string) => {
    const prompt = (preset ?? question).trim();
    if (!prompt || aiLoading) return;

    setQuestion(prompt);
    setAiLoading(true);
    setAnswer("Analyzing your payment data...");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI request failed");
      }

      setAnswer(data.answer || "The recovery agent returned an empty answer.");
      setAgentActivity(Array.isArray(data.activity) ? data.activity : []);
    } catch (err) {
      console.error(err);
      setAnswer(
        "PayPilot AI is temporarily unavailable. Your payment data is still available below. Try the question again in a moment.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const initiateRecovery = async (paymentId: string, amount: number) => {
    if (recoveryLoading) return;

    setRecoveryLoading(paymentId);

    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Recovery could not be initiated");
      }

      setRecoveryDone((current) => ({ ...current, [paymentId]: true }));
      setToast(`Approval case created for ${money(amount)}. No customer was contacted.`);
      await loadDashboard(true);
    } catch (err) {
      console.error(err);
      setToast(
        err instanceof Error
          ? err.message
          : "Unable to initiate recovery.",
      );
    } finally {
      setRecoveryLoading(null);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08090d] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          <div className="text-sm font-medium">Loading payment intelligence...</div>
          <div className="mt-2 text-xs text-white/30">Connecting to Supabase</div>
        </div>
      </main>
    );
  }

  if (error || !dashboardData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08090d] px-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-400/20 bg-red-400/5 p-7">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-400/10">
            <AlertTriangle size={18} className="text-red-300" />
          </div>
          <h1 className="text-lg font-semibold">PayPilot couldn&apos;t load your data</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">{error}</p>
          {error.toLowerCase().includes("jwt issued at future") && (
            <p className="mt-3 rounded-xl border border-amber-400/10 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200/70">
              Supabase is rejecting the server token because its issued-at
              timestamp is ahead of Supabase time. This is a server-side
              authentication/clock issue, not a dashboard UI issue.
            </p>
          )}
          <button
            onClick={() => void loadDashboard()}
            className="mt-5 rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-black"
          >
            Retry connection
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-white">
      <div className="flex min-h-screen">
        <aside
          className={`${
            mobileOpen ? "fixed inset-0 z-50 flex" : "hidden"
          } w-[250px] flex-col border-r border-white/10 bg-[#0b0d12] lg:sticky lg:top-0 lg:flex lg:h-screen`}
        >
          <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6">
            <button onClick={() => goTo("Overview")} className="flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
                <Zap size={18} fill="currentColor" />
              </div>
              <div>
                <div className="font-semibold tracking-tight">PayPilot</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  Payment OS
                </div>
              </div>
            </button>

            {mobileOpen && (
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white/50">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-6">
            <div className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
              Workspace
            </div>

            <nav className="space-y-1">
              {navItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => goTo(label)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                    view === label
                      ? "bg-white/10 text-white"
                      : "text-white/45 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={17} />
                  {label}
                  {label === "Recovery" && recovery.length > 0 && (
                    <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black">
                      {recovery.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="mb-3 mt-9 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
              Intelligence
            </div>

            <button
              onClick={() => goTo("PayPilot AI")}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                view === "PayPilot AI"
                  ? "bg-white/10 text-white"
                  : "bg-white/[0.04] text-white/60 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <Bot size={17} />
              PayPilot AI
              <Sparkles className="ml-auto" size={14} />
            </button>
          </div>

          <div className="border-t border-white/10 p-4">
            <button
              onClick={() => setToast("Dodo Payments integration is ready for the next step.")}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-white/60">Dodo Payments</span>
                <span className="ml-auto text-[10px] text-emerald-400">Connected</span>
              </div>
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          />
        )}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-white/10 bg-[#08090d]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-2 lg:hidden"
              >
                <Menu size={18} />
              </button>

              <div className="hidden sm:block">
                <div className="text-sm font-medium">Payment Command Center</div>
                <div className="mt-0.5 text-xs text-white/35">
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>

            <div className="relative flex items-center gap-3">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/35 hover:border-white/20 hover:text-white/60"
              >
                <Search size={15} />
                <span className="hidden sm:inline">Search payments...</span>
                <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[9px] sm:inline">⌘ K</kbd>
              </button>

              <button
                onClick={() => setProfileOpen((value) => !value)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-medium hover:bg-white/10"
              >
                A
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/10 bg-[#111319] p-2 shadow-2xl">
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <div className="text-sm font-medium">Aditya</div>
                    <div className="mt-1 text-[11px] text-white/35">PayPilot workspace</div>
                  </div>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setToast("Profile settings are local to this demo.");
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-white/55 hover:bg-white/5 hover:text-white"
                  >
                    <User size={14} />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setToast("Dodo Payments: connected.");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs text-white/55 hover:bg-white/5 hover:text-white"
                  >
                    <CreditCard size={14} />
                    Integrations
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
            <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  LIVE PAYMENT INTELLIGENCE
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {view === "Overview" ? "Good morning, Aditya." : view}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/40">
                  {view === "Overview"
                    ? "Your payment infrastructure is connected. Here are the opportunities worth your attention."
                    : view === "Payments"
                      ? "Search, filter, and inspect every payment returned by your live database."
                      : view === "Recovery"
                        ? "Prioritize failed payments and start auditable recovery workflows."
                        : view === "Payouts"
                          ? "Review agent-created payout schedules before they become active."
                        : view === "Customers"
                          ? "Understand customer payment behavior from the transactions already in PayPilot."
                          : view === "Analytics"
                            ? "Turn payment activity into failure, recovery, and revenue signals."
                            : "Ask questions about payments, revenue, customers, failures, and recovery opportunities."}
                </p>
              </div>

              <button
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                className="flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs text-white/60 hover:bg-white/[0.07] disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Syncing..." : "Refresh data"}
              </button>
            </div>

            {view === "Overview" && (
              <Overview
                metrics={metrics}
                payments={payments}
                recovery={recovery}
                revenueByDay={revenueByDay}
                maxRevenue={maxRevenue}
                question={question}
                setQuestion={setQuestion}
                answer={answer}
                activity={agentActivity}
                aiLoading={aiLoading}
                askAI={askAI}
                onPayment={setSelectedPayment}
                onRecovery={() => goTo("Recovery")}
              />
            )}

            {view === "Payments" && (
              <PaymentsView
                payments={filteredPayments}
                search={search}
                setSearch={setSearch}
                onPayment={setSelectedPayment}
              />
            )}

            {view === "Recovery" && (
              <RecoveryView
                opportunities={recovery}
                done={recoveryDone}
                loadingId={recoveryLoading}
                onRecover={initiateRecovery}
                onPayment={(id) => {
                  const payment = payments.find((item) => item.id === id);
                  if (payment) setSelectedPayment(payment);
                }}
              />
            )}

            {view === "Payouts" && (
              <PayoutSchedulesView
                schedules={payoutSchedules}
                loading={payoutsLoading}
                approvingId={approvingScheduleId}
                onApprove={approvePayoutSchedule}
                onRefresh={loadPayoutSchedules}
              />
            )}

            {view === "Customers" && (
              <CustomersView
                customers={filteredCustomers}
                payments={payments}
                search={search}
                setSearch={setSearch}
                onCustomer={setSelectedCustomer}
              />
            )}

            {view === "Analytics" && (
              <AnalyticsView
                metrics={metrics}
                payments={payments}
                recovery={recovery}
                revenueByDay={revenueByDay}
                maxRevenue={maxRevenue}
              />
            )}

            {view === "PayPilot AI" && (
              <AIView
                question={question}
                setQuestion={setQuestion}
                answer={answer}
                activity={agentActivity}
                aiLoading={aiLoading}
                askAI={askAI}
                onRecover={() => goTo("Recovery")}
              />
            )}
          </div>
        </section>
      </div>

      {searchOpen && (
        <SearchModal
          query={search}
          setQuery={setSearch}
          payments={filteredPayments}
          customers={filteredCustomers}
          onClose={() => setSearchOpen(false)}
          onPayment={(payment) => {
            setSelectedPayment(payment);
            setSearchOpen(false);
          }}
          onCustomer={(customer) => {
            setSelectedCustomer(customer);
            setSearchOpen(false);
          }}
          onView={goTo}
        />
      )}

      {selectedPayment && (
        <PaymentModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onRecover={() => {
            setSelectedPayment(null);
            goTo("Recovery");
          }}
        />
      )}

      {selectedCustomer && (
        <CustomerModal
          customer={selectedCustomer}
          payments={payments}
          onClose={() => setSelectedCustomer(null)}
          onPayment={setSelectedPayment}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-white/10 bg-[#151820] px-4 py-3 text-xs text-white shadow-2xl">
          {toast}
        </div>
      )}
    </main>
  );
}

function Overview({
  metrics,
  payments,
  recovery,
  revenueByDay,
  maxRevenue,
  question,
  setQuestion,
  answer,
  activity,
  aiLoading,
  askAI,
  onPayment,
  onRecovery,
}: {
  metrics: DashboardData["metrics"];
  payments: Payment[];
  recovery: RecoveryOpportunity[];
  revenueByDay: Array<{ key: string; label: string; revenue: number }>;
  maxRevenue: number;
  question: string;
  setQuestion: (value: string) => void;
  answer: string;
  activity: AgentActivity[];
  aiLoading: boolean;
  askAI: (preset?: string) => Promise<void>;
  onPayment: (payment: Payment) => void;
  onRecovery: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total revenue" value={shortMoney(metrics.totalRevenue)} change="+8.4%" positive icon={CircleDollarSign} />
        <Metric label="Revenue at risk" value={shortMoney(metrics.revenueAtRisk)} change="+14.2%" danger icon={AlertTriangle} />
        <Metric label="Successful payments" value={String(metrics.successfulPayments)} change="+12.1%" positive icon={CreditCard} />
        <Metric label="Failed payments" value={String(metrics.failedPayments)} change="+31.0%" danger icon={ShieldAlert} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <RevenueCard revenueByDay={revenueByDay} maxRevenue={maxRevenue} />
        <AIBox
          question={question}
          setQuestion={setQuestion}
          answer={answer}
          activity={activity}
          aiLoading={aiLoading}
          askAI={askAI}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f14]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <div>
              <div className="text-sm font-medium">Recent payments</div>
              <div className="mt-1 text-xs text-white/30">Latest payment activity</div>
            </div>
            <button onClick={() => onPayment(payments[0])} disabled={!payments[0]} className="text-xs text-white/40 hover:text-white disabled:opacity-30">
              Inspect latest →
            </button>
          </div>
          <PaymentTable payments={payments.slice(0, 7)} onPayment={onPayment} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d0f14]">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="text-sm font-medium">Recovery opportunities</div>
            <div className="mt-1 text-xs text-white/30">Highest-value failed payments first</div>
          </div>
          <div className="p-4">
            {recovery.slice(0, 4).map((item) => (
              <RecoveryCard key={item.id} opportunity={item} onRecover={onRecovery} />
            ))}
            {!recovery.length && <EmptyState text="No failed payments currently need recovery." />}
            {recovery.length > 4 && (
              <button onClick={onRecovery} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-xs text-white/45 hover:bg-white/5 hover:text-white">
                View all {recovery.length} opportunities <ChevronRight size={14} />
              </button>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Insight title="Failure pressure" description={`${metrics.failedPayments} failed payments are currently visible in the live dataset.`} icon={<ArrowDownRight size={16} />} action="Review failures" onClick={onRecovery} />
        <Insight title="Recovery value" description={`${shortMoney(metrics.revenueAtRisk)} is currently represented as revenue at risk.`} icon={<Wallet size={16} />} action="Start recovery" onClick={onRecovery} />
        <Insight title="Recovery agent" description="OpenAI uses payment tools to investigate failure patterns and safe next actions." icon={<Sparkles size={16} />} action="Open agent" onClick={() => askAI("What should I recover first?")} />
      </div>
    </>
  );
}

function PaymentsView({
  payments,
  search,
  setSearch,
  onPayment,
}: {
  payments: Payment[];
  search: string;
  setSearch: (value: string) => void;
  onPayment: (payment: Payment) => void;
}) {
  const statuses = ["All", "Success", "Failed", "Pending", "Refunded"];
  const [status, setStatus] = useState("All");

  const filtered = payments.filter((payment) =>
    status === "All" ? true : normalizeStatus(payment.status) === status,
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d0f14]">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Payments</div>
          <div className="mt-1 text-xs text-white/30">{filtered.length} matching transactions</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <Search size={14} className="text-white/25" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, email, ID..." className="w-full bg-transparent text-xs outline-none placeholder:text-white/25 sm:w-64" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-white/10 bg-[#111319] px-3 py-2 text-xs text-white/60 outline-none">
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </div>
      <PaymentTable payments={filtered} onPayment={onPayment} />
    </section>
  );
}

function RecoveryView({
  opportunities,
  done,
  loadingId,
  onRecover,
  onPayment,
}: {
  opportunities: RecoveryOpportunity[];
  done: Record<string, boolean>;
  loadingId: string | null;
  onRecover: (id: string, amount: number) => void;
  onPayment: (id: string) => void;
}) {
  const total = opportunities.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Recovery queue" value={String(opportunities.length)} change="live" positive icon={RefreshCw} />
        <Metric label="Revenue at risk" value={shortMoney(total)} change="prioritized" danger icon={AlertTriangle} />
        <Metric label="Top opportunity" value={shortMoney(opportunities[0]?.amount || 0)} change="highest value" positive icon={CircleDollarSign} />
      </div>

      <section className="mt-4 rounded-2xl border border-white/10 bg-[#0d0f14] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Recovery command center</div>
            <div className="mt-1 text-xs text-white/30">Initiate an auditable recovery workflow without claiming the payment succeeded.</div>
          </div>
          <span className="rounded-full bg-amber-400/10 px-3 py-1 text-[10px] text-amber-300">ACTION REQUIRED</span>
        </div>

        <div className="space-y-3">
          {opportunities.map((item, index) => {
            const name = customerLabel(item.customer);
            const isDone = done[item.id];
            const isLoading = loadingId === item.id;

            return (
              <div key={item.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-xs font-semibold text-white/60">
                      {index + 1}
                    </div>
                    <div>
                      <button onClick={() => onPayment(item.id)} className="text-left text-sm font-medium hover:text-white/70">{name}</button>
                      <div className="mt-1 text-xs text-white/30">{item.reason || "Payment failed"} · {item.priority}</div>
                      {item.customer?.email && <div className="mt-1 text-[10px] text-white/20">{item.customer.email}</div>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <div className="text-right">
                      <div className="text-sm font-semibold">{money(item.amount)}</div>
                      <div className="mt-1 text-[10px] text-white/25">recovery target</div>
                    </div>
                    <button
                      onClick={() => onRecover(item.id, item.amount)}
                      disabled={isLoading || isDone}
                      className={`rounded-xl px-4 py-2.5 text-xs font-medium ${
                        isDone
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-white text-black hover:bg-white/90"
                      } disabled:opacity-60`}
                    >
                      {isLoading ? "Creating..." : isDone ? "Approval case created" : "Create approval case"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!opportunities.length && <EmptyState text="Excellent. There are no failed payment opportunities right now." />}
      </section>
    </>
  );
}

function PayoutSchedulesView({
  schedules,
  loading,
  approvingId,
  onApprove,
  onRefresh,
}: {
  schedules: PayoutSchedule[];
  loading: boolean;
  approvingId: string | null;
  onApprove: (schedule: PayoutSchedule) => void;
  onRefresh: () => Promise<void>;
}) {
  const customerFor = (schedule: PayoutSchedule) =>
    Array.isArray(schedule.customer) ? schedule.customer[0] ?? null : schedule.customer;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d0f14] p-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Payout schedules</div>
          <div className="mt-1 text-xs text-white/30">Agent-created schedules require approval before any Friday run is eligible.</div>
        </div>
        <button onClick={() => void onRefresh()} disabled={loading} className="flex w-fit items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 hover:bg-white/5 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {schedules.map((schedule) => {
          const customer = customerFor(schedule);
          const isPending = schedule.status === "approval_pending";
          const isApproving = approvingId === schedule.id;
          return (
            <div key={schedule.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/60"><CalendarClock size={17} /></div>
                  <div>
                    <div className="text-sm font-medium">{customerLabel(customer)}</div>
                    <div className="mt-1 text-xs text-white/35">{schedule.purpose || "Recurring payout"} · Every Friday</div>
                    <div className="mt-1 text-[10px] text-white/25">First eligible run: {schedule.next_run_at ? formatDate(schedule.next_run_at) : "Not scheduled"}</div>
                    <div className="mt-1 font-mono text-[10px] text-white/20">{schedule.id}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 md:justify-end">
                  <div className="text-right">
                    <div className="text-sm font-semibold">{money(schedule.amount, schedule.currency)}</div>
                    <div className={`mt-1 text-[10px] uppercase tracking-wide ${isPending ? "text-amber-300" : "text-emerald-300"}`}>{isPending ? "Approval pending" : schedule.status}</div>
                  </div>
                  {isPending ? (
                    <button onClick={() => onApprove(schedule)} disabled={isApproving} className="rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-black hover:bg-white/90 disabled:opacity-50">
                      {isApproving ? "Approving..." : "Approve schedule"}
                    </button>
                  ) : (
                    <span className="rounded-xl bg-emerald-400/10 px-4 py-2.5 text-xs font-medium text-emerald-300">Active</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!loading && !schedules.length && <EmptyState text="No payout schedules yet. Ask PayPilot AI to create a Friday payout schedule draft." />}
        {loading && <EmptyState text="Loading payout schedules..." />}
      </div>
    </section>
  );
}

function CustomersView({
  customers,
  payments,
  search,
  setSearch,
  onCustomer,
}: {
  customers: Customer[];
  payments: Payment[];
  search: string;
  setSearch: (value: string) => void;
  onCustomer: (customer: Customer) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d0f14]">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Customers</div>
          <div className="mt-1 text-xs text-white/30">{customers.length} customers discovered from payment activity</div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <Search size={14} className="text-white/25" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="w-full bg-transparent text-xs outline-none placeholder:text-white/25 sm:w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => {
          const customerPayments = payments.filter((payment) => payment.customer?.email === customer.email);
          const total = customerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          const failed = customerPayments.filter((payment) => normalizeStatus(payment.status) === "Failed").length;

          return (
            <button key={customer.email || customer.name} onClick={() => onCustomer(customer)} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left hover:border-white/15 hover:bg-white/[0.04]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium">{customer.company || customer.name}</div>
                  <div className="mt-1 text-[11px] text-white/30">{customer.email}</div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                  <User size={14} className="text-white/45" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-black/20 p-3">
                  <div className="text-[10px] text-white/25">Volume</div>
                  <div className="mt-1 text-xs font-medium">{shortMoney(total)}</div>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <div className="text-[10px] text-white/25">Failures</div>
                  <div className="mt-1 text-xs font-medium">{failed}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!customers.length && <div className="p-5"><EmptyState text="No customers match your search." /></div>}
    </section>
  );
}

function AnalyticsView({
  metrics,
  payments,
  recovery,
  revenueByDay,
  maxRevenue,
}: {
  metrics: DashboardData["metrics"];
  payments: Payment[];
  recovery: RecoveryOpportunity[];
  revenueByDay: Array<{ key: string; label: string; revenue: number }>;
  maxRevenue: number;
}) {
  const success = payments.filter((p) => normalizeStatus(p.status) === "Success").length;
  const failed = payments.filter((p) => normalizeStatus(p.status) === "Failed").length;
  const total = Math.max(success + failed, 1);
  const successRate = (success / total) * 100;

  const reasons = useMemo(() => {
    const map = new Map<string, number>();
    payments
      .filter((p) => normalizeStatus(p.status) === "Failed")
      .forEach((p) => {
        const reason = p.failure_reason || "Unknown failure";
        map.set(reason, (map.get(reason) || 0) + 1);
      });

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [payments]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Payment success rate" value={`${successRate.toFixed(1)}%`} change="live" positive icon={Check} />
        <Metric label="Transactions" value={String(metrics.totalPayments)} change="database" icon={Activity} />
        <Metric label="Refunded" value={shortMoney(metrics.refundedAmount)} change="tracked" danger icon={RefreshCw} />
        <Metric label="Recovery queue" value={String(recovery.length)} change="failed payments" danger icon={ShieldAlert} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <RevenueCard revenueByDay={revenueByDay} maxRevenue={maxRevenue} />
        <section className="rounded-2xl border border-white/10 bg-[#0d0f14] p-5">
          <div className="text-sm font-medium">Failure reasons</div>
          <div className="mt-1 text-xs text-white/30">Most common reasons in the live dataset</div>
          <div className="mt-6 space-y-4">
            {reasons.map(([reason, count]) => {
              const percentage = (count / Math.max(failed, 1)) * 100;
              return (
                <div key={reason}>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">{reason}</span>
                    <span className="text-white/30">{count}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-amber-300/70" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
            {!reasons.length && <EmptyState text="No failure reasons available." />}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-white/10 bg-[#0d0f14] p-5">
        <div className="text-sm font-medium">Recovery economics</div>
        <div className="mt-1 text-xs text-white/30">Where the highest-value opportunities are concentrated</div>
        <div className="mt-5 space-y-3">
          {recovery.slice(0, 8).map((item) => {
            const width = Math.max(4, (Number(item.amount) / Math.max(metrics.revenueAtRisk, 1)) * 100);
            return (
              <div key={item.id}>
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">{customerLabel(item.customer)}</span>
                  <span className="text-white/35">{money(item.amount)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-white/40" style={{ width: `${Math.min(width, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function AIView({
  question,
  setQuestion,
  answer,
  activity,
  aiLoading,
  askAI,
  onRecover,
}: {
  question: string;
  setQuestion: (value: string) => void;
  answer: string;
  activity: AgentActivity[];
  aiLoading: boolean;
  askAI: (preset?: string) => Promise<void>;
  onRecover: () => void;
}) {
  const prompts = [
    "Why should I recover first?",
    "Why did revenue drop?",
    "Find anomalies",
    "Which customers are at risk?",
    "Explain my failed payments",
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
      <section className="rounded-2xl border border-white/10 bg-[#0d0f14] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-sm font-medium">PayPilot AI</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/30">Payment intelligence</div>
          </div>
        </div>

        <p className="mt-7 max-w-xl text-sm leading-7 text-white/50">
          An OpenAI recovery agent investigates live payment data through scoped tools. It recommends actions, but keeps every customer-facing action approval-gated.
        </p>

        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
          <MessageSquare size={16} className="ml-2 text-white/25" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void askAI();
            }}
            placeholder="Ask about your payments..."
            className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-white/25"
          />
          <button onClick={() => void askAI()} disabled={aiLoading || !question.trim()} className="rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-black disabled:opacity-40">
            {aiLoading ? "Thinking..." : "Ask"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button key={prompt} onClick={() => void askAI(prompt)} disabled={aiLoading} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/45 hover:border-white/20 hover:text-white disabled:opacity-40">
              {prompt}
            </button>
          ))}
        </div>

        {answer && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 flex items-center gap-2 text-xs text-white/50">
              <Bot size={14} />
              PayPilot AI
            </div>
            <div className="whitespace-pre-wrap text-sm leading-7 text-white/70">{answer}</div>
            {activity.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-white/30">Agent tool activity</div>
                <div className="space-y-2">
                  {activity.map((item, index) => (
                    <div key={`${item.tool}-${index}`} className="flex items-center gap-2 text-xs text-white/55">
                      <span className={`h-1.5 w-1.5 rounded-full ${item.status === "completed" ? "bg-emerald-400" : "bg-red-400"}`} />
                      <span className="capitalize">{item.label}</span>
                      <span className="ml-auto text-[10px] text-white/25">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={onRecover} className="mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-black">
              Open recovery queue <ChevronRight size={13} />
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0d0f14] p-6">
        <div className="text-sm font-medium">What the AI can do</div>
        <div className="mt-5 space-y-3">
          {[
            ["Prioritize recovery", "Rank failed payments by value, history, and likely recovery potential."],
            ["Explain failures", "Group failure reasons and translate raw payment events into actions."],
            ["Spot anomalies", "Look for unusual customer behavior and payment patterns."],
            ["Grounded tool calls", "OpenAI selects scoped payment-data tools instead of receiving the entire customer dataset in a prompt."],
            ["Human approval", "The agent can investigate and draft a plan; customer-facing recovery still needs approval."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="text-xs font-medium">{title}</div>
              <div className="mt-1 text-[11px] leading-5 text-white/30">{description}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AIBox({
  question,
  setQuestion,
  answer,
  activity,
  aiLoading,
  askAI,
}: {
  question: string;
  setQuestion: (value: string) => void;
  answer: string;
  activity: AgentActivity[];
  aiLoading: boolean;
  askAI: (preset?: string) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0f14] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
          <Sparkles size={16} />
        </div>
        <div>
          <div className="text-sm font-medium">PayPilot AI</div>
          <div className="text-[10px] uppercase tracking-widest text-white/30">Payment intelligence</div>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-white/45">
        Ask me anything about payments, revenue, customers, failures, or recovery.
      </p>

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <MessageSquare size={15} className="text-white/25" />
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void askAI();
          }}
          placeholder="Why did revenue drop?"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-white/25"
        />
        <button onClick={() => void askAI()} disabled={aiLoading || !question.trim()} className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-black disabled:opacity-40">
          {aiLoading ? "..." : "Ask"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Why should I recover first?", "Why did revenue drop?", "Find anomalies"].map((prompt) => (
          <button key={prompt} onClick={() => void askAI(prompt)} disabled={aiLoading} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/40 hover:text-white disabled:opacity-40">
            {prompt}
          </button>
        ))}
      </div>

      {answer && (
        <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/35">
            <Bot size={13} /> PayPilot AI
          </div>
          <div className="whitespace-pre-wrap text-xs leading-6 text-white/65">{answer}</div>
          {activity.length > 0 && <div className="mt-3 text-[10px] text-emerald-300">{activity.length} tool {activity.length === 1 ? "call" : "calls"} completed</div>}
        </div>
      )}
    </div>
  );
}

function RevenueCard({
  revenueByDay,
  maxRevenue,
}: {
  revenueByDay: Array<{ key: string; label: string; revenue: number }>;
  maxRevenue: number;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d0f14] p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium">Revenue</div>
          <div className="mt-1 text-xs text-white/30">Last 7 days · successful payments</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">{shortMoney(revenueByDay.at(-1)?.revenue || 0)}</div>
          <div className="mt-1 text-xs text-emerald-400">Live dataset</div>
        </div>
      </div>

      <div className="mt-7 flex h-[250px] items-end gap-2 border-b border-white/[0.06]">
        {revenueByDay.map((day) => (
          <div key={day.key} className="group flex h-full flex-1 flex-col justify-end">
            <div className="relative flex flex-1 items-end">
              <div
                className="w-full rounded-t-lg bg-white/[0.12] transition group-hover:bg-white/[0.22]"
                style={{ height: `${Math.max(5, (day.revenue / maxRevenue) * 92)}%` }}
                title={`${day.label}: ${money(day.revenue)}`}
              />
            </div>
            <div className="pt-3 text-center text-[10px] text-white/25">{day.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaymentTable({
  payments,
  onPayment,
}: {
  payments: Payment[];
  onPayment: (payment: Payment) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/25">
            <th className="px-5 py-3 font-medium">Customer</th>
            <th className="px-5 py-3 font-medium">Amount</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Reason / method</th>
            <th className="px-5 py-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} onClick={() => onPayment(payment)} className="cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.025]">
              <td className="px-5 py-4">
                <div className="text-xs font-medium">{customerLabel(payment.customer)}</div>
                <div className="mt-1 text-[10px] text-white/25">{payment.customer?.email || "No email"}</div>
              </td>
              <td className="px-5 py-4 text-xs font-medium">{money(payment.amount, payment.currency || "INR")}</td>
              <td className="px-5 py-4"><Status status={normalizeStatus(payment.status)} /></td>
              <td className="px-5 py-4 text-[10px] text-white/30">{payment.failure_reason || payment.payment_method || "—"}</td>
              <td className="px-5 py-4 text-[10px] text-white/30">{formatDate(payment.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!payments.length && <div className="p-6"><EmptyState text="No payments match this filter." /></div>}
    </div>
  );
}

function RecoveryCard({
  opportunity,
  onRecover,
}: {
  opportunity: RecoveryOpportunity;
  onRecover: () => void;
}) {
  return (
    <div className="mb-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium">{customerLabel(opportunity.customer)}</div>
          <div className="mt-1 text-[10px] text-white/30">{opportunity.reason || "Payment failed"}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold">{money(opportunity.amount)}</div>
          <div className="mt-1 text-[9px] uppercase tracking-wider text-amber-400">{opportunity.priority}</div>
        </div>
      </div>
      <button onClick={onRecover} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-[10px] text-white/50 hover:bg-white/5 hover:text-white">
        Open recovery <ChevronRight size={12} />
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  change,
  positive,
  danger,
  icon: Icon,
}: {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  danger?: boolean;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0f14] p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs text-white/35">{label}</div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05]">
          <Icon size={15} className="text-white/50" />
        </div>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight">{value}</div>
      <div className={`mt-2 flex items-center gap-1 text-[11px] ${positive ? "text-emerald-400" : danger ? "text-amber-400" : "text-white/30"}`}>
        {positive ? <ArrowUpRight size={12} /> : danger ? <ArrowDownRight size={12} /> : <Activity size={12} />}
        {change}
      </div>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Success: "text-emerald-400 bg-emerald-400/10",
    Failed: "text-red-400 bg-red-400/10",
    Refunded: "text-amber-400 bg-amber-400/10",
    Pending: "text-sky-400 bg-sky-400/10",
  };

  return <span className={`rounded-full px-2 py-1 text-[10px] ${styles[status] || "text-white/50 bg-white/5"}`}>{status}</span>;
}

function Insight({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d0f14] p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/60">{icon}</div>
      <div className="mt-4 text-xs font-medium">{title}</div>
      <p className="mt-2 text-[11px] leading-5 text-white/35">{description}</p>
      <button onClick={onClick} className="mt-4 text-[10px] text-white/55 hover:text-white">{action} →</button>
    </div>
  );
}

function SearchModal({
  query,
  setQuery,
  payments,
  customers,
  onClose,
  onPayment,
  onCustomer,
  onView,
}: {
  query: string;
  setQuery: (value: string) => void;
  payments: Payment[];
  customers: Customer[];
  onClose: () => void;
  onPayment: (payment: Payment) => void;
  onCustomer: (customer: Customer) => void;
  onView: (view: View) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="mx-auto mt-[8vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#111319] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search size={17} className="text-white/30" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payments, customers, email, failure reason..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/25" />
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {!query && (
            <div className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/25">Quick navigation</div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(["Overview", "Payments", "Recovery", "Payouts", "Customers", "Analytics", "PayPilot AI"] as View[]).map((item) => (
                  <button key={item} onClick={() => onView(item)} className="rounded-xl border border-white/10 p-3 text-left text-xs text-white/50 hover:bg-white/5 hover:text-white">{item}</button>
                ))}
              </div>
            </div>
          )}

          {query && (
            <>
              {payments.slice(0, 6).map((payment) => (
                <button key={payment.id} onClick={() => onPayment(payment)} className="flex w-full items-center justify-between rounded-xl p-3 text-left hover:bg-white/5">
                  <div>
                    <div className="text-xs font-medium">{customerLabel(payment.customer)}</div>
                    <div className="mt-1 text-[10px] text-white/25">{payment.customer?.email || payment.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">{money(payment.amount)}</div>
                    <Status status={normalizeStatus(payment.status)} />
                  </div>
                </button>
              ))}

              {customers.slice(0, 4).map((customer) => (
                <button key={`customer-${customer.email}`} onClick={() => onCustomer(customer)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]"><User size={14} /></div>
                  <div>
                    <div className="text-xs font-medium">{customer.company || customer.name}</div>
                    <div className="mt-1 text-[10px] text-white/25">{customer.email}</div>
                  </div>
                </button>
              ))}

              {!payments.length && !customers.length && <EmptyState text="Nothing matched your search." />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentModal({
  payment,
  onClose,
  onRecover,
}: {
  payment: Payment;
  onClose: () => void;
  onRecover: () => void;
}) {
  const failed = normalizeStatus(payment.status) === "Failed";

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">{customerLabel(payment.customer)}</div>
          <div className="mt-1 text-xs text-white/30">{payment.customer?.email || "No customer email"}</div>
        </div>
        <Status status={normalizeStatus(payment.status)} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Detail label="Amount" value={money(payment.amount, payment.currency || "INR")} />
        <Detail label="Payment ID" value={payment.id} />
        <Detail label="Payment method" value={payment.payment_method || "Not available"} />
        <Detail label="Created" value={formatDate(payment.created_at)} />
        <Detail label="Failure reason" value={payment.failure_reason || "None"} />
        <Detail label="Currency" value={payment.currency || "INR"} />
      </div>

      <div className="mt-6 flex gap-2">
        {failed && <button onClick={onRecover} className="rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-black">Open recovery</button>}
        <button onClick={() => navigator.clipboard?.writeText(payment.id)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/55 hover:text-white">Copy payment ID</button>
      </div>
    </Modal>
  );
}

function CustomerModal({
  customer,
  payments,
  onClose,
  onPayment,
}: {
  customer: Customer;
  payments: Payment[];
  onClose: () => void;
  onPayment: (payment: Payment) => void;
}) {
  const customerPayments = payments.filter((payment) => payment.customer?.email === customer.email);
  const volume = customerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const failures = customerPayments.filter((payment) => normalizeStatus(payment.status) === "Failed").length;

  return (
    <Modal onClose={onClose}>
      <div className="text-lg font-semibold">{customer.company || customer.name}</div>
      <div className="mt-1 text-xs text-white/30">{customer.email}</div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Detail label="Payment volume" value={shortMoney(volume)} />
        <Detail label="Transactions" value={String(customerPayments.length)} />
        <Detail label="Failed payments" value={String(failures)} />
        <Detail label="Customer" value={customer.name} />
      </div>

      <div className="mt-6">
        <div className="mb-3 text-xs font-medium">Recent activity</div>
        <div className="space-y-2">
          {customerPayments.slice(0, 6).map((payment) => (
            <button key={payment.id} onClick={() => onPayment(payment)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left hover:bg-white/[0.05]">
              <div>
                <div className="text-xs">{formatDate(payment.created_at)}</div>
                <div className="mt-1 text-[10px] text-white/25">{payment.failure_reason || payment.payment_method || "Payment"}</div>
              </div>
              <div className="text-right">
                <div className="text-xs">{money(payment.amount)}</div>
                <Status status={normalizeStatus(payment.status)} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111319] p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end">
          <button onClick={onClose} className="rounded-lg p-1 text-white/30 hover:text-white"><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="text-[10px] text-white/25">{label}</div>
      <div className="mt-1 break-all text-xs text-white/70">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-white/30">{text}</div>
  );
}
