import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency } from "../lib/format";
import { navigate } from "../lib/router";

type ProductRow = {
  id: string;
  name: string;
  discounted_price: number;
};

type CouponRow = {
  id: string;
  code: string;
  title: string;
  type: "FLAT" | "PERCENT";
  value: number;
  max_discount_inr?: number | null;
  applicable_product_id?: string | null;
  applies_to?: "GENERAL" | "PRODUCT";
  is_active: boolean;
};

type CampaignRow = {
  name: string;
  channel?: string;
  department?: string;
  last_seen_at: string;
};

type TeamResponse = {
  bdas: Array<{ id: string; name: string; manager_name?: string }>;
};

const initialForm = {
  customer_name: "",
  phone: "",
  email: "",
  source: "",
  product_id: "",
  bda_id: "",
  payment_type: "FULL",
  payment_method: "RAZORPAY",
  token_amount: "",
  promise_date: "",
  alias_suffix: "",
  reference_code: "",
  coupon_code: "",
};

function calculateCouponDiscount(coupon: CouponRow | undefined, amountInr: number) {
  if (!coupon || !coupon.is_active || amountInr <= 0) return 0;
  const rawDiscount = coupon.type === "PERCENT" ? Math.round((amountInr * Number(coupon.value || 0)) / 100) : Number(coupon.value || 0);
  const capped = coupon.max_discount_inr ? Math.min(rawDiscount, Number(coupon.max_discount_inr || 0)) : rawDiscount;
  return Math.max(Math.min(capped, amountInr), 0);
}

