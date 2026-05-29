import { useEffect, useMemo, useState } from "react";
import { Badge, PageHeader, SectionCard, StatCard } from "../components/UI";
import { PRODUCT_BATCH_OPTIONS } from "../lib/batches";
import { api, useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency, formatDateTime } from "../lib/format";
import { hasPermission, normalizeRole } from "../lib/permissions";
import { ensureRazorpayLoaded, useRazorpayCheckout } from "../lib/razorpay";
import { navigate } from "../lib/router";

type PaymentHistory = {
  id: string;
  amount_inr: number;
  method: string;
  status: string;
  type: string;
  stage: string;
  transaction_id: string;
  payment_link?: string;
  valid_until?: string | null;
  paid_at?: string | null;
  created_at: string;
  razorpay_subscription_id?: string;
  subscription_status?: string;
  subscription_current_start?: string | null;
  subscription_current_end?: string | null;
  subscription_charge_at?: string | null;
  subscription_authorized_at?: string | null;
};

type RefundRequestSummary = {
  id: string;
  status: string;
  next_approver_name?: string;
  already_exists?: boolean;
};

type PaymentRow = {
  id: string;
  order_number: string;
  student?: { id?: string; name?: string; email?: string; phone?: string } | null;
  bda?: { id?: string; name?: string } | null;
  product?: { id?: string; name?: string } | null;
  webinar?: { id?: string; title?: string } | null;
  bootcamp?: { id?: string; title?: string } | null;
  source?: string;
  source_type?: string;
  source_label?: string;
  offer_title?: string;
  status: string;
  payment_state?: string;
  billing_model?: "ONE_TIME" | "SUBSCRIPTION";
  subscription_status?: string;
  subscription_id?: string;
  subscription_plan_id?: string;
  subscription_amount_inr?: number;
  subscription_interval?: string;
  subscription_current_start?: string | null;
  subscription_current_end?: string | null;
  subscription_charge_at?: string | null;
  payment_mode: string;
  original_product_value_inr?: number;
  discount_inr?: number;
  coupon_code?: string;
  product_value_inr: number;
  amount_paid_inr: number;
  refunded_amount_inr?: number;
  net_cash_in_hand_inr?: number;
  amount_due_inr: number;
  promise_date?: string | null;
  payment_link?: string;
  current_link_valid_until?: string | null;
  latest_transaction_id?: string;
  latest_payment_method?: string;
  latest_payment_status?: string;
  latest_successful_payment_at?: string | null;
  batch_month_key?: string;
  batch_month_label?: string;
  batch_is_active?: boolean | null;
  payment_history: PaymentHistory[];
  refund_history?: RefundRequestSummary[];
  refund_count?: number;
  can_send_recovery?: boolean;
  recovery_installments_used?: number;
  recovery_installments_paid?: number;
  recovery_installments_remaining?: number;
  access_revocation_requested?: boolean;
  access_revocation_requested_at?: string | null;
  access_revocation_requested_by?: string;
  access_revoked?: boolean;
  access_revoked_at?: string | null;
  access_revoked_by?: string;
  operations: {
    portal_access_done: boolean;
    broker_setup_done: boolean;
    demat_setup_done: boolean;
    welcome_kit_sent: boolean;
  };
  operations_completed?: boolean;
  token_due?: { due_date?: string | null } | null;
  bdm_name?: string;
  manager_name?: string;
  collect_customer_details_on_checkout?: boolean;
  created_at: string;
};

type CheckoutResponse = {
  order?: PaymentRow;
  payment?: PaymentHistory & { razorpay_order_id?: string; razorpay_subscription_id?: string };
  razorpayKeyId?: string;
  already_paid?: boolean;
  linkExpired?: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  discounted_price: number;
  billing_model?: "ONE_TIME" | "SUBSCRIPTION";
  subscription_amount_inr?: number;
  subscription_interval?: string;
  subscription_total_count?: number;
  razorpay_plan_id?: string;
};

type SubscriptionCheckoutResponse = {
  order?: PaymentRow;
  payment?: CheckoutResponse["payment"];
  subscription?: {
    id: string;
    status?: string;
    short_url?: string;
    plan_id?: string;
    current_start?: number;
    current_end?: number;
    charge_at?: number;
  } | null;
  razorpayKeyId?: string;
  already_authorized?: boolean;
  linkExpired?: boolean;
};

type CouponRow = {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: "FLAT" | "PERCENT";
  value: number;
  max_discount_inr?: number | null;
  applicable_product_id?: string | null;
  applies_to?: "GENERAL" | "PRODUCT";
  is_active: boolean;
  usage_count?: number;
};

const initialPaymentForm = {
  customer_name: "",
  phone: "",
  email: "",
  source: "manual-link",
  product_id: "",
  payment_type: "FULL",
  payment_method: "RAZORPAY",
  token_amount: "",
  promise_date: "",
  alias_suffix: "",
  reference_code: "",
  coupon_code: "",
  sale_price: "",
};

function statusTone(status: string): "green" | "red" | "purple" | "gold" | "blue" | "teal" {
  if (status === "COMPLETED") return "green";
  if (["PARTIAL", "TOKEN"].includes(status)) return "blue";
  if (status === "FAILED") return "red";
  if (status === "REFUNDED") return "purple";
  if (status === "PENDING") return "gold";
  return "teal";
}

function paymentTone(status: string): "green" | "red" | "purple" | "gold" {
  if (status === "PAID") return "green";
  if (status === "FAILED") return "red";
  if (status === "REFUNDED") return "purple";
  return "gold";
}

function isSubscriptionAuthorized(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "authenticated" || normalized === "active";
}

