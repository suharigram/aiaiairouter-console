export default function DashboardLoading() {
  return <div className="animate-pulse"><div className="h-8 w-48 rounded bg-stone-200" /><div className="mt-3 h-4 w-96 max-w-full rounded bg-stone-200" /><div className="mt-8 grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-32 rounded-lg border border-stone-200 bg-stone-100" />)}</div><div className="mt-6 h-80 rounded-lg border border-stone-200 bg-stone-100" /></div>;
}
