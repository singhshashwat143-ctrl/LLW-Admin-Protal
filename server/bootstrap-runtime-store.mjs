import { createDashboardStore } from "./data-store.mjs";

const store = await createDashboardStore();
await store.flush();

console.log(
  JSON.stringify(
    {
      ok: true,
      persistence: store.getPersistenceStatus(),
      counts: {
        students: store.data.students.length,
        orders: store.data.orders.length,
        payments: store.data.payment_records.length,
        due_promises: store.data.due_promises.length,
        webinars: store.data.webinars.length,
      },
    },
    null,
    2,
  ),
);

await store.close();
