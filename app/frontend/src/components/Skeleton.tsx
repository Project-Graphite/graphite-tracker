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

function PosterCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col">
      <Skeleton className="aspect-[2/3] rounded-lg" />
      <Skeleton className="mt-3 h-3.5 w-4/5" />
      <Skeleton className="mt-1.5 h-3.5 w-3/5" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <Skeleton className="mt-3 h-9 rounded-lg" />
    </div>
  );
}

export function PosterGridSkeleton({
  count = 10,
  label = 'Loading titles',
}: {
  count?: number;
  label?: string;
}) {
  return (
    <Placeholder className={posterGridClass} label={label}>
      {Array.from({ length: count }, (_, index) => (
        <PosterCardSkeleton key={index} />
      ))}
    </Placeholder>
  );
}

export function PosterRowSkeleton({ label = 'Loading titles' }: { label?: string }) {
  return (
    <Placeholder className="catalog-row" label={label}>
      {Array.from({ length: 6 }, (_, index) => (
        <PosterCardSkeleton key={index} />
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

export function PageSkeleton({ label = 'Loading page' }: { label?: string }) {
  return (
    <Placeholder label={label}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-4 h-9 w-2/3 max-w-lg" />
      <div aria-hidden="true" className="mt-6 grid max-w-2xl gap-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </Placeholder>
  );
}

export function TitleSkeleton() {
  return (
    <Placeholder label="Loading title">
      <Skeleton className="h-3.5 w-32" />
      <div aria-hidden="true" className="mt-8 grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-6 md:grid-cols-[14rem_1fr] md:gap-x-8">
        <Skeleton className="aspect-[2/3] rounded-lg" />
        <div className="min-w-0">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-9 w-3/4 max-w-xl" />
          <Skeleton className="mt-6 h-14 w-full max-w-xl" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="col-span-2 h-36 rounded-xl md:col-span-1" />
        <div className="col-span-2 grid gap-2.5 md:col-span-1">
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