export function OnboardingPage() {
  const { user } = useAuth();
  const productsApi = useApi<{ products: ProductRow[] }>("/api/products", { products: [] });
  const teamApi = useApi<TeamResponse>("/api/team", { bdas: [] });
  const couponsApi = useApi<{ coupons: CouponRow[] }>("/api/coupons", { coupons: [] });
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ paymentLink?: string; orderId?: string; transactionId?: string } | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<CampaignRow[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<CampaignRow[]>([]);

  useEffect(() => {
    if (!form.bda_id && teamApi.data.bdas.length) {
      const preferred =
        user?.role === "BDA" ? teamApi.data.bdas.find((entry) => entry.id === user.id)?.id || user.id : teamApi.data.bdas[0]?.id || "";
      setForm((current) => ({ ...current, bda_id: preferred }));
    }
  }, [form.bda_id, teamApi.data.bdas, user]);

  useEffect(() => {
    let active = true;
    api<{ recent_campaigns?: CampaignRow[] }>("/api/marketing/campaigns?recentDays=30")
      .then((response) => {
        if (!active) return;
        const campaigns = response.recent_campaigns || [];
        setRecentCampaigns(campaigns);
        setCampaignOptions(campaigns);
      })
      .catch(() => {
        if (!active) return;
        setRecentCampaigns([]);
        setCampaignOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const query = form.source.trim();
    if (query.length < 2) {
      setCampaignOptions(recentCampaigns);
      return () => {
        active = false;
      };
    }
    api<{ recent_campaigns?: CampaignRow[]; campaigns?: CampaignRow[] }>(`/api/marketing/campaigns?recentDays=30&query=${encodeURIComponent(query)}`)
      .then((response) => {
        if (!active) return;
        const merged = new Map<string, CampaignRow>();
        [...(response.recent_campaigns || []), ...(response.campaigns || [])].forEach((campaign) => {
          merged.set(campaign.name, campaign);
        });
        setCampaignOptions([...merged.values()]);
      })
      .catch(() => {
        if (!active) return;
        setCampaignOptions(recentCampaigns);
      });
    return () => {
      active = false;
    };
  }, [form.source, recentCampaigns]);

  const selectedProduct = useMemo(
    () => productsApi.data.products.find((product) => product.id === form.product_id) ?? null,
    [form.product_id, productsApi.data.products],
  );

  const visibleCoupons = useMemo(() => {
    return couponsApi.data.coupons.filter((coupon) => (
      coupon.applies_to !== "PRODUCT" || !coupon.applicable_product_id || coupon.applicable_product_id === form.product_id
    ));
  }, [couponsApi.data.coupons, form.product_id]);

  const selectedCoupon = useMemo(() => {
    const code = form.coupon_code.trim().toUpperCase();
    return visibleCoupons.find((coupon) => coupon.code === code);
  }, [form.coupon_code, visibleCoupons]);

  const grossAmount = Number(selectedProduct?.discounted_price || 0);
  const discountAmount = calculateCouponDiscount(selectedCoupon, grossAmount);
  const fullAmount = Math.max(grossAmount - discountAmount, 0);
  const tokenAmount = Number(form.token_amount || 0) * 100;
  const initialCollection = form.payment_type === "TOKEN" ? tokenAmount : fullAmount;
  const dueAmount = Math.max(fullAmount - initialCollection, 0);

  function updateField<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.customer_name || !form.phone || !form.product_id) {
      setError("Customer name, phone, and product are required.");
      return;
    }
    if (form.payment_type === "TOKEN" && (!tokenAmount || tokenAmount >= fullAmount)) {
      setError("Enter a token amount that is lower than the full course value.");
      return;
    }
    if ((form.payment_method === "CASH" || form.payment_method === "BANK_TRANSFER") && !form.reference_code.trim()) {
      setError("Add the cash receipt or transfer reference before saving a manual payment.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await api<{
        order: { id: string };
        payment: { transaction_id?: string; payment_link?: string };
        link?: { short_url?: string };
      }>("/api/enrollments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          coupon_code: form.coupon_code.trim().toUpperCase(),
          amount_inr: form.payment_type === "TOKEN" ? tokenAmount : fullAmount,
          original_product_value_inr: grossAmount,
          token_amount: form.payment_type === "TOKEN" ? tokenAmount : 0,
          campaign_source: form.source,
          collect_customer_details_on_checkout: false,
        }),
      });

      setResult({
        paymentLink: response.link?.short_url || response.payment?.payment_link || "",
        orderId: response.order?.id,
        transactionId: response.payment?.transaction_id,
      });
      setNotice(
        form.payment_method === "RAZORPAY"
          ? "Enrollment created and payment link generated."
          : "Enrollment saved and manual payment recorded.",
      );
      setForm((current) => ({
        ...initialForm,
        bda_id: current.bda_id,
      }));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create enrollment.");
    } finally {
      setLoading(false);
    }
  }

  async function copyResultLink() {
    if (!result?.paymentLink) return;
    await navigator.clipboard?.writeText(result.paymentLink);
    setNotice("Payment link copied to clipboard.");
  }

  return (
    <div className="page-grid compact-canvas">
      <PageHeader
        eyebrow="BDA Onboarding"
        title="Customer onboarding form"
        description="Create a fresh enrollment for a BDA, choose Razorpay or a manual payment method, and automatically calculate the remaining amount when a token is collected."
        actions={
          <>
            <button className="btn-secondary" type="button" onClick={() => navigate("/tracker")}>Open Tracker</button>
            <button className="btn-primary" type="button" onClick={() => navigate("/payments")}>Payments Board</button>
          </>
        }
      />

      {notice ? <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">{notice}</div> : null}
      {error ? <div className="rounded-[22px] border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-sm text-[var(--danger)]">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <SectionCard title="Enrollment Form" subtitle="A lightweight OMS-style onboarding flow for BDAs and operations.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Customer name</span>
              <input className="input-dark" value={form.customer_name} onChange={(event) => updateField("customer_name", event.target.value)} placeholder="Rahul Sharma" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Phone</span>
              <input className="input-dark" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="9876543210" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Email</span>
              <input className="input-dark" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="rahul@example.com" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Campaign source</span>
              <input
                className="input-dark"
                list="marketing-campaign-options"
                value={form.source}
                onChange={(event) => updateField("source", event.target.value)}
                placeholder="Search campaign"
              />
              <datalist id="marketing-campaign-options">
                {campaignOptions.map((campaign) => (
                  <option key={`${campaign.name}-${campaign.last_seen_at}`} value={campaign.name}>
                    {[campaign.channel, campaign.department].filter(Boolean).join(" • ")}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Assign BDA</span>
              <select className="input-dark" value={form.bda_id} onChange={(event) => updateField("bda_id", event.target.value)}>
                <option value="">Select BDA</option>
                {teamApi.data.bdas.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}{entry.manager_name ? ` • ${entry.manager_name}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Product</span>
              <select className="input-dark" value={form.product_id} onChange={(event) => updateField("product_id", event.target.value)}>
                <option value="">Select program</option>
                {productsApi.data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} • {formatCurrency(product.discounted_price / 100)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Payment type</span>
              <select className="input-dark" value={form.payment_type} onChange={(event) => updateField("payment_type", event.target.value)}>
                <option value="FULL">Full payment</option>
                <option value="TOKEN">Token payment</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Payment method</span>
              <select className="input-dark" value={form.payment_method} onChange={(event) => updateField("payment_method", event.target.value)}>
                <option value="RAZORPAY">Razorpay</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
              </select>
            </label>
            {form.payment_type === "TOKEN" ? (
              <>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Token amount (₹)</span>
                  <input className="input-dark" type="number" min="1" value={form.token_amount} onChange={(event) => updateField("token_amount", event.target.value)} placeholder="5000" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Promise date</span>
                  <input className="input-dark" type="date" value={form.promise_date} onChange={(event) => updateField("promise_date", event.target.value)} />
                </label>
              </>
            ) : null}
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Alias suffix</span>
              <input className="input-dark" value={form.alias_suffix} onChange={(event) => updateField("alias_suffix", event.target.value)} placeholder="rahul-apr" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Coupon code</span>
              <input
                className="input-dark"
                list="onboarding-coupon-codes"
                value={form.coupon_code}
                onChange={(event) => updateField("coupon_code", event.target.value.toUpperCase())}
                placeholder="Optional coupon"
              />
              <datalist id="onboarding-coupon-codes">
                {visibleCoupons.map((coupon) => (
                  <option key={coupon.id} value={coupon.code}>
                    {coupon.title}
                  </option>
                ))}
              </datalist>
            </label>
            {(form.payment_method === "CASH" || form.payment_method === "BANK_TRANSFER") ? (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  {form.payment_method === "CASH" ? "Receipt number" : "UTR / transfer reference"}
                </span>
                <input className="input-dark" value={form.reference_code} onChange={(event) => updateField("reference_code", event.target.value)} placeholder={form.payment_method === "CASH" ? "CASH-2041" : "UTR123456"} />
              </label>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : form.payment_method === "RAZORPAY" ? "Create Enrollment & Link" : "Create Enrollment & Record Payment"}
            </button>
            {result?.paymentLink ? (
              <button className="btn-secondary" type="button" onClick={copyResultLink}>Copy Payment Link</button>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Pricing Summary" subtitle="This mirrors the OMS-style sold value, collection, and due breakdown.">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Net product value</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(fullAmount / 100)}</p>
              {(discountAmount || selectedCoupon) ? (
                <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                  <div>Gross {formatCurrency(grossAmount / 100)}</div>
                  <div>Discount {formatCurrency(discountAmount / 100)}</div>
                  {selectedCoupon ? <div>Coupon {selectedCoupon.code}</div> : null}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Collection now</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(initialCollection / 100)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Remaining due</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(dueAmount / 100)}</p>
            </div>
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">
              {form.payment_type === "TOKEN"
                ? "A separate remaining-amount link will be generated later from the payment board with its own transaction ID."
                : "A full-payment order moves straight to operations once the payment is marked or completed."}
            </div>
            {result?.orderId ? (
              <div className="rounded-2xl border border-[rgba(79,70,229,0.16)] bg-[rgba(79,70,229,0.05)] p-4 text-sm">
                <div className="font-semibold text-[var(--text-strong)]">Latest result</div>
                <div className="mt-2 text-[var(--text-secondary)]">Order ID: <span className="font-mono text-[var(--text-strong)]">{result.orderId}</span></div>
                {result.transactionId ? <div className="mt-1 text-[var(--text-secondary)]">Transaction ID: <span className="font-mono text-[var(--text-strong)]">{result.transactionId}</span></div> : null}
                {result.paymentLink ? <div className="mt-1 break-all text-[var(--text-secondary)]">Link: <span className="text-[var(--accent)]">{result.paymentLink}</span></div> : null}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
