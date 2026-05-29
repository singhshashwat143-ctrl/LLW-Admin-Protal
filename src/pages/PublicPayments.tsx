import { useEffect, useRef, useState } from "react";
import { SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { formatCurrency, formatDateTime } from "../lib/format";
import { ensureRazorpayLoaded, useRazorpayCheckout } from "../lib/razorpay";

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

type PaymentRow = {
  id: string;
  order_number: string;
  student?: { id?: string; name?: string; email?: string; phone?: string } | null;
  product?: { id?: string; name?: string } | null;
  webinar?: { id?: string; title?: string } | null;
  bootcamp?: { id?: string; title?: string } | null;
  offer_title?: string;
  status: string;
  payment_state?: string;
  billing_model?: "ONE_TIME" | "SUBSCRIPTION";
  subscription_status?: string;
  subscription_id?: string;
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
  collect_customer_details_on_checkout?: boolean;
  payment_history: PaymentHistory[];
};

type CheckoutResponse = {
  order?: PaymentRow;
  payment?: PaymentHistory & { razorpay_order_id?: string; razorpay_subscription_id?: string };
  razorpayKeyId?: string;
  already_paid?: boolean;
  linkExpired?: boolean;
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

function returnToPortal() {
  window.location.assign("/payments");
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
      const response = await api<{ paid?: boolean; failed?: boolean; message?: string }>("/api/orders/reconcile-payment", {
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
          // Keep checkout usable even if failure logging does not succeed.
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
          subtitle={data.order.collect_customer_details_on_checkout ? "Enter your details first, then continue to Razorpay." : "This page is dedicated to your checkout and opens Razorpay directly without loading the admin dashboard."}
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
              {(data.order.discount_inr || 0) > 0 ? <div className="mt-1 text-sm text-[var(--text-secondary)]">Gross {formatCurrency((data.order.original_product_value_inr || 0) / 100)} • Discount {formatCurrency((data.order.discount_inr || 0) / 100)}</div> : null}
              {data.order.coupon_code ? <div className="mt-1 text-sm text-[var(--text-secondary)]">Coupon {data.order.coupon_code}</div> : null}
              <div className="mt-1 text-sm text-[var(--text-secondary)]">Collected so far {formatCurrency((data.order.amount_paid_inr || 0) / 100)}</div>
              {(data.order.refunded_amount_inr || 0) > 0 ? <div className="mt-1 text-sm text-[var(--text-secondary)]">Refunded {formatCurrency((data.order.refunded_amount_inr || 0) / 100)} • Net cash {formatCurrency((data.order.net_cash_in_hand_inr || 0) / 100)}</div> : null}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Pay now</div>
              <div className="mt-2 font-semibold text-[var(--text-strong)]">{formatCurrency((data.payment?.amount_inr || data.order.amount_due_inr || 0) / 100)}</div>
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
              <button className="btn-secondary" type="button" onClick={returnToPortal}>Back to Portal</button>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={returnToPortal}>Return to Payments</button>
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
  const [preparedSession, setPreparedSession] = useState<SubscriptionCheckoutResponse | null>(null);
  const [authorised, setAuthorised] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparingSession, setPreparingSession] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const prepareSessionRef = useRef<Promise<null | SubscriptionCheckoutResponse> | null>(null);
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

  useEffect(() => {
    setPreparedSession(null);
    prepareSessionRef.current = null;
  }, [data.order?.id, data.payment?.id]);

  async function prepareSubscriptionSession({ silent = false } = {}) {
    if (!data.order?.id || !data.payment?.id || data.linkExpired) {
      return null;
    }
    if (preparedSession?.payment?.id === data.payment.id && preparedSession?.order?.id === data.order.id) {
      return preparedSession;
    }
    if (prepareSessionRef.current) {
      return prepareSessionRef.current;
    }

    const request = (async () => {
      setPreparingSession(true);
      const session = await api<SubscriptionCheckoutResponse>("/api/subscriptions/checkout-session", {
        method: "POST",
        body: JSON.stringify({
          payment_id: data.payment.id,
          order_id: data.order.id,
        }),
      });
      setPreparedSession(session);
      if (session.subscription) {
        setSubscription(session.subscription);
      }
      if (session.already_authorized || isSubscriptionAuthorized(session.subscription?.status || data.order?.subscription_status)) {
        setAuthorised(true);
      }
      return session;
    })();

    prepareSessionRef.current = request;
    try {
      return await request;
    } catch (error) {
      if (!silent) {
        throw error;
      }
      return null;
    } finally {
      prepareSessionRef.current = null;
      setPreparingSession(false);
    }
  }

  useEffect(() => {
    if (!data.order?.id || !data.payment?.id || authorised || data.linkExpired) return;
    prepareSubscriptionSession({ silent: true }).catch(() => undefined);
  }, [authorised, data.linkExpired, data.order?.id, data.payment?.id]);

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

      const session = await prepareSubscriptionSession();
      if (!session) {
        throw new Error("Unable to prepare Razorpay subscription checkout.");
      }

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
          subtitle="This page is dedicated to the Livelong Wealth Platinum Plan and opens Razorpay subscription checkout without loading the admin dashboard first."
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
            Razorpay will open the subscription checkout on this page and collect the mandate authorization here. Future monthly charges are then handled automatically by the subscription schedule tied to this plan.
          </div>
          <div className="mt-4 rounded-2xl border border-[rgba(59,130,246,0.16)] bg-[rgba(59,130,246,0.08)] p-4 text-sm text-[var(--text-secondary)]">
            Razorpay's own docs say the QR appears on desktop Standard Checkout for UPI Autopay. If QR still does not appear, Razorpay is falling back to card or eMandate for that customer, bank, app, or device combination.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {!authorised ? (
              <button className="btn-primary" type="button" onClick={startMandateCheckout} disabled={loading || data.linkExpired}>
                {loading
                  ? "Opening Razorpay..."
                  : preparingSession && !preparedSession
                    ? "Preparing Mandate Checkout..."
                    : !razorpayReady
                      ? "Preparing Checkout..."
                      : "Authorize Monthly Mandate"}
              </button>
            ) : (
              <button className="btn-primary" type="button" onClick={() => reconcileSubscriptionStatus()}>
                {reconciling ? "Refreshing..." : "Refresh Subscription Status"}
              </button>
            )}
            <button className="btn-secondary" type="button" onClick={returnToPortal}>Back to Portal</button>
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
