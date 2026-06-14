import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

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
          <p className="admin-hint">
            Use <strong>Find Prospects</strong> to pull in new leads, or work your pipeline in{' '}
            <strong>CRM</strong>.
          </p>
        </>
      )}
    </div>
  );
}