function formatSubscriptionStatus(status?: string | null) {
  const normalized = String(status || "").trim();
  if (!normalized) return "Created";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function subscriptionStatusTone(status?: string | null): "green" | "gold" | "red" | "purple" | "blue" | "teal" {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active" || normalized === "authenticated") return "green";
  if (normalized === "created" || normalized === "pending") return "gold";
  if (normalized === "paused") return "blue";
  if (normalized === "cancelled" || normalized === "completed") return "purple";
  if (normalized === "halted" || normalized === "expired" || normalized === "failed") return "red";
  return "teal";
}

function getSubscriptionAmount(row: Pick<PaymentRow, "subscription_amount_inr" | "product_value_inr">) {
  return Number(row.subscription_amount_inr || row.product_value_inr || 0);
}

function getSubscriptionStatusKey(row: Pick<PaymentRow, "subscription_status">) {
  return String(row.subscription_status || "created").toLowerCase();
}

function matchesSubscriptionStatusFilter(row: Pick<PaymentRow, "subscription_status">, filter: string) {
  const status = getSubscriptionStatusKey(row);
  if (filter === "ALL") return true;
  if (filter === "ACTIVE") return status === "active" || status === "authenticated";
  if (filter === "PENDING") return status === "created" || status === "pending";
  if (filter === "STOPPED") return status === "cancelled" || status === "completed";
  if (filter === "FAILED") return status === "halted" || status === "expired" || status === "failed";
  return status === filter.toLowerCase();
}

function compactText(value: string, max = 32) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function getOfferTitle(row: PaymentRow) {
  return row.offer_title || row.product?.name || row.webinar?.title || row.bootcamp?.title || "Manual Entry";
}

function getPendingRefundRequest(row: PaymentRow) {
  return row.refund_history?.find((refund) => refund.status === "REQUESTED") || null;
}

function hasSuccessfulCollection(row: PaymentRow) {
  return Number(row.amount_paid_inr || 0) > 0 && row.payment_state !== "REFUNDED";
}

function getPendingOperations(row: PaymentRow) {
  const pending = [];
  if (!row.operations.portal_access_done) pending.push("Portal");
  if (!row.operations.broker_setup_done) pending.push("Broker");
  return pending;
}

function getBatchStatusLabel(row: Pick<PaymentRow, "batch_month_label" | "batch_is_active">) {
  if (!row.batch_month_label) return "";
  if (row.batch_is_active === true) return "Operational";
  if (row.batch_is_active === false) return "Non-operational";
  return "Saved batch";
}

function isExpired(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function calculateCouponDiscount(coupon: CouponRow | undefined, amountInr: number) {
  if (!coupon || !coupon.is_active || amountInr <= 0) return 0;
  const rawDiscount = coupon.type === "PERCENT" ? Math.round((amountInr * Number(coupon.value || 0)) / 100) : Number(coupon.value || 0);
  const capped = coupon.max_discount_inr ? Math.min(rawDiscount, Number(coupon.max_discount_inr || 0)) : rawDiscount;
  return Math.max(Math.min(capped, amountInr), 0);
}

function hasFlexiblePaymentLinkAccess(user?: { role?: string | null; email?: string | null; name?: string | null } | null) {
  const role = normalizeRole(user?.role);
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return true;
  }

  const email = String(user?.email || "").trim().toLowerCase();
  const name = String(user?.name || "").trim().toLowerCase();

  if (email === "admin@livelongwealth.com" || email === "shashwat@livelongwealth.com") {
    return true;
  }

  return name.includes("vaishakh") || name.includes("shashwat") || email.includes("vaishakh");
}

export function PaymentsPage() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const canViewProgramOps = role === "ADMIN" || role === "SUPER_ADMIN" || role === "OPERATIONS";
  const canManageImport = role === "ADMIN" || role === "SUPER_ADMIN";
  const canOverridePricing = hasFlexiblePaymentLinkAccess(user);
  const isRevenueScopedRole = role === "BDA" || role === "BDM";
  const paymentsApi = useApi<{ payments: PaymentRow[] }>("/api/payments", { payments: [] });
  const productsApi = useApi<{ products: ProductRow[] }>("/api/products", { products: [] });
  const couponsApi = useApi<{ coupons: CouponRow[] }>("/api/coupons", { coupons: [] });
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [creatingRecoveryId, setCreatingRecoveryId] = useState("");
  const paymentsDescription = role === "BDA"
    ? "View only your own payments, recoveries, and payment status inside the revenue workspace."
    : role === "BDM"
      ? "View only your team’s payments, recoveries, and payment status inside the revenue workspace."
      : "Track product, BDA, and manual payments from one desk with payment-only status, token recovery links, and detailed source filters.";
  const visibleSourceFilters = canViewProgramOps ? ["ALL", "BDA", "WEBINAR", "BOOTCAMP", "MANUAL"] : ["ALL", "BDA", "MANUAL"];

  const selectedProduct = useMemo(
    () => productsApi.data.products.find((product) => product.id === paymentForm.product_id),
    [paymentForm.product_id, productsApi.data.products],
  );

  const visibleCoupons = useMemo(() => {
    return couponsApi.data.coupons.filter((coupon) => (
      coupon.applies_to !== "PRODUCT" || !coupon.applicable_product_id || coupon.applicable_product_id === paymentForm.product_id
    ));
  }, [couponsApi.data.coupons, paymentForm.product_id]);

  const selectedCoupon = useMemo(() => {
    const code = paymentForm.coupon_code.trim().toUpperCase();
    return visibleCoupons.find((coupon) => coupon.code === code);
  }, [paymentForm.coupon_code, visibleCoupons]);

  const grossOrderValue = Number(selectedProduct?.discounted_price || 0);
  const couponDiscount = calculateCouponDiscount(selectedCoupon, grossOrderValue);
  const defaultNetOrderValue = Math.max(grossOrderValue - couponDiscount, 0);
  const explicitSalePrice = canOverridePricing ? Math.max(Number(paymentForm.sale_price || 0) * 100, 0) : 0;
  const netOrderValue = explicitSalePrice > 0 ? explicitSalePrice : defaultNetOrderValue;

  const filteredPayments = useMemo(() => {
    return paymentsApi.data.payments.filter((row) => {
      const rowDate = row.latest_successful_payment_at || row.created_at;
      const rowTime = rowDate ? new Date(rowDate).getTime() : null;
      const matchesSource = sourceFilter === "ALL" || row.source_type === sourceFilter;
      const matchesStatus = statusFilter === "ALL" || row.payment_state === statusFilter;
      const matchesMode = modeFilter === "ALL" || row.payment_mode === modeFilter;
      const matchesMethod = methodFilter === "ALL" || row.latest_payment_method === methodFilter;
      const matchesProduct = !productFilter || row.product?.id === productFilter;
      const matchesBatch = !batchFilter || row.batch_month_key === batchFilter;
      const matchesDateFrom = !dateFrom || (rowTime !== null && rowTime >= new Date(dateFrom).getTime());
      const matchesDateTo = !dateTo || (rowTime !== null && rowTime <= new Date(`${dateTo}T23:59:59.999`).getTime());
      const haystack = [row.student?.name, row.student?.phone, row.student?.email, getOfferTitle(row), row.batch_month_label, row.source_label, row.order_number, row.latest_transaction_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      return matchesSource && matchesStatus && matchesMode && matchesMethod && matchesProduct && matchesBatch && matchesDateFrom && matchesDateTo && matchesQuery;
    });
  }, [batchFilter, dateFrom, dateTo, methodFilter, modeFilter, paymentsApi.data.payments, productFilter, query, sourceFilter, statusFilter]);

  async function createPayment() {
    const fullAmount = netOrderValue;
    const tokenAmount = Number(paymentForm.token_amount || 0) * 100;
    const amount = paymentForm.payment_type === "TOKEN" ? tokenAmount : fullAmount;
    const requiresCustomerFields = paymentForm.payment_method !== "RAZORPAY";

    if (!paymentForm.product_id) {
      setNotice("Select a product before creating the payment flow.");
      return;
    }
    if (requiresCustomerFields && (!paymentForm.customer_name || !paymentForm.phone)) {
      setNotice("Customer name, phone, and product are required for manual payments.");
      return;
    }
    if (!amount) {
      setNotice("Choose a product value or token amount before creating a payment.");
      return;
    }
    if (paymentForm.payment_type === "TOKEN" && tokenAmount >= fullAmount) {
      setNotice("Token amount must be lower than the sold value.");
      return;
    }

    try {
      const response = await api<{ order: PaymentRow; payment: PaymentHistory; link?: { short_url?: string } }>("/api/payment-links", {
        method: "POST",
        body: JSON.stringify({
          ...paymentForm,
          source_type: "MANUAL",
          amount_inr: amount,
          original_product_value_inr: grossOrderValue,
          product_value_inr: fullAmount,
          token_amount: paymentForm.payment_type === "TOKEN" ? tokenAmount : 0,
          collect_customer_details_on_checkout: paymentForm.payment_method === "RAZORPAY",
        }),
      });
      paymentsApi.setData({ payments: [response.order, ...paymentsApi.data.payments] });
      setNotice(
        paymentForm.payment_method === "RAZORPAY"
          ? `Product payment link created: ${response.link?.short_url || response.payment.payment_link || ""}. Customer details will be collected on checkout.`
          : `Manual payment recorded with transaction ${response.payment.transaction_id}.`,
      );
      setShowForm(false);
      setPaymentForm(initialPaymentForm);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create payment.");
    }
  }

  async function requestRefund(row: PaymentRow) {
    const existingRequest = getPendingRefundRequest(row);
    if (existingRequest) {
      setNotice(`Refund request already pending for ${row.student?.name || row.order_number}.`);
      return;
    }

    try {
      const response = await api<{ refund: RefundRequestSummary }>("/api/refunds", {
        method: "POST",
        body: JSON.stringify({
          order_id: row.id,
          requested_by: user?.name || "Admin",
          requested_by_email: user?.email || "admin@livelongwealth.com",
          user_comment: `Refund requested from payments board for ${row.student?.name || row.id}.`,
        }),
      });
      setNotice(
        response.refund.already_exists
          ? `Refund request already pending for ${row.student?.name || row.order_number}.`
          : `Refund request ${response.refund.status.toLowerCase()} for ${row.student?.name || row.order_number}.`,
      );
      paymentsApi.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to request refund.");
    }
  }

  async function markPaid(row: PaymentRow) {
    const openPayment = row.payment_history.find((payment) => payment.status === "CREATED") || row.payment_history[0];
    if (!openPayment) {
      setNotice("No open payment record was found for this order.");
      return;
    }
    await api("/api/orders/verify-payment", {
      method: "POST",
      body: JSON.stringify({ payment_id: openPayment.id }),
    });
    setNotice(`Marked transaction ${openPayment.transaction_id} as paid.`);
    paymentsApi.refresh();
  }

  async function markFailed(row: PaymentRow) {
    const openPayment = row.payment_history.find((payment) => payment.status === "CREATED") || row.payment_history[0];
    if (!openPayment) {
      setNotice("No open payment record was found for this order.");
      return;
    }
    await api("/api/orders/mark-payment-failed", {
      method: "POST",
      body: JSON.stringify({ payment_id: openPayment.id, order_id: row.id }),
    });
    setNotice(`Marked transaction ${openPayment.transaction_id} as failed.`);
    paymentsApi.refresh();
  }

  async function copyPaymentLink(row: PaymentRow) {
    const link = row.payment_link || row.payment_history.find((payment) => payment.payment_link)?.payment_link;
    if (!link) {
      setNotice("No payment link is available for this order.");
      return;
    }
    const absolute = link.startsWith("http") ? link : `${window.location.origin}${link}`;
    await navigator.clipboard?.writeText(absolute);
    setNotice(`Copied ${absolute}`);
  }

  async function createRemainingLink(row: PaymentRow) {
    setCreatingRecoveryId(row.id);
    try {
      const defaultAmount = Math.round((row.amount_due_inr || 0) / 100);
      const amountInput = window.prompt("Enter the recovery amount in rupees. Leave it as the full remaining amount if you want one final link.", String(defaultAmount));
      if (amountInput === null) {
        setCreatingRecoveryId("");
        return;
      }
      const promiseInput = window.prompt(
        "Enter the promise date for this recovery link in YYYY-MM-DD format. Leave blank to keep the current promise date.",
        row.promise_date ? row.promise_date.slice(0, 10) : "",
      );
      if (promiseInput === null) {
        setCreatingRecoveryId("");
        return;
      }
      const response = await api<{ payment?: { payment_link?: string; transaction_id?: string }; link?: { short_url?: string } }>(`/api/orders/${row.id}/recovery-link`, {
        method: "POST",
        body: JSON.stringify({
          payment_method: "RAZORPAY",
          amount_inr: Math.max(Number(amountInput || defaultAmount), 0) * 100,
          promise_date: promiseInput || row.promise_date || undefined,
        }),
      });
      setNotice(`Remaining amount link created: ${response.link?.short_url || response.payment?.payment_link || response.payment?.transaction_id || ""}`);
      paymentsApi.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create remaining amount link.");
    } finally {
      setCreatingRecoveryId("");
    }
  }

  async function requestAccessRevoke(row: PaymentRow) {
    try {
      await api<{ order: PaymentRow }>(`/api/orders/${row.id}/request-access-revoke`, {
        method: "POST",
      });
      setNotice(`Access revoke request raised for ${row.student?.name || row.order_number}.`);
      paymentsApi.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to request access revoke.");
    }
  }

  return (
    <div className="page-grid compact-canvas admin-page-grid payments-page-grid">
      <PageHeader
        eyebrow="Payments"
        title="Payment desk"
        description={paymentsDescription}
        actions={
          <div className="page-actions">
            <button className="btn-secondary" type="button" onClick={() => navigate("/onboarding")}>Onboarding Form</button>
            <button className="btn-secondary" type="button" onClick={() => navigate("/payments/subscriptions")}>Subscription Tracker</button>
            {hasPermission(user, "export_data") ? <button className="btn-secondary" type="button" onClick={() => navigate("/exports")}>Data Export</button> : null}
            {hasPermission(user, "manage_operations") ? <button className="btn-secondary" type="button" onClick={() => navigate("/operations")}>Operations Queue</button> : null}
            {canManageImport ? <button className="btn-secondary" type="button" onClick={() => navigate("/payments/import")}>Payment Import</button> : null}
            <button className="btn-secondary" type="button" onClick={() => setShowForm((value) => !value)}>
              {showForm ? "Hide Payment Form" : "Generate Payment Link"}
            </button>
          </div>
        }
      />

      {notice ? (
        <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}

      {isRevenueScopedRole ? (
        <div className="rounded-[22px] border border-[rgba(59,130,246,0.2)] bg-[rgba(59,130,246,0.08)] px-5 py-4 text-sm text-[var(--text-strong)]">
          {role === "BDA" ? "Only your own payment rows and recovery links are visible here." : "Only your team’s payment rows and recovery links are visible here."}
        </div>
      ) : null}

      {!hasPermission(user, "approve_refunds") ? (
        <div className="rounded-[22px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.09)] px-5 py-4 text-sm text-[#b45309] dark:text-[#fbbf24]">
          Your account can submit refund requests here. Refund approvals and data exports are available only to admin-level users.
        </div>
      ) : null}

      {showForm ? (
        <SectionCard title="Generate Link or Record Payment" subtitle="This flow is back to a plain product-based payment link. No BDA mapping is attached here; customer details are collected on checkout for Razorpay, and onboarding remains the BDA-specific flow.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input className="input-dark" value={paymentForm.source} onChange={(event) => setPaymentForm({ ...paymentForm, source: event.target.value })} placeholder="Lead source / campaign" />

            <select
              className="input-dark"
              value={paymentForm.product_id}
              onChange={(event) => setPaymentForm({ ...paymentForm, product_id: event.target.value })}
            >
              <option value="">Select product</option>
              {productsApi.data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>

            <select className="input-dark" value={paymentForm.payment_type} onChange={(event) => setPaymentForm({ ...paymentForm, payment_type: event.target.value })}>
              <option value="FULL">Full payment</option>
              <option value="TOKEN">Token payment</option>
            </select>

            <select className="input-dark" value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })}>
              <option value="RAZORPAY">Razorpay</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
            </select>

            {paymentForm.payment_method !== "RAZORPAY" ? (
              <>
                <input className="input-dark" value={paymentForm.customer_name} onChange={(event) => setPaymentForm({ ...paymentForm, customer_name: event.target.value })} placeholder="Customer name" />
                <input className="input-dark" value={paymentForm.phone} onChange={(event) => setPaymentForm({ ...paymentForm, phone: event.target.value })} placeholder="Phone" />
                <input className="input-dark" type="email" value={paymentForm.email} onChange={(event) => setPaymentForm({ ...paymentForm, email: event.target.value })} placeholder="Email" />
              </>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-secondary)] md:col-span-2 xl:col-span-2">
                This Razorpay link stays product-specific only. The customer will enter their own name, phone, and email on the payment page.
              </div>
            )}

            {paymentForm.payment_type === "TOKEN" ? (
              <>
                <input className="input-dark" type="number" min="1" value={paymentForm.token_amount} onChange={(event) => setPaymentForm({ ...paymentForm, token_amount: event.target.value })} placeholder="Token amount (₹)" />
                <input className="input-dark" type="date" value={paymentForm.promise_date} onChange={(event) => setPaymentForm({ ...paymentForm, promise_date: event.target.value })} />
              </>
            ) : null}

            {canOverridePricing ? (
              <input
                className="input-dark"
                type="number"
                min="1"
                value={paymentForm.sale_price}
                onChange={(event) => setPaymentForm({ ...paymentForm, sale_price: event.target.value })}
                placeholder="Custom sold value (₹)"
              />
            ) : null}

            <input className="input-dark" value={paymentForm.alias_suffix} onChange={(event) => setPaymentForm({ ...paymentForm, alias_suffix: event.target.value })} placeholder="Alias suffix" />
            <input
              className="input-dark"
              list="coupon-code-list"
              value={paymentForm.coupon_code}
              onChange={(event) => setPaymentForm({ ...paymentForm, coupon_code: event.target.value.toUpperCase() })}
              placeholder="Coupon code (optional)"
            />
            <datalist id="coupon-code-list">
              {visibleCoupons.map((coupon) => (
                <option key={coupon.id} value={coupon.code}>
                  {coupon.title}
                </option>
              ))}
            </datalist>
            {(paymentForm.payment_method === "BANK_TRANSFER" || paymentForm.payment_method === "CASH") ? (
              <input className="input-dark" value={paymentForm.reference_code} onChange={(event) => setPaymentForm({ ...paymentForm, reference_code: event.target.value })} placeholder="Receipt / reference code" />
            ) : null}
          </div>

          {selectedProduct ? (
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm">
              <div className="font-medium text-[var(--text-strong)]">Order value preview</div>
              <div className="mt-2 flex flex-wrap gap-4 text-[var(--text-secondary)]">
                <span>Gross {formatCurrency(grossOrderValue / 100)}</span>
                <span>Discount {formatCurrency(couponDiscount / 100)}</span>
                <span className="font-medium text-[var(--text-strong)]">Sold {formatCurrency(netOrderValue / 100)}</span>
                {selectedCoupon ? <span>Coupon {selectedCoupon.code}</span> : null}
                {canOverridePricing && explicitSalePrice > 0 ? <span>Custom price override</span> : null}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={createPayment}>
              {paymentForm.payment_method === "RAZORPAY" ? "Create Payment Link" : "Record Payment"}
            </button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Payments Board" subtitle="Filter by product, batch, source, payment state, mode, method, and date inside your visible revenue scope.">
        <div className="payments-toolbar mb-4">
          <div className="payments-filters">
            <select className="input-dark min-w-[150px]" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              {visibleSourceFilters.map((source) => <option key={source}>{source}</option>)}
            </select>
            <select className="input-dark min-w-[150px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {["ALL", "PENDING", "COMPLETED", "TOKEN", "PARTIAL", "FAILED", "REFUNDED"].map((status) => <option key={status}>{status}</option>)}
            </select>
            <select className="input-dark min-w-[150px]" value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
              {["ALL", "FULL", "TOKEN"].map((mode) => <option key={mode}>{mode}</option>)}
            </select>
            <select className="input-dark min-w-[170px]" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
              {["ALL", "RAZORPAY", "BANK_TRANSFER", "CASH"].map((method) => <option key={method}>{method}</option>)}
            </select>
            <select className="input-dark min-w-[180px]" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
              <option value="">All products</option>
              {productsApi.data.products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <select className="input-dark min-w-[150px]" value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)}>
              <option value="">All batches</option>
              {PRODUCT_BATCH_OPTIONS.map((batch) => <option key={batch.key} value={batch.key}>{batch.label}</option>)}
            </select>
            <input className="input-dark min-w-[150px]" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <input className="input-dark min-w-[150px]" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div className="payments-search">
            <input className="input-dark" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by customer, source, product, order, or transaction ID" />
          </div>
        </div>

        <div className="table-shell table-shell-scrollable admin-table-scroll payments-table-scroll">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Source</th>
                <th>BDA</th>
                <th>BDM</th>
                <th>Payment / Offer</th>
                <th>Value / Paid / Due</th>
                <th>Transaction History</th>
                <th>Payment Status</th>
                <th>Actions</th>
              </tr>
            </thead>
              <tbody>
              {filteredPayments.map((row) => {
                const pendingRefund = getPendingRefundRequest(row);
                const successfulCollection = hasSuccessfulCollection(row);
                const pendingOperations = getPendingOperations(row);

                return (
                <tr key={row.id}>
                  <td>
                    <div className="cell-stack">
                      <div className="font-medium text-[var(--text-strong)]">{compactText(row.student?.name || "Guest user", 26)}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{row.student?.phone || "-"}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{compactText(row.student?.email || row.order_number || "-", 30)}</div>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <div><Badge tone={row.source_type === "WEBINAR" ? "purple" : row.source_type === "BDA" ? "blue" : row.source_type === "MANUAL" ? "gold" : "teal"}>{row.source_type || "MANUAL"}</Badge></div>
                      <div className="text-xs text-[var(--text-secondary)]">{compactText(row.source_label || row.source || "—", 24)}</div>
                    </div>
                  </td>
                  <td>
                    <div>{row.bda?.name || "—"}</div>
                  </td>
                  <td>
                    <div>{row.bdm_name || row.manager_name || "Unassigned BDM"}</div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <div>{getOfferTitle(row)}</div>
                      {row.batch_month_label ? (
                        <div className="text-xs text-[var(--text-secondary)]">
                          Batch {row.batch_month_label}{getBatchStatusLabel(row) ? ` • ${getBatchStatusLabel(row)}` : ""}
                        </div>
                      ) : null}
                      {row.billing_model === "SUBSCRIPTION" ? (
                        <div className="text-xs text-[var(--text-secondary)]">
                          Subscription mandate • {row.subscription_status ? formatSubscriptionStatus(row.subscription_status) : "Not authorized yet"}
                        </div>
                      ) : null}
                      <div className="text-xs text-[var(--text-secondary)]">{row.payment_mode} order</div>
                      <div className="text-xs text-[var(--text-secondary)]">Created {formatDateTime(row.created_at)}</div>
                      {row.coupon_code ? <div className="text-xs text-[var(--text-secondary)]">Coupon {row.coupon_code}</div> : null}
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <div>Net value {formatCurrency((row.product_value_inr || 0) / 100)}</div>
                      {(row.original_product_value_inr || 0) > (row.product_value_inr || 0) ? (
                        <div className="text-xs text-[var(--text-secondary)]">Gross {formatCurrency((row.original_product_value_inr || 0) / 100)}</div>
                      ) : null}
                      {row.discount_inr ? <div className="text-xs text-[var(--text-secondary)]">Discount {formatCurrency((row.discount_inr || 0) / 100)}</div> : null}
                      <div className="text-xs text-[var(--text-secondary)]">Paid {formatCurrency((row.amount_paid_inr || 0) / 100)}</div>
                      {row.refunded_amount_inr ? <div className="text-xs text-[var(--text-secondary)]">Refunded {formatCurrency((row.refunded_amount_inr || 0) / 100)}</div> : null}
                      <div className="text-xs text-[var(--text-secondary)]">Net cash {formatCurrency((row.net_cash_in_hand_inr || 0) / 100)}</div>
                      <div className="text-xs text-[var(--text-secondary)]">Due {formatCurrency((row.amount_due_inr || 0) / 100)}</div>
                      {row.token_due?.due_date ? <div className="text-xs text-[var(--text-secondary)]">Due date {new Date(row.token_due.due_date).toLocaleDateString("en-IN")}</div> : null}
                      {row.current_link_valid_until ? (
                        <div className="text-xs text-[var(--text-secondary)]">
                          Link valid till {new Date(row.current_link_valid_until).toLocaleDateString("en-IN")}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="space-y-2">
                      {row.payment_history.map((payment) => (
                        <div key={payment.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[var(--text-strong)]">{payment.transaction_id}</span>
                            <Badge tone={paymentTone(payment.status)}>{payment.status}</Badge>
                          </div>
                          <div className="mt-1 text-[var(--text-secondary)]">
                            {formatCurrency((payment.amount_inr || 0) / 100)} • {payment.method.replaceAll("_", " ")} • {payment.stage.replaceAll("_", " ")}
                          </div>
                          {payment.subscription_status ? (
                            <div className="mt-1 text-[var(--text-secondary)]">Subscription {formatSubscriptionStatus(payment.subscription_status)}</div>
                          ) : null}
                          <div className="mt-1 text-[var(--text-secondary)]">{formatDateTime(payment.paid_at || payment.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <Badge tone={statusTone(row.payment_state || "PENDING")}>{row.payment_state || "PENDING"}</Badge>
                      <div className="text-xs text-[var(--text-secondary)]">{row.latest_payment_method?.replaceAll("_", " ") || "—"} • {row.latest_payment_status || "CREATED"}</div>
                      {row.billing_model === "SUBSCRIPTION" ? <div className="text-xs text-[var(--text-secondary)]">Mandate {formatSubscriptionStatus(row.subscription_status)}</div> : null}
                      {row.latest_successful_payment_at ? <div className="text-xs text-[var(--text-secondary)]">Latest paid {formatDateTime(row.latest_successful_payment_at)}</div> : null}
                      {pendingRefund ? <div className="text-xs text-[var(--text-secondary)]">Refund request pending</div> : null}
                      {row.payment_mode === "TOKEN" && row.amount_due_inr > 0 ? (
                        <div className="text-xs text-[var(--text-secondary)]">
                          Recovery chances left {row.recovery_installments_remaining ?? 0}
                        </div>
                      ) : null}
                      {successfulCollection ? (
                        <>
                          <div>
                            <Badge tone={row.operations_completed ? "green" : "gold"}>
                              {row.operations_completed ? "Operations Completed" : "Operations Pending"}
                            </Badge>
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            {row.operations_completed ? "All onboarding and access steps are done." : `Pending: ${pendingOperations.join(", ") || "Operations review"}`}
                          </div>
                        </>
                      ) : null}
                      {row.access_revoked ? <div className="text-xs text-[var(--danger)]">Access revoked</div> : null}
                      {!row.access_revoked && row.access_revocation_requested ? (
                        <div className="text-xs text-[var(--text-secondary)]">Access revoke requested</div>
                      ) : null}
                      {row.operations.portal_access_done && !row.access_revoked && !row.access_revocation_requested ? (
                        <div className="text-xs text-[var(--text-secondary)]">Portal access active</div>
                      ) : null}
                      {row.current_link_valid_until && isExpired(row.current_link_valid_until) ? (
                        <div className="text-xs text-[var(--danger)]">Current payment link expired</div>
                      ) : null}
                      {row.refund_count ? <div className="text-xs text-[var(--text-secondary)]">{row.refund_count} refund entr{row.refund_count === 1 ? "y" : "ies"}</div> : null}
                    </div>
                  </td>
                  <td className="sticky-actions">
                    <div className="table-action-row">
                      <button className="btn-secondary btn-compact" type="button" onClick={() => copyPaymentLink(row)}>Copy</button>
                      {row.billing_model !== "SUBSCRIPTION" && row.payment_history.some((payment) => payment.status === "CREATED") ? (
                        <button className="btn-success btn-compact" type="button" onClick={() => markPaid(row)}>Mark Paid</button>
                      ) : null}
                      {row.billing_model !== "SUBSCRIPTION" && row.payment_history.some((payment) => payment.status === "CREATED") ? (
                        <button className="btn-secondary btn-compact" type="button" onClick={() => markFailed(row)}>Mark Failed</button>
                      ) : null}
                      {row.can_send_recovery ? (
                        <button
                          className="btn-secondary btn-compact"
                          type="button"
                          onClick={() => createRemainingLink(row)}
                          disabled={creatingRecoveryId === row.id || (row.payment_mode === "TOKEN" && (row.recovery_installments_remaining ?? 0) <= 0)}
                        >
                          {creatingRecoveryId === row.id ? "Creating..." : "Send Due Link"}
                        </button>
                      ) : null}
                      {pendingRefund ? (
                        <button className="btn-secondary btn-compact" type="button" disabled>Refund Pending</button>
                      ) : row.amount_paid_inr > 0 && row.payment_state !== "REFUNDED" ? (
                        <button className="btn-alert btn-compact" type="button" onClick={() => requestRefund(row)}>Request Refund</button>
                      ) : null}
                      {row.operations.portal_access_done && !row.access_revoked && !row.access_revocation_requested ? (
                        <button className="btn-secondary btn-compact" type="button" onClick={() => requestAccessRevoke(row)}>Request Access Revoke</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
              {!filteredPayments.length ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    No payments matched the current source, state, mode, or date filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function SubscriptionPaymentsPage() {
  const paymentsApi = useApi<{ payments: PaymentRow[] }>("/api/payments", { payments: [] });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const subscriptionRows = useMemo(
    () => paymentsApi.data.payments.filter((row) => row.billing_model === "SUBSCRIPTION"),
    [paymentsApi.data.payments],
  );

  const ownerOptions = useMemo(() => {
    const owners = new Map<string, string>();
    subscriptionRows.forEach((row) => {
      const label = row.bdm_name || row.manager_name || row.bda?.name || "";
      if (label) {
        owners.set(label, label);
      }
    });
    return [...owners.values()].sort((left, right) => left.localeCompare(right));
  }, [subscriptionRows]);

  const filteredRows = useMemo(() => {
    return subscriptionRows.filter((row) => {
      const rowTime = new Date(row.created_at || 0).getTime();
      const ownerLabel = row.bdm_name || row.manager_name || row.bda?.name || "";
      const haystack = [
        row.student?.name,
        row.student?.phone,
        row.student?.email,
        row.product?.name,
        row.order_number,
        row.subscription_id,
        row.subscription_plan_id,
        row.latest_transaction_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesStatus = matchesSubscriptionStatusFilter(row, statusFilter);
      const matchesOwner = !ownerFilter || ownerLabel === ownerFilter;
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const matchesDateFrom = !dateFrom || (Number.isFinite(rowTime) && rowTime >= new Date(dateFrom).getTime());
      const matchesDateTo = !dateTo || (Number.isFinite(rowTime) && rowTime <= new Date(`${dateTo}T23:59:59.999`).getTime());
      return matchesStatus && matchesOwner && matchesQuery && matchesDateFrom && matchesDateTo;
    });
  }, [dateFrom, dateTo, ownerFilter, query, statusFilter, subscriptionRows]);

  const summary = useMemo(() => {
    const activeCount = filteredRows.filter((row) => {
      const status = getSubscriptionStatusKey(row);
      return status === "active" || status === "authenticated";
    }).length;
    const pendingCount = filteredRows.filter((row) => {
      const status = getSubscriptionStatusKey(row);
      return status === "created" || status === "pending";
    }).length;
    const stoppedCount = filteredRows.filter((row) => {
      const status = getSubscriptionStatusKey(row);
      return status === "cancelled" || status === "completed";
    }).length;
    const failedCount = filteredRows.filter((row) => {
      const status = getSubscriptionStatusKey(row);
      return status === "halted" || status === "expired" || status === "failed";
    }).length;
    const activeMrr = filteredRows
      .filter((row) => {
        const status = getSubscriptionStatusKey(row);
        return status === "active" || status === "authenticated";
      })
      .reduce((sum, row) => sum + getSubscriptionAmount(row), 0);
    const totalCollected = filteredRows.reduce((sum, row) => sum + Number(row.amount_paid_inr || 0), 0);
    const nextChargeCount = filteredRows.filter((row) => {
      if (!row.subscription_charge_at) return false;
      const nextChargeTime = new Date(row.subscription_charge_at).getTime();
      const weekAhead = Date.now() + (7 * 24 * 60 * 60 * 1000);
      return Number.isFinite(nextChargeTime) && nextChargeTime <= weekAhead;
    }).length;

    return {
      total: filteredRows.length,
      activeCount,
      pendingCount,
      stoppedCount,
      failedCount,
      activeMrr,
      totalCollected,
      nextChargeCount,
    };
  }, [filteredRows]);

  return (
    <div className="page-grid compact-canvas admin-page-grid payments-page-grid">
      <PageHeader
        eyebrow="Subscriptions"
        title="Subscription payment tracker"
        description="Dedicated tracking for Platinum subscription mandates only. This page excludes one-time and token payment rows, and focuses on mandate lifecycle, recurring value, and customer status."
        actions={
          <>
            <button className="btn-secondary" type="button" onClick={paymentsApi.refresh}>Refresh</button>
            <button className="btn-secondary" type="button" onClick={() => navigate("/onboarding")}>Onboarding Form</button>
            <button className="btn-primary" type="button" onClick={() => navigate("/payments")}>Payments Board</button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Subscribers" value={String(summary.total)} meta="All subscription orders in the current filter" />
        <StatCard label="Active Mandates" value={String(summary.activeCount)} meta="Authenticated or active recurring mandates" />
        <StatCard label="Pending Setup" value={String(summary.pendingCount)} meta="Links created but the mandate is still not active" />
        <StatCard label="Cancelled / Completed" value={String(summary.stoppedCount)} meta="Customers who stopped or finished the subscription lifecycle" />
        <StatCard label="Failed / Halted" value={String(summary.failedCount)} meta="Mandates that need manual attention or retry guidance" />
        <StatCard label="Active MRR" value={formatCurrency(summary.activeMrr / 100)} meta={`Collected till date ${formatCurrency(summary.totalCollected / 100)} • ${summary.nextChargeCount} next charges due within 7 days`} />
      </div>

      <SectionCard title="Subscription Board" subtitle="Only subscription orders are listed here, with mandate status, cycle dates, transaction history, and recurring value.">
        <div className="payments-toolbar mb-4">
          <div className="payments-filters">
            <select className="input-dark min-w-[180px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {["ALL", "ACTIVE", "PENDING", "STOPPED", "FAILED", "PAUSED", "CREATED", "AUTHENTICATED", "CANCELLED", "EXPIRED"].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select className="input-dark min-w-[190px]" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="">All owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
            <input className="input-dark min-w-[150px]" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <input className="input-dark min-w-[150px]" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div className="payments-search">
            <input className="input-dark" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by customer, plan, subscription ID, order, or transaction ID" />
          </div>
        </div>

        <div className="table-shell table-shell-scrollable admin-table-scroll payments-table-scroll">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Subscriber</th>
                <th>Owner</th>
                <th>Plan</th>
                <th>Mandate Status</th>
                <th>Cycle Tracking</th>
                <th>Value / Cash</th>
                <th>Transaction History</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const paymentLink = row.payment_link || row.payment_history.find((payment) => payment.payment_link)?.payment_link || "";
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="cell-stack">
                        <div className="font-medium text-[var(--text-strong)]">{compactText(row.student?.name || "Guest user", 26)}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{row.student?.phone || "-"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{compactText(row.student?.email || row.order_number || "-", 30)}</div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <div>{row.bda?.name || "—"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{row.bdm_name || row.manager_name || "Unassigned manager"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{row.source_label || row.source || "—"}</div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <div>{getOfferTitle(row)}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{formatCurrency(getSubscriptionAmount(row) / 100)}/{String(row.subscription_interval || "MONTHLY").toLowerCase()}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{row.subscription_plan_id || "Plan pending"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">Created {formatDateTime(row.created_at)}</div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <div><Badge tone={subscriptionStatusTone(row.subscription_status)}>{formatSubscriptionStatus(row.subscription_status)}</Badge></div>
                        <div className="text-xs text-[var(--text-secondary)]">{row.subscription_id || "Subscription will be created on first checkout"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">Payment state {row.payment_state || "PENDING"}</div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <div className="text-xs text-[var(--text-secondary)]">{row.subscription_current_start ? `Start ${formatDateTime(row.subscription_current_start)}` : "Cycle begins after mandate auth"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{row.subscription_current_end ? `End ${formatDateTime(row.subscription_current_end)}` : "Current cycle end pending"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{row.subscription_charge_at ? `Next charge ${formatDateTime(row.subscription_charge_at)}` : "Next charge pending"}</div>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <div>MRR {formatCurrency(getSubscriptionAmount(row) / 100)}</div>
                        <div className="text-xs text-[var(--text-secondary)]">Collected {formatCurrency((row.amount_paid_inr || 0) / 100)}</div>
                        <div className="text-xs text-[var(--text-secondary)]">Net cash {formatCurrency((row.net_cash_in_hand_inr || 0) / 100)}</div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-2">
                        {row.payment_history.map((payment) => (
                          <div key={payment.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[var(--text-strong)]">{payment.transaction_id}</span>
                              <Badge tone={payment.subscription_status ? subscriptionStatusTone(payment.subscription_status) : paymentTone(payment.status)}>
                                {payment.subscription_status ? formatSubscriptionStatus(payment.subscription_status) : payment.status}
                              </Badge>
                            </div>
                            <div className="mt-1 text-[var(--text-secondary)]">
                              {formatCurrency((payment.amount_inr || 0) / 100)} • {payment.method.replaceAll("_", " ")}
                            </div>
                            <div className="mt-1 text-[var(--text-secondary)]">{formatDateTime(payment.paid_at || payment.created_at)}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="sticky-actions">
                      <div className="table-action-row">
                        <button className="btn-secondary btn-compact" type="button" onClick={async () => {
                          if (!paymentLink) return;
                          const absolute = paymentLink.startsWith("http") ? paymentLink : `${window.location.origin}${paymentLink}`;
                          await navigator.clipboard?.writeText(absolute);
                        }}>
                          Copy Link
                        </button>
                        {paymentLink ? (
                          <button className="btn-secondary btn-compact" type="button" onClick={() => navigate(paymentLink.startsWith("http") ? new URL(paymentLink).pathname : paymentLink)}>
                            Open
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    No subscription payments matched the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export function PaymentCheckoutPage({ id }: { id: string }) {
  const { data, refresh, setData } = useApi<CheckoutResponse>(`/api/orders/${id}`, {});
  const [paid, setPaid] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "" });
  const [reconciling, setReconciling] = useState(false);
  const { ready: razorpayReady, loadError: razorpayLoadError } = useRazorpayCheckout();

  useEffect(() => {
    if (!data.order) return;
    const currentName = data.order.student?.name || "";
    const shouldHidePlaceholder = data.order.collect_customer_details_on_checkout && currentName === "Customer completes at checkout";
    setCustomerForm({
      name: shouldHidePlaceholder ? "" : currentName,
      phone: data.order.student?.phone || "",
      email: data.order.student?.email || "",
    });
    setCouponCode(data.order.coupon_code || "");
  }, [data.order]);

  const canApplyPublicCoupon = Boolean(
    data.order?.product?.id
    && data.order?.payment_mode === "FULL"
    && data.payment?.type === "ENROLLMENT"
    && data.payment?.status !== "PAID"
    && data.payment?.method === "RAZORPAY"
    && !data.linkExpired,
  );

  async function reconcilePaymentStatus() {
    if (!data.order?.id || !data.payment?.id || reconciling || paid) return false;
    try {
      setReconciling(true);
      const response = await api<{ paid?: boolean; failed?: boolean; message?: string; order?: CheckoutResponse["order"]; payment?: CheckoutResponse["payment"] }>("/api/orders/reconcile-payment", {
        method: "POST",
        body: JSON.stringify({
          order_id: data.order.id,
          payment_id: data.payment.id,
        }),
      });
      if (response.paid) {
        setPaid(true);
        setNotice("Payment completed successfully.");
        refresh();
        return true;
      }
      if (response.failed) {
        setNotice(response.message || "Payment failed. Please try again.");
        refresh();
      }
      return false;
    } catch {
      return false;
    } finally {
      setReconciling(false);
    }
  }

  useEffect(() => {
    if (!data.order?.id || !data.payment?.id || paid) return;

    const onFocus = () => {
      reconcilePaymentStatus().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reconcilePaymentStatus().catch(() => undefined);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [data.order?.id, data.payment?.id, paid]);

  async function payNow() {
    try {
      setLoading(true);
      setNotice("");
      if (data.order?.collect_customer_details_on_checkout && (!customerForm.name.trim() || !customerForm.phone.trim() || !customerForm.email.trim())) {
        throw new Error("Please enter your name, phone number, and email before payment.");
      }
      if (data.linkExpired) {
        throw new Error("This payment link has expired. Please ask the team for a fresh link.");
      }
      const [session] = await Promise.all([
        api<CheckoutResponse>("/api/orders/checkout-session", {
          method: "POST",
          body: JSON.stringify({
            payment_id: data.payment?.id || id,
            order_id: data.order?.id,
            customer_name: customerForm.name.trim(),
            phone: customerForm.phone.trim(),
            email: customerForm.email.trim(),
          }),
        }),
        ensureRazorpayLoaded(),
      ]);

      if (session.already_paid || session.payment?.status === "PAID") {
        setPaid(true);
        setNotice("Payment already completed.");
        refresh();
        return;
      }

      if (session.payment?.method !== "RAZORPAY") {
        throw new Error("This transaction was created as a manual payment record and cannot be paid through Razorpay.");
      }

      if (!window.Razorpay || !session.payment?.razorpay_order_id || !session.razorpayKeyId) {
        throw new Error("Razorpay checkout could not be initialized.");
      }

      const checkout = new window.Razorpay({
        key: session.razorpayKeyId,
        amount: session.payment.amount_inr,
        currency: "INR",
        name: "Livelong Wealth",
        description: session.order?.offer_title || session.order?.product?.name || session.order?.webinar?.title || session.order?.bootcamp?.title || "Enrollment payment",
        order_id: session.payment.razorpay_order_id,
        prefill: {
          name: session.order?.collect_customer_details_on_checkout ? "" : session.order?.student?.name || customerForm.name || "",
          email: session.order?.collect_customer_details_on_checkout ? "" : session.order?.student?.email || customerForm.email || "",
          contact: session.order?.collect_customer_details_on_checkout ? "" : session.order?.student?.phone || customerForm.phone || "",
        },
        theme: { color: "#4f46e5" },
        handler: async (response: Record<string, string>) => {
          await api("/api/orders/verify-payment", {
            method: "POST",
            body: JSON.stringify({
              payment_id: session.payment?.id || id,
              order_id: session.order?.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          setPaid(true);
          setNotice("Payment completed successfully.");
          refresh();
        },
        modal: {
          ondismiss: async () => {
            const reconciled = await reconcilePaymentStatus();
            if (!reconciled) {
              setNotice((current) => current || "Checkout was closed before payment completion.");
            }
          },
        },
      });

      checkout.on?.("payment.failed", async (response: any) => {
        try {
          await api("/api/orders/mark-payment-failed", {
            method: "POST",
            body: JSON.stringify({
              payment_id: session.payment?.id || id,
              order_id: session.order?.id,
              failure_code: response?.error?.code,
              failure_reason: response?.error?.description || response?.error?.reason,
            }),
          });
        } catch {
          // Ignore failure logging issues and keep checkout usable.
        }
        setNotice(response?.error?.description || "Payment failed. Please try again.");
        refresh();
      });

      checkout.open();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to start Razorpay checkout.");
    } finally {
      setLoading(false);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) {
      setNotice("Enter a coupon code first.");
      return;
    }
    try {
      setApplyingCoupon(true);
      setNotice("");
      const response = await api<CheckoutResponse>("/api/orders/apply-coupon", {
        method: "POST",
        body: JSON.stringify({
          payment_id: data.payment?.id || id,
          order_id: data.order?.id,
          coupon_code: couponCode.trim().toUpperCase(),
        }),
      });
      setData(response);
      setCouponCode(response.order?.coupon_code || couponCode.trim().toUpperCase());
      setNotice(`Coupon ${response.order?.coupon_code || couponCode.trim().toUpperCase()} applied.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to apply coupon.");
    } finally {
      setApplyingCoupon(false);
    }
  }

  if (!data.order) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <SectionCard
          title={paid ? "Payment complete" : "Complete your payment"}
          subtitle={data.order.collect_customer_details_on_checkout ? "Enter your details first, then continue to Razorpay." : "Each transaction in the OMS flow carries its own transaction ID and remaining amount calculation."}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Customer</div>
              <div className="mt-2 font-semibold text-[var(--text-strong)]">
                {data.order.collect_customer_details_on_checkout ? "Details captured on this page" : data.order.student?.name || "Guest"}
              </div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">
                {data.order.collect_customer_details_on_checkout ? "Name, phone, and email are required before payment." : data.order.student?.phone || "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Transaction ID</div>
              <div className="mt-2 font-mono font-semibold text-[var(--text-strong)]">{data.payment?.transaction_id || "Pending"}</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">{data.payment?.stage?.replaceAll("_", " ") || data.order.payment_mode}</div>
              {data.payment?.valid_until ? (
                <div className="mt-1 text-sm text-[var(--text-secondary)]">
                  Valid till {new Date(data.payment.valid_until).toLocaleDateString("en-IN")}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Product value</div>
              <div className="mt-2 font-semibold text-[var(--text-strong)]">{formatCurrency((data.order.product_value_inr || 0) / 100)}</div>
              {(data.order.discount_inr || 0) > 0 ? <div className="mt-1 text-sm text-[var(--text-secondary)]">Gross {formatCurrency(((data.order.original_product_value_inr || 0)) / 100)} • Discount {formatCurrency(((data.order.discount_inr || 0)) / 100)}</div> : null}
              {data.order.coupon_code ? <div className="mt-1 text-sm text-[var(--text-secondary)]">Coupon {data.order.coupon_code}</div> : null}
              <div className="mt-1 text-sm text-[var(--text-secondary)]">Collected so far {formatCurrency((data.order.amount_paid_inr || 0) / 100)}</div>
              {(data.order.refunded_amount_inr || 0) > 0 ? <div className="mt-1 text-sm text-[var(--text-secondary)]">Refunded {formatCurrency(((data.order.refunded_amount_inr || 0)) / 100)} • Net cash {formatCurrency(((data.order.net_cash_in_hand_inr || 0)) / 100)}</div> : null}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Pay now</div>
              <div className="mt-2 font-semibold text-[var(--text-strong)]">{formatCurrency(((data.payment?.amount_inr || data.order.amount_due_inr || 0)) / 100)}</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">Remaining after this: {formatCurrency(Math.max((data.order.amount_due_inr || 0) - (data.payment?.amount_inr || 0), 0) / 100)}</div>
            </div>
          </div>

          {notice ? (
            <div className="mt-4 rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
              {notice}
            </div>
          ) : null}

          {!notice && razorpayLoadError ? (
            <div className="mt-4 rounded-[22px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-sm text-[var(--danger)]">
              {razorpayLoadError}
            </div>
          ) : null}

          {data.linkExpired ? (
            <div className="mt-4 rounded-[22px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-sm text-[var(--danger)]">
              This payment link has expired. Please request a fresh payment link from the LLW team.
            </div>
          ) : null}

          {!paid && data.order.collect_customer_details_on_checkout ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <input
                className="input-dark"
                value={customerForm.name}
                onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Full name"
              />
              <input
                className="input-dark"
                value={customerForm.phone}
                onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Phone number"
              />
              <input
                className="input-dark"
                type="email"
                value={customerForm.email}
                onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Email address"
              />
            </div>
          ) : null}

          {!paid && canApplyPublicCoupon ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className="input-dark"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                disabled={Boolean(data.order.coupon_code)}
              />
              <button className="btn-secondary" type="button" onClick={applyCoupon} disabled={applyingCoupon || Boolean(data.order.coupon_code)}>
                {data.order.coupon_code ? "Coupon Applied" : applyingCoupon ? "Applying..." : "Apply Coupon"}
              </button>
            </div>
          ) : null}

          {!paid ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={payNow} disabled={loading || !razorpayReady || data.payment?.method !== "RAZORPAY" || data.linkExpired}>
                {loading ? "Preparing Secure Checkout..." : !razorpayReady ? "Loading Checkout..." : "Pay with Razorpay"}
              </button>
              <button className="btn-secondary" type="button" onClick={() => navigate("/payments")}>Back to Portal</button>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={() => navigate("/payments")}>Return to Payments</button>
            </div>
          )}
        </SectionCard>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500">
          <span>Secure payments are processed through Razorpay.</span>
          <a href="/privacy-policy" className="text-slate-700 underline underline-offset-4">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionCheckoutPage({ id }: { id: string }) {
  const { data, refresh } = useApi<CheckoutResponse>(`/api/orders/${id}`, {});
  const [subscription, setSubscription] = useState<SubscriptionCheckoutResponse["subscription"]>(null);
  const [authorised, setAuthorised] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const { ready: razorpayReady, loadError: razorpayLoadError } = useRazorpayCheckout();

  useEffect(() => {
    const currentStatus = data.order?.subscription_status || data.payment?.subscription_status || "";
    setAuthorised(isSubscriptionAuthorized(currentStatus));
    if (data.payment?.razorpay_subscription_id || data.order?.subscription_id) {
      setSubscription((current) => ({
        id: data.payment?.razorpay_subscription_id || data.order?.subscription_id || current?.id || "",
        status: currentStatus || current?.status || "",
      }));
    }
  }, [data.order, data.payment]);

  async function reconcileSubscriptionStatus() {
    if (!data.order?.id || !data.payment?.id || reconciling) return false;
    try {
      setReconciling(true);
      const response = await api<SubscriptionCheckoutResponse & { authorized?: boolean; message?: string }>("/api/subscriptions/reconcile", {
        method: "POST",
        body: JSON.stringify({
          order_id: data.order.id,
          payment_id: data.payment.id,
        }),
      });
      if (response.subscription) {
        setSubscription(response.subscription);
      }
      if (response.authorized) {
        setAuthorised(true);
        setNotice("Mandate set up successfully.");
        refresh();
        return true;
      }
      refresh();
      return false;
    } catch {
      return false;
    } finally {
      setReconciling(false);
    }
  }

  useEffect(() => {
    if (!data.order?.id || !data.payment?.id || authorised) return;

    const onFocus = () => {
      reconcileSubscriptionStatus().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reconcileSubscriptionStatus().catch(() => undefined);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authorised, data.order?.id, data.payment?.id]);

  async function startMandateCheckout() {
    try {
      setLoading(true);
      setNotice("");
      if (data.linkExpired) {
        throw new Error("This subscription link has expired. Please ask the team for a fresh link.");
      }

      const session = await api<SubscriptionCheckoutResponse>("/api/subscriptions/checkout-session", {
        method: "POST",
        body: JSON.stringify({
          payment_id: data.payment?.id || id,
          order_id: data.order?.id,
        }),
      });

      if (session.subscription) {
        setSubscription(session.subscription);
      }

      if (session.already_authorized || isSubscriptionAuthorized(session.subscription?.status || data.order?.subscription_status)) {
        setAuthorised(true);
        setNotice("Mandate already active for this subscription.");
        refresh();
        return;
      }

      await ensureRazorpayLoaded();

      if (!window.Razorpay || !session.subscription?.id || !session.razorpayKeyId) {
        throw new Error("Razorpay subscription checkout could not be initialized.");
      }

      const checkout = new window.Razorpay({
        key: session.razorpayKeyId,
        subscription_id: session.subscription.id,
        name: "Livelong Wealth",
        description: session.order?.offer_title || session.order?.product?.name || "Monthly subscription mandate",
        prefill: {
          name: session.order?.student?.name || "",
          email: session.order?.student?.email || "",
          contact: session.order?.student?.phone || "",
        },
        theme: { color: "#4f46e5" },
        handler: async (response: Record<string, string>) => {
          const verified = await api<SubscriptionCheckoutResponse & { authorized?: boolean }>("/api/subscriptions/verify", {
            method: "POST",
            body: JSON.stringify({
              payment_id: session.payment?.id || id,
              order_id: session.order?.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          if (verified.subscription) {
            setSubscription(verified.subscription);
          }
          setAuthorised(Boolean(verified.authorized));
          setNotice(verified.authorized ? "Mandate set up successfully." : "Subscription authorization captured. Status is syncing.");
          refresh();
        },
        modal: {
          ondismiss: async () => {
            const reconciled = await reconcileSubscriptionStatus();
            if (!reconciled) {
              setNotice((current) => current || "Checkout was closed before mandate completion.");
            }
          },
        },
      });

      checkout.on?.("payment.failed", async (response: any) => {
        setNotice(response?.error?.description || "Mandate authorization failed. Please try again.");
        await reconcileSubscriptionStatus();
      });

      checkout.open();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to start Razorpay subscription checkout.");
    } finally {
      setLoading(false);
    }
  }

  if (!data.order) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  const subscriptionStatus = subscription?.status || data.order.subscription_status || data.payment?.subscription_status || "";
  const currentStart = data.order.subscription_current_start || data.payment?.subscription_current_start || null;
  const currentEnd = data.order.subscription_current_end || data.payment?.subscription_current_end || null;
  const nextChargeAt = data.order.subscription_charge_at || data.payment?.subscription_charge_at || null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <SectionCard
          title={authorised ? "Mandate active" : "Activate your monthly subscription"}
          subtitle="This page is dedicated to the Livelong Wealth Platinum Plan and opens a Razorpay subscription mandate checkout instead of the standard one-time payment flow."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Subscriber</div>
              <div className="mt-2 font-semibold text-[var(--text-strong)]">{data.order.student?.name || "Guest"}</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">{data.order.student?.phone || "—"}</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">{data.order.student?.email || "—"}</div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Subscription status</div>
              <div className="mt-2 font-semibold text-[var(--text-strong)]">{formatSubscriptionStatus(subscriptionStatus)}</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">{subscription?.id || data.order.subscription_id || data.payment?.razorpay_subscription_id || "Subscription will be created on checkout"}</div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Plan amount</div>
              <div className="mt-2 font-semibold text-[var(--text-strong)]">{formatCurrency((data.order.product_value_inr || 0) / 100)}/month</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">{data.order.product?.name || "Livelong Wealth Platinum Plan"}</div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Cycle tracking</div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">{currentStart ? `Current cycle start ${formatDateTime(currentStart)}` : "Cycle starts after mandate authentication."}</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">{currentEnd ? `Current cycle end ${formatDateTime(currentEnd)}` : "Next billing date will appear after Razorpay activates the subscription."}</div>
              {nextChargeAt ? <div className="mt-1 text-sm text-[var(--text-secondary)]">Next charge {formatDateTime(nextChargeAt)}</div> : null}
            </div>
          </div>

          {notice ? (
            <div className="mt-4 rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
              {notice}
            </div>
          ) : null}

          {!notice && razorpayLoadError ? (
            <div className="mt-4 rounded-[22px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-sm text-[var(--danger)]">
              {razorpayLoadError}
            </div>
          ) : null}

          {data.linkExpired ? (
            <div className="mt-4 rounded-[22px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-sm text-[var(--danger)]">
              This subscription link has expired. Please request a fresh link from the LLW team.
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">
            Razorpay will first collect the card mandate authorization. Future monthly charges are then handled automatically by the subscription schedule tied to this plan.
          </div>
          <div className="mt-4 rounded-2xl border border-[rgba(59,130,246,0.16)] bg-[rgba(59,130,246,0.08)] p-4 text-sm text-[var(--text-secondary)]">
            Razorpay shows the subscription QR on desktop Standard Checkout when UPI Autopay is enabled for your account. On mobile, or when the account/app/bank combination does not support that mandate flow, Checkout may show card or eMandate options instead of a QR.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {!authorised ? (
              <button className="btn-primary" type="button" onClick={startMandateCheckout} disabled={loading || !razorpayReady || data.linkExpired}>
                {loading ? "Preparing Mandate Checkout..." : !razorpayReady ? "Loading Checkout..." : "Authorize Monthly Mandate"}
              </button>
            ) : (
              <button className="btn-primary" type="button" onClick={() => reconcileSubscriptionStatus()}>
                {reconciling ? "Refreshing..." : "Refresh Subscription Status"}
              </button>
            )}
            <button className="btn-secondary" type="button" onClick={() => navigate("/payments")}>Back to Portal</button>
          </div>
        </SectionCard>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500">
          <span>Secure recurring payments are processed through Razorpay Subscriptions.</span>
          <a href="/privacy-policy" className="text-slate-700 underline underline-offset-4">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
