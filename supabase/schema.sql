-- ============================================
-- PAYPILOT DATABASE
-- ============================================

create extension if not exists pgcrypto;

-- ============================================
-- CUSTOMERS
-- ============================================

create table if not exists customers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text unique not null,
    company text,
    segment text default 'SMB',
    country text default 'India',
    created_at timestamptz default now()
);

-- ============================================
-- PAYMENTS
-- ============================================

create table if not exists payments (
    id uuid primary key default gen_random_uuid(),

    customer_id uuid references customers(id)
        on delete cascade,

    amount numeric(12,2) not null,

    currency text not null default 'INR',

    status text not null
        check (status in ('success', 'failed', 'refunded', 'pending')),

    payment_method text,

    failure_reason text,

    provider_payment_id text,

    created_at timestamptz default now()
);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================

create table if not exists subscriptions (
    id uuid primary key default gen_random_uuid(),

    customer_id uuid references customers(id)
        on delete cascade,

    plan_name text not null,

    amount numeric(12,2) not null,

    billing_cycle text default 'monthly',

    status text not null
        check (status in ('active', 'cancelled', 'past_due', 'expired')),

    next_billing_date date,

    created_at timestamptz default now()
);

-- ============================================
-- PAYMENT EVENTS
-- ============================================

create table if not exists payment_events (
    id uuid primary key default gen_random_uuid(),

    payment_id uuid references payments(id)
        on delete cascade,

    event_type text not null,

    event_data jsonb,

    created_at timestamptz default now()
);

-- ============================================
-- APPROVAL-GATED RECOVERY CASES
-- ============================================

create table if not exists recovery_cases (
    id uuid primary key default gen_random_uuid(),
    payment_id uuid not null references payments(id) on delete cascade,
    status text not null default 'approval_pending'
        check (status in ('approval_pending', 'approved', 'outreach_sent', 'retry_scheduled', 'recovered', 'expired')),
    strategy text not null,
    rationale text not null,
    recovery_score integer not null check (recovery_score between 0 and 100),
    draft_message text,
    created_at timestamptz default now(),
    approved_at timestamptz,
    acted_at timestamptz
);

create unique index if not exists recovery_cases_active_payment_idx
on recovery_cases(payment_id)
where status in ('approval_pending', 'approved', 'outreach_sent', 'retry_scheduled');

create table if not exists agent_runs (
    id uuid primary key default gen_random_uuid(),
    workflow text not null,
    status text not null check (status in ('completed', 'failed')),
    summary text,
    tool_activity jsonb not null default '[]'::jsonb,
    created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index if not exists payments_created_at_idx
on payments(created_at);

create index if not exists payments_status_idx
on payments(status);

create index if not exists payments_customer_idx
on payments(customer_id);

create index if not exists subscriptions_customer_idx
on subscriptions(customer_id);

create index if not exists payment_events_payment_idx
on payment_events(payment_id);

create index if not exists payment_events_created_at_idx
on payment_events(created_at);

create index if not exists recovery_cases_payment_idx
on recovery_cases(payment_id);
