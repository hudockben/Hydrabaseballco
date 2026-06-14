import { getSql } from '@/lib/db';
import { round2, usd, pct } from '@/lib/finance';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

async function getFinance() {
  // Separate from prospect stats: the finance tables may not exist yet even when
  // the database is connected, so a failure here just hides the finance row.
  try {
    const sql = getSql();
    const rows = (await sql`
      select
        coalesce(sum(quantity * unit_price), 0) as revenue,
        coalesce(sum(quantity * unit_cost), 0)  as cogs,
        coalesce(sum(shipping_cost), 0)          as shipping,
        coalesce(sum(other_cost), 0)             as other,
        count(*)::int as orders
      from orders`) as { revenue: string; cogs: string; shipping: string; other: string; orders: number }[];
    const r = rows[0];
    const revenue = round2(Number(r.revenue));
    const profit = round2(revenue - Number(r.cogs) - Number(r.shipping) - Number(r.other));
    const marginPct = revenue > 0 ? round2((profit / revenue) * 100) : null;
    return { revenue, profit, marginPct, orders: r.orders };
  } catch {
    return null;
  }
}

async function getStats() {
  try {
    const sql = getSql();
    const rows = (await sql`select status, count(*)::int as n from prospects group by status`) as {
      status: string;
      n: number;
    }[];
    const total = (await sql`select count(*)::int as n from prospects`) as { n: number }[];
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = r.n;
    return { total: total[0]?.n ?? 0, byStatus, error: null as string | null };
  } catch (e) {
    return { total: 0, byStatus: {} as Record<string, number>, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export default async function Dashboard() {
  const stats = await getStats();
  const finance = stats.error ? null : await getFinance();

  return (
    <div>
      <h1 className="admin-h1">Dashboard</h1>
      {stats.error ? (
        <div className="admin-callout">
          <strong>Database not connected yet.</strong>
          <p>
            Set <code>DATABASE_URL</code> in Vercel and run <code>db/schema.sql</code> in your Neon SQL
            editor, then refresh.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat stat--total">
              <span className="stat-n">{stats.total}</span>
              <span className="stat-l">Total prospects</span>
            </div>
            {STATUSES.map((s) => (
              <div className="stat" key={s}>
                <span className="stat-n">{stats.byStatus[s] ?? 0}</span>
                <span className="stat-l">{s}</span>
              </div>
            ))}
          </div>
          {finance && finance.orders > 0 && (
            <>
              <h2 className="fin-h2 dash-sub">Financials</h2>
              <div className="stat-grid">
                <div className="stat stat--total">
                  <span className="stat-n">{usd(finance.revenue)}</span>
                  <span className="stat-l">Revenue</span>
                </div>
                <div className="stat">
                  <span className={`stat-n ${finance.profit < 0 ? 'neg' : 'pos'}`}>{usd(finance.profit)}</span>
                  <span className="stat-l">Profit</span>
                </div>
                <div className="stat">
                  <span className="stat-n">{pct(finance.marginPct)}</span>
                  <span className="stat-l">Margin</span>
                </div>
                <div className="stat">
                  <span className="stat-n">{finance.orders}</span>
                  <span className="stat-l">Orders</span>
                </div>
              </div>
            </>
          )}
          <p className="admin-hint">
            Use <strong>Find Prospects</strong> to pull in new leads, work your pipeline in{' '}
            <strong>CRM</strong>, set <strong>Pricing</strong>, and log sales under <strong>Revenue</strong>.
          </p>
        </>
      )}
    </div>
  );
}
