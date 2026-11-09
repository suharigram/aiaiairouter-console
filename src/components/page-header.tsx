export function PageHeader({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-start">
    <div><div className="flex items-center gap-3"><span className="h-3 w-1 bg-teal-700" /><h1 className="text-xl font-medium tracking-[-0.04em] text-stone-950 sm:text-2xl">{title}</h1></div><p className="mt-2 max-w-2xl pl-4 text-xs leading-6 text-stone-500">{description}</p></div>
    {children && <div className="shrink-0">{children}</div>}
  </div>;
}
