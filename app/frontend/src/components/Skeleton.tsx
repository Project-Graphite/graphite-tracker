import type { ReactNode } from 'react';
import { posterGridClass } from './Poster';

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} />;
}

export function Placeholder({
  children,
  className = '',
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div aria-busy="true" aria-label={label} className={className} role="status">
      {children}
    </div>
  );
}

export const actionSkeletonClass = 'h-[2.375rem] rounded-lg';

function PosterCardSkeleton({ action }: { action: boolean }) {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col">
      <Skeleton className="aspect-[2/3] rounded-lg" />
      <Skeleton className="mt-3 h-3.5 w-4/5" />
      <Skeleton className="mt-1.5 h-3.5 w-3/5" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      {action && <Skeleton className={`mt-3 ${actionSkeletonClass}`} />}
    </div>
  );
}

export function PosterGridSkeleton({
  action = true,
  count = 10,
  label = 'Loading titles',
}: {
  action?: boolean;
  count?: number;
  label?: string;
}) {
  return (
    <Placeholder className={posterGridClass} label={label}>
      {Array.from({ length: count }, (_, index) => (
        <PosterCardSkeleton action={action} key={index} />
      ))}
    </Placeholder>
  );
}

export function PosterRowSkeleton({ label = 'Loading titles' }: { label?: string }) {
  return (
    <Placeholder className="catalog-row" label={label}>
      {Array.from({ length: 6 }, (_, index) => (
        <PosterCardSkeleton action key={index} />
      ))}
    </Placeholder>
  );
}

export function ListSkeleton({
  label = 'Loading',
  rows = 5,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <Placeholder label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div aria-hidden="true" className="border-b border-line-soft py-4" key={index}>
          <Skeleton className="h-4 w-1/2 max-w-xs" />
          <Skeleton className="mt-2 h-3 w-1/4 max-w-32" />
        </div>
      ))}
    </Placeholder>
  );
}

export function LinesSkeleton({
  className = '',
  label = 'Loading',
  lines = 3,
}: {
  className?: string;
  label?: string;
  lines?: number;
}) {
  return (
    <Placeholder className={`grid gap-2.5 ${className}`} label={label}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          className={`h-3.5 ${index === lines - 1 ? 'w-2/5' : index % 2 ? 'w-5/6' : 'w-full'}`}
          key={index}
        />
      ))}
    </Placeholder>
  );
}

export function FormSkeleton({
  fields = 3,
  label = 'Loading settings',
}: {
  fields?: number;
  label?: string;
}) {
  return (
    <Placeholder className="grid max-w-3xl gap-6" label={label}>
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: fields }, (_, index) => (
        <div aria-hidden="true" className="grid gap-2" key={index}>
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-12 w-36 rounded-lg" />
    </Placeholder>
  );
}

export function PageSkeleton({
  children,
  label = 'Loading page',
}: {
  children?: ReactNode;
  label?: string;
}) {
  return (
    <Placeholder label={label}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-4 h-9 w-2/3 max-w-lg" />
      <div aria-hidden="true" className="mt-8">
        {children ?? (
          <div className="grid max-w-2xl gap-2.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>
        )}
      </div>
    </Placeholder>
  );
}

export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex gap-6 border-b border-line pb-3">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton className="h-4 w-16" key={index} />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <PageSkeleton label="Loading profile">
      <div className="grid max-w-2xl gap-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-y border-line py-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="h-7 w-24" key={index} />
        ))}
      </div>
      <div className="mt-10">
        <TabsSkeleton />
      </div>
      <div className="mt-6">
        <ListSkeleton rows={4} />
      </div>
    </PageSkeleton>
  );
}

export function FormPanelSkeleton({ fields = 2, label }: { fields?: number; label: string }) {
  return (
    <div className="form-panel">
      <Placeholder className="grid gap-5" label={label}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-1/2" />
        {Array.from({ length: fields }, (_, index) => (
          <div aria-hidden="true" className="grid gap-2" key={index}>
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-12 rounded-lg" />
      </Placeholder>
    </div>
  );
}

export function TitleSkeleton({ backdrop }: { backdrop: boolean }) {
  return (
    <Placeholder label="Loading title">
      <Skeleton className="h-3.5 w-32" />
      {backdrop && (
        <Skeleton className="mt-5 aspect-[16/9] rounded-2xl sm:mt-6 md:aspect-[16/6]" />
      )}
      <div
        aria-hidden="true"
        className="mt-6 grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-6 sm:mt-8 md:grid-cols-[14rem_1fr] md:gap-x-8"
      >
        <Skeleton className="col-start-1 row-start-1 aspect-[2/3] rounded-lg md:row-span-2" />
        <div className="col-start-2 row-start-1 min-w-0 self-end md:self-start">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-9 w-3/4 max-w-xl" />
        </div>
        <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2">
          <Skeleton className="h-5 w-2/3 max-w-md" />
          <Skeleton className="mt-6 h-16 w-full" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="col-span-2 row-start-3 h-36 rounded-xl md:col-span-1 md:col-start-1" />
        <div className="col-span-2 row-start-4 grid gap-2.5 md:col-span-1 md:col-start-2 md:row-start-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      </div>
    </Placeholder>
  );
}
