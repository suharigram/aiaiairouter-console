export function EmptyState({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-sm border border-dashed border-stone-300 bg-stone-100 p-8 text-center">
    <h3 className="font-medium text-stone-900">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-stone-500">{description}</p>
    {children && <div className="mt-5">{children}</div>}
  </div>;
}
