import { PageHeader, SectionCard } from "../components/UI";
import { useApi } from "../lib/api";
import { formatCurrency } from "../lib/format";

export function ProductsPage() {
  const { data } = useApi<any>("/api/products", { products: [] });

  return (
    <div className="page-grid">
      <PageHeader eyebrow="Products" title="Course pricing matrix" description="Manage the 12 LLW products across online and offline delivery, with offer price set to base price minus Rs. 1." />
      <SectionCard title="Product Catalog">
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
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((row: any, index: number) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.name}</td>
                  <td>{row.mode}</td>
                  <td>{row.category}</td>
                  <td>{formatCurrency(row.price / 100)}</td>
                  <td>{formatCurrency(row.discounted_price / 100)}</td>
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
