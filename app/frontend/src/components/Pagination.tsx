import { Link } from 'react-router';

interface PaginationProps {
  page: number;
  totalPages: number;
  pageHref(page: number): string;
}

export function Pagination({ page, totalPages, pageHref }: PaginationProps) {
  const lastPage = Math.min(totalPages, 500);
  if (lastPage <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-5">
      {page > 1 ? (
        <Link className="secondary-button inline-flex" rel="prev" to={pageHref(page - 1)}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className="secondary-button inline-flex opacity-50">
          Previous
        </span>
      )}
      <span className="mono-sm text-faint">
        Page {page.toLocaleString()} of {lastPage.toLocaleString()}
      </span>
      {page < lastPage ? (
        <Link className="secondary-button inline-flex" rel="next" to={pageHref(page + 1)}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className="secondary-button inline-flex opacity-50">
          Next
        </span>
      )}
    </nav>
  );
}
