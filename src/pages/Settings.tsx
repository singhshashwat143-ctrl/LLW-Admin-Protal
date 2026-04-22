import { useEffect, useState } from "react";
import { Badge, PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency } from "../lib/format";

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
  usage_frequency?: "UNLIMITED" | "ONE_TIME" | "LIMITED";
  usage_limit_total?: number | null;
  expires_at?: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  discounted_price: number;
};

const initialCouponForm = {
  code: "",
  title: "",
  type: "FLAT",
  value: "",
  max_discount_inr: "",
  description: "",
  applies_to: "GENERAL",
  applicable_product_id: "",
  usage_frequency: "UNLIMITED",
  usage_limit_total: "",
  expires_at: "",
};

export function SettingsPage() {
  const { user } = useAuth();
  const { data } = useApi<any>("/api/settings", { settings: {} });
  const couponsApi = useApi<{ coupons: CouponRow[] }>("/api/coupons", { coupons: [] });
  const productsApi = useApi<{ products: ProductRow[] }>("/api/products", { products: [] });
  const settings = data.settings || {};
  const isAdminLevel = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [showCoupons, setShowCoupons] = useState(false);
  const [notice, setNotice] = useState("");
  const [couponForm, setCouponForm] = useState(initialCouponForm);
  const [notificationSettings, setNotificationSettings] = useState({
    aisensyPaymentLinkCampaign: "",
    aisensyWebhookUrl: "",
  });
  const canManageCoupons = isAdminLevel || user?.role === "BDM";

  useEffect(() => {
    setNotificationSettings({
      aisensyPaymentLinkCampaign: settings?.aisensyPaymentLinkCampaign || "",
      aisensyWebhookUrl: settings?.aisensyWebhookUrl || "",
    });
  }, [settings?.aisensyPaymentLinkCampaign, settings?.aisensyWebhookUrl]);

  async function createCoupon() {
    if (!canManageCoupons) {
      setNotice("Only admins and super admins can create coupons.");
      return;
    }

    try {
      const response = await api<{ coupon: CouponRow }>("/api/coupons", {
        method: "POST",
        body: JSON.stringify({
          ...couponForm,
          code: couponForm.code.trim().toUpperCase(),
          value: couponForm.type === "PERCENT" ? Number(couponForm.value || 0) : Number(couponForm.value || 0) * 100,
          max_discount_inr: couponForm.max_discount_inr ? Number(couponForm.max_discount_inr) * 100 : null,
          applicable_product_id: couponForm.applies_to === "PRODUCT" ? couponForm.applicable_product_id || null : null,
          usage_limit_total: couponForm.usage_frequency === "LIMITED" ? Number(couponForm.usage_limit_total || 0) : null,
          expires_at: couponForm.expires_at || null,
          created_by: user?.email || user?.name || "admin",
        }),
      });
      couponsApi.setData({ coupons: [response.coupon, ...couponsApi.data.coupons] });
      setCouponForm(initialCouponForm);
      setNotice(`Coupon ${response.coupon.code} created.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create coupon.");
    }
  }

  async function saveNotificationSettings() {
    if (!isAdminLevel) {
      setNotice("Only admin and super-admin users can update notification settings.");
      return;
    }
    try {
      await api("/api/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify({
          aisensy_payment_link_campaign: notificationSettings.aisensyPaymentLinkCampaign,
          aisensy_webhook_url: notificationSettings.aisensyWebhookUrl,
        }),
      });
      setNotice("Notification settings updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update notification settings.");
    }
  }

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Settings" title="System settings" description="Manage coupon rules and platform controls for the roles that own them." />

      {notice ? (
        <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}

      {isAdminLevel ? (
        <SectionCard title="Environment Keys">
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(settings)
              .filter(([key]) => key !== "couponPolicy")
              .map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-[rgba(201,168,76,0.14)] bg-[rgba(255,255,255,0.02)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">{key}</p>
                  <p className="mt-2 break-all font-mono text-sm">{String(value)}</p>
                </div>
              ))}
          </div>
        </SectionCard>
      ) : null}

      {isAdminLevel ? (
        <SectionCard title="Notification Settings" subtitle="Set the AiSensy API campaign that matches your approved payment-link template.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">AiSensy payment-link campaign</span>
              <input
                className="input-dark"
                value={notificationSettings.aisensyPaymentLinkCampaign}
                onChange={(event) => setNotificationSettings((current) => ({ ...current, aisensyPaymentLinkCampaign: event.target.value }))}
                placeholder="payment_link_onboarding_2"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">AiSensy webhook URL</span>
              <input
                className="input-dark"
                value={notificationSettings.aisensyWebhookUrl}
                onChange={(event) => setNotificationSettings((current) => ({ ...current, aisensyWebhookUrl: event.target.value }))}
                placeholder="https://funnels.livelongwealth.in/webhook/aisensy"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={saveNotificationSettings}>Save Notification Settings</button>
          </div>
        </SectionCard>
      ) : null}

      {canManageCoupons ? (
        <SectionCard title="Coupon Tools" subtitle="Admin and super-admin users can create any coupon. BDM users can create general or product-specific coupons, but the effective discount cannot go beyond 20% of the product value.">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">
            BDM coupon cap: {settings?.couponPolicy?.bdm_max_coupon_percent || 20}% of product value. Coupon visibility is role-based in onboarding and payments.
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" type="button" onClick={() => setShowCoupons((value) => !value)}>
              {showCoupons ? "Hide Coupon Admin" : "Reveal Coupon Admin"}
            </button>
          </div>

          {showCoupons ? (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <input className="input-dark" value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })} placeholder="Coupon code" />
                <input className="input-dark" value={couponForm.title} onChange={(event) => setCouponForm({ ...couponForm, title: event.target.value })} placeholder="Coupon title" />
                <select className="input-dark" value={couponForm.type} onChange={(event) => setCouponForm({ ...couponForm, type: event.target.value as "FLAT" | "PERCENT" })}>
                  <option value="FLAT">Flat amount</option>
                  <option value="PERCENT">Percentage</option>
                </select>
                <select className="input-dark" value={couponForm.applies_to} onChange={(event) => setCouponForm({ ...couponForm, applies_to: event.target.value, applicable_product_id: event.target.value === "PRODUCT" ? couponForm.applicable_product_id : "" })}>
                  <option value="GENERAL">General coupon</option>
                  <option value="PRODUCT">Specific product coupon</option>
                </select>
                <input className="input-dark" type="number" min="1" value={couponForm.value} onChange={(event) => setCouponForm({ ...couponForm, value: event.target.value })} placeholder={couponForm.type === "PERCENT" ? "Value (%)" : "Value (₹)"} />
                <input className="input-dark" type="number" min="0" value={couponForm.max_discount_inr} onChange={(event) => setCouponForm({ ...couponForm, max_discount_inr: event.target.value })} placeholder="Max discount (₹)" />
                <input className="input-dark" value={couponForm.description} onChange={(event) => setCouponForm({ ...couponForm, description: event.target.value })} placeholder="Description" />
                <input className="input-dark" type="date" value={couponForm.expires_at} onChange={(event) => setCouponForm({ ...couponForm, expires_at: event.target.value })} />
                <select className="input-dark" value={couponForm.usage_frequency} onChange={(event) => setCouponForm({ ...couponForm, usage_frequency: event.target.value, usage_limit_total: event.target.value === "LIMITED" ? couponForm.usage_limit_total : "" })}>
                  <option value="UNLIMITED">Unlimited use</option>
                  <option value="ONE_TIME">Use once</option>
                  <option value="LIMITED">Limited uses</option>
                </select>
                {couponForm.usage_frequency === "LIMITED" ? (
                  <input className="input-dark" type="number" min="1" value={couponForm.usage_limit_total} onChange={(event) => setCouponForm({ ...couponForm, usage_limit_total: event.target.value })} placeholder="Total uses allowed" />
                ) : null}
                {couponForm.applies_to === "PRODUCT" ? (
                  <select className="input-dark md:col-span-2 xl:col-span-3" value={couponForm.applicable_product_id} onChange={(event) => setCouponForm({ ...couponForm, applicable_product_id: event.target.value })}>
                    <option value="">Select product</option>
                    {productsApi.data.products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} • {formatCurrency(product.discounted_price / 100)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button className="btn-primary" type="button" onClick={createCoupon}>Create Coupon</button>
              </div>

              {couponsApi.data.coupons.length ? (
                <div className="mt-4 table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Scope</th>
                        <th>Value</th>
                        <th>Validity</th>
                        <th>Usage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {couponsApi.data.coupons.map((coupon) => (
                        <tr key={coupon.id}>
                          <td className="font-mono text-xs">{coupon.code}</td>
                          <td>{coupon.title}</td>
                          <td>{coupon.type}</td>
                          <td>{coupon.applies_to === "PRODUCT" ? "Product specific" : "General"}</td>
                          <td>
                            {coupon.type === "PERCENT"
                              ? `${coupon.value}%${coupon.max_discount_inr ? ` • max ${formatCurrency((coupon.max_discount_inr || 0) / 100)}` : ""}`
                              : formatCurrency((coupon.value || 0) / 100)}
                          </td>
                          <td>{coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString("en-IN") : "No expiry"}</td>
                          <td>
                            {coupon.usage_count || 0}
                            {coupon.usage_frequency === "ONE_TIME"
                              ? " / 1"
                              : coupon.usage_frequency === "LIMITED" && coupon.usage_limit_total
                                ? ` / ${coupon.usage_limit_total}`
                                : " / unlimited"}
                          </td>
                          <td><Badge tone={coupon.is_active ? "green" : "gold"}>{coupon.is_active ? "ACTIVE" : "INACTIVE"}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </SectionCard>
      ) : null}
    </div>
  );
}
