import { useState } from "react";
import { PageHeader, SectionCard } from "../components/UI";
import { api, useApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCurrency } from "../lib/format";
import { normalizeRole } from "../lib/permissions";

type ProductBatch = {
  key: string;
  label: string;
  is_active: boolean;
};

type ProductSessionDate = {
  key: string;
  mode: string;
  language: string;
  learning_schedule: string;
  label: string;
  session_date: string;
};

type ProductRow = {
  id: string;
  name: string;
  mode: string;
  category: string;
  price: number;
  discounted_price: number;
  is_active: boolean;
  batches: ProductBatch[];
  session_dates: ProductSessionDate[];
};

export function ProductsPage() {
  const { user } = useAuth();
  const { data, setData, refresh } = useApi<{ products: ProductRow[] }>("/api/products", { products: [] });
  const role = normalizeRole(user?.role);
  const canEditProducts = role === "ADMIN" || role === "SUPER_ADMIN";
  const [notice, setNotice] = useState("");
  const [savingProductId, setSavingProductId] = useState("");

  async function toggleBatch(product: ProductRow, batchKey: string) {
    if (!canEditProducts) return;
    const nextBatches = product.batches.map((batch) => (
      batch.key === batchKey ? { ...batch, is_active: !batch.is_active } : batch
    ));

    setSavingProductId(product.id);
    setNotice("");

    try {
      const response = await api<{ product: ProductRow }>(`/api/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({ batches: nextBatches }),
      });
      setData((current) => ({
        ...current,
        products: current.products.map((row) => (row.id === product.id ? response.product : row)),
      }));
      setNotice(`${product.name} batches updated.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update product batches.");
    } finally {
      setSavingProductId("");
    }
  }

  function updateProductMode(productId: string, mode: string) {
    setData((current) => ({
      ...current,
      products: current.products.map((product) => (
        product.id === productId ? { ...product, mode } : product
      )),
    }));
  }

  function updateSessionDate(productId: string, sessionKey: string, sessionDate: string) {
    setData((current) => ({
      ...current,
      products: current.products.map((product) => (
        product.id === productId
          ? {
              ...product,
              session_dates: product.session_dates.map((session) => (
                session.key === sessionKey ? { ...session, session_date: sessionDate } : session
              )),
            }
          : product
      )),
    }));
  }

  async function saveProductDetails(product: ProductRow) {
    if (!canEditProducts) return;
    setSavingProductId(product.id);
    setNotice("");
    try {
      const response = await api<{ product: ProductRow }>(`/api/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          mode: product.mode,
          session_dates: product.session_dates,
        }),
      });
      setData((current) => ({
        ...current,
        products: current.products.map((row) => (row.id === product.id ? response.product : row)),
      }));
      setNotice(`${product.name} session details updated.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update product session details.");
    } finally {
      setSavingProductId("");
    }
  }

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Products"
        title="Course pricing matrix"
        description="Manage product pricing, batch availability, and product-wise session dates for language and weekday or weekend delivery."
      />

      {notice ? (
        <div className="rounded-[22px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-5 py-4 text-sm text-[var(--success)]">
          {notice}
        </div>
      ) : null}

      <SectionCard
        title="Product Catalog"
        subtitle={canEditProducts ? "Admins can toggle batches and update the session dates that appear in onboarding for each product." : "Product availability and session dates are read-only for your role."}
      >
        <div className="mb-4 flex justify-end">
          <button className="btn-secondary" type="button" onClick={refresh} disabled={Boolean(savingProductId)}>
            Refresh
          </button>
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Mode</th>
                <th>Category</th>
                <th>Price</th>
                <th>Offer Price</th>
                <th>Batches</th>
                <th>Product Sessions</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.name}</td>
                  <td>
                    {canEditProducts ? (
                      <select
                        className="input-dark min-w-[120px]"
                        value={row.mode}
                        onChange={(event) => updateProductMode(row.id, event.target.value)}
                        disabled={savingProductId === row.id}
                      >
                        <option value="ONLINE">Online</option>
                        <option value="OFFLINE">Offline</option>
                      </select>
                    ) : row.mode}
                  </td>
                  <td>{row.category}</td>
                  <td>{formatCurrency(row.price / 100)}</td>
                  <td>{formatCurrency(row.discounted_price / 100)}</td>
                  <td>
                    <div className="flex max-w-[320px] flex-wrap gap-2">
                      {row.batches.map((batch) => (
                        <button
                          key={batch.key}
                          type="button"
                          onClick={() => toggleBatch(row, batch.key)}
                          disabled={!canEditProducts || savingProductId === row.id}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            batch.is_active
                              ? "border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] text-[var(--success)]"
                              : "border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)] text-[var(--danger)]"
                          } ${canEditProducts ? "cursor-pointer" : "cursor-default"}`}
                          title={canEditProducts ? `${batch.is_active ? "Disable" : "Enable"} ${batch.label}` : batch.is_active ? "Operational" : "Non-operational"}
                        >
                          {batch.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="grid min-w-[340px] gap-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        {row.session_dates.map((session) => (
                          <label key={session.key} className="grid gap-1 text-xs text-[var(--text-secondary)]">
                            <span>{session.label}</span>
                            <input
                              className="input-dark"
                              type="date"
                              value={session.session_date || ""}
                              onChange={(event) => updateSessionDate(row.id, session.key, event.target.value)}
                              disabled={!canEditProducts || savingProductId === row.id}
                            />
                          </label>
                        ))}
                      </div>
                      {canEditProducts ? (
                        <div className="flex justify-end">
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={() => saveProductDetails(row)}
                            disabled={savingProductId === row.id}
                          >
                            {savingProductId === row.id ? "Saving..." : "Save Sessions"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>{row.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
