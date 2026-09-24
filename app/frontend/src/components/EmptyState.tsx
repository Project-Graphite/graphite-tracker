import type { ReactNode } from 'react';

export function EmptyState({
  children,
  title,
}: {
  children?: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center">
      <h3 className="m-0 text-xl font-medium">{title}</h3>
      {children}
    </div>
  );
}
