-- ============================================
-- PAYPILOT DEMO DATA
-- ============================================

-- ============================================
-- CUSTOMERS
-- ============================================

insert into customers
(name, email, company, segment, country)
values

('Arjun Mehta',
 'finance@acme.ai',
 'Acme AI',
 'Enterprise',
 'India'),

('Riya Sharma',
 'billing@cloudstack.io',
 'CloudStack',
 'Growth',
 'India'),

('Daniel Wong',
 'ops@novalabs.co',
 'Nova Labs',
 'Startup',
 'Singapore'),

('Sarah Chen',
 'billing@vertex.ai',
 'Vertex AI',
 'Enterprise',
 'Singapore'),

('Karan Patel',
 'finance@orbit.dev',
 'Orbit Systems',
 'Growth',
 'India'),

('Maya Singh',
 'accounts@neuralworks.ai',
 'NeuralWorks',
 'Startup',
 'India'),

('Alex Johnson',
 'finance@quantum.dev',
 'Quantum Dev',
 'Growth',
 'USA'),

('Priya Kapoor',
 'billing@scaleup.ai',
 'ScaleUp AI',
 'Enterprise',
 'India')

on conflict (email) do nothing;


-- ============================================
-- SUCCESSFUL PAYMENTS
-- ============================================

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 120000, 'INR', 'success', 'Visa •••• 4821',
now() - interval '6 days'
from customers where email = 'finance@acme.ai';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 145000, 'INR', 'success', 'Mastercard •••• 1192',
now() - interval '6 days'
from customers where email = 'billing@cloudstack.io';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 98000, 'INR', 'success', 'Visa •••• 7201',
now() - interval '5 days'
from customers where email = 'ops@novalabs.co';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 156000, 'INR', 'success', 'Amex •••• 8842',
now() - interval '5 days'
from customers where email = 'billing@vertex.ai';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 110000, 'INR', 'success', 'Visa •••• 3921',
now() - interval '4 days'
from customers where email = 'finance@orbit.dev';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 132000, 'INR', 'success', 'Mastercard •••• 2201',
now() - interval '3 days'
from customers where email = 'accounts@neuralworks.ai';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 87000, 'INR', 'success', 'Visa •••• 1102',
now() - interval '3 days'
from customers where email = 'finance@quantum.dev';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 142000, 'INR', 'success', 'Visa •••• 9931',
now() - interval '2 days'
from customers where email = 'billing@scaleup.ai';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 130000, 'INR', 'success', 'Mastercard •••• 4521',
now() - interval '1 day'
from customers where email = 'finance@acme.ai';

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 120000, 'INR', 'success', 'Visa •••• 8821',
now()
from customers where email = 'billing@vertex.ai';


-- ============================================
-- FAILED PAYMENTS
-- ============================================

insert into payments
(customer_id, amount, currency, status, payment_method, failure_reason, created_at)

select id, 84000, 'INR', 'failed', 'Visa •••• 4821',
'Card declined',
now() - interval '12 minutes'
from customers where email = 'finance@acme.ai';

insert into payments
(customer_id, amount, currency, status, payment_method, failure_reason, created_at)

select id, 31000, 'INR', 'failed', 'Mastercard •••• 1192',
'Insufficient funds',
now() - interval '34 minutes'
from customers where email = 'billing@cloudstack.io';

insert into payments
(customer_id, amount, currency, status, payment_method, failure_reason, created_at)

select id, 18500, 'INR', 'failed', 'Visa •••• 7201',
'Authentication required',
now() - interval '51 minutes'
from customers where email = 'ops@novalabs.co';

insert into payments
(customer_id, amount, currency, status, payment_method, failure_reason, created_at)

select id, 22500, 'INR', 'failed', 'Visa •••• 3921',
'Card expired',
now() - interval '1 hour'
from customers where email = 'finance@orbit.dev';

insert into payments
(customer_id, amount, currency, status, payment_method, failure_reason, created_at)

select id, 28000, 'INR', 'failed', 'Mastercard •••• 2201',
'Bank declined transaction',
now() - interval '2 hours'
from customers where email = 'accounts@neuralworks.ai';


-- ============================================
-- REFUND
-- ============================================

insert into payments
(customer_id, amount, currency, status, payment_method, created_at)

select id, 47000, 'INR', 'refunded', 'Visa •••• 8821',
now() - interval '2 days'
from customers where email = 'billing@vertex.ai';


-- ============================================
-- SUBSCRIPTIONS
-- ============================================

insert into subscriptions
(customer_id, plan_name, amount, billing_cycle, status, next_billing_date)

select id, 'Enterprise', 130000, 'monthly', 'active',
current_date + 17
from customers where email = 'finance@acme.ai';

insert into subscriptions
(customer_id, plan_name, amount, billing_cycle, status, next_billing_date)

select id, 'Growth', 75000, 'monthly', 'active',
current_date + 12
from customers where email = 'billing@cloudstack.io';

insert into subscriptions
(customer_id, plan_name, amount, billing_cycle, status, next_billing_date)

select id, 'Startup', 35000, 'monthly', 'active',
current_date + 8
from customers where email = 'ops@novalabs.co';

insert into subscriptions
(customer_id, plan_name, amount, billing_cycle, status, next_billing_date)

select id, 'Enterprise', 150000, 'monthly', 'active',
current_date + 21
from customers where email = 'billing@vertex.ai';

insert into subscriptions
(customer_id, plan_name, amount, billing_cycle, status, next_billing_date)

select id, 'Growth', 60000, 'monthly', 'past_due',
current_date + 3
from customers where email = 'finance@orbit.dev';


-- ============================================
-- PAYMENT EVENTS
-- ============================================

insert into payment_events
(payment_id, event_type, event_data)

select
id,
'payment.failed',
jsonb_build_object(
    'reason', failure_reason,
    'source', 'demo'
)
from payments
where status = 'failed';