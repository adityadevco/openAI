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