import Alert from '@mui/material/Alert';
import FormLabel from '@mui/material/FormLabel';
import MuiLink from '@mui/material/Link';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  errorMessage,
  ListSkeleton,
  PageSkeleton,
  Pagination,
  Radio,
} from '@project-graphite/ui';
import type { Page } from '../api';
import { useAdultBlur } from '../adultContent';
import { useAuth } from '../auth';
import { categoryLabels } from '../catalog';
import { Poster } from '../components/Poster';
import {
  importApps,
  importStateLabels,
  type ConflictPolicy,
  type ImportCandidate,
  type ImportDetail,
  type ImportMatch,
} from '../imports';
import { progressSummary, stateLabel } from '../library';
import { useResource } from '../useResource';

const tabs: Array<{ match: ImportMatch | 'conflict'; label: string }> = [
  { match: 'suggested', label: 'Suggested' },
  { match: 'exact', label: 'Exact' },
  { match: 'conflict', label: 'Already in library' },
  { match: 'unmatched', label: 'Unmatched' },
  { match: 'duplicate', label: 'Duplicates' },
  { match: 'unsupported', label: 'Unsupported' },
];

const issues: Record<NonNullable<ImportCandidate['issue']>, string> = {
  no_title: 'The backup entry has no title.',
  no_connector: 'No source is configured for this kind of title.',
  lookup_failed: 'The source could not be reached while matching.',
};

const outcomes: Record<string, string> = {
  added: 'Added',
  updated: 'Progress updated',
  kept: 'Already in library',
  duplicate: 'Duplicate',
  skipped: 'Skipped',
};

function CandidateRow({
  batchState,
  candidate,
  onDecide,
}: {
  batchState: ImportDetail['state'];
  candidate: ImportCandidate;
  onDecide: (decision: 'accept' | 'skip', choice?: number) => void;
}) {
  const reviewable =
    batchState === 'ready' && (candidate.match === 'exact' || candidate.match === 'suggested');
  const blur = useAdultBlur();
  const chosen = candidate.choice === null ? undefined : candidate.options[candidate.choice];
  const unit = candidate.kind === 'manga' ? 'Ch.' : 'Ep.';
  return (
    <li className="grid list-none gap-4 border-b border-line-soft py-5 sm:grid-cols-[4rem_1fr]">
      <Poster
        blurred={blur(chosen?.adult)}
        className="hidden sm:block"
        posterUrl={chosen?.posterUrl ?? null}
        title={chosen?.title ?? candidate.title}
      />
      <div className="min-w-0">
        <p className="mono-sm m-0 text-faint">
          {[
            candidate.sourceName ?? 'Unknown source',
            candidate.progress !== null && `${unit} ${candidate.progress}`,
            stateLabel(candidate.kind, candidate.state),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <h3 className="mt-1 mb-0 text-base font-medium">{candidate.title}</h3>
        {candidate.issue && <p className="mt-1 mb-0 text-sm text-muted">{issues[candidate.issue]}</p>}
        {candidate.options.length > 0 && (
          <fieldset className="m-0 mt-3 grid gap-2 border-0 p-0">
            <legend className="sr-only">Matching title for {candidate.title}</legend>
            {candidate.options.map((option, index) => (
              <label className="flex items-center gap-3 text-sm" key={`${option.source}:${option.externalId}`}>
                <Radio
                  checked={candidate.choice === index}
                  disabled={!reviewable}
                  name={`choice-${candidate.id}`}
                  onChange={() => onDecide('accept', index)}
                />
                <span className="min-w-0">
                  <span className="text-ink">{option.title}</span>{' '}
                  <span className="mono-sm text-faint">
                    {[categoryLabels[option.category], option.releaseDate?.slice(0, 4), `${Math.round(option.score * 100)}% match`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {candidate.existing && (
          <p className="mt-3 mb-0 text-sm text-muted">
            In your library:{' '}
            {[stateLabel(candidate.existing.item.category, candidate.existing.state), progressSummary(candidate.existing.progress)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {reviewable && (
            <>
              <Button
                aria-pressed={candidate.decision === 'accept'}
                className={candidate.decision === 'accept' ? 'border-ink' : undefined}
                onClick={() => onDecide('accept')}
                size="small"
              >
                Import
              </Button>
              <Button
                aria-pressed={candidate.decision === 'skip'}
                className={candidate.decision === 'skip' ? 'border-ink' : undefined}
                onClick={() => onDecide('skip')}
                size="small"
              >
                Skip
              </Button>
            </>
          )}
          {candidate.outcome && <span className="mono-sm text-faint">{outcomes[candidate.outcome]}</span>}
        </div>
      </div>
    </li>
  );
}

export function ImportBatchPage() {
  const { id = '' } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [policy, setPolicy] = useState<ConflictPolicy>('add_missing');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const batch = useResource<ImportDetail>(`/imports/${id}`, true);
  const state = batch.data?.state;
  const working = state === 'parsing' || state === 'matching' || state === 'applying';
  const match =
    (searchParams.get('match') as ImportMatch | 'conflict' | null) ??
    tabs.find((tab) => tab.match !== 'conflict' && batch.data?.matches[tab.match])?.match ??
    'suggested';
  const page = Number(searchParams.get('page')) || 1;
  const candidates = useResource<Page<ImportCandidate>>(
    state === 'ready' || state === 'applied' ? `/imports/${id}/candidates?match=${match}&page=${page}` : null,
    true,
  );
  const { reload } = batch;
  const reloadCandidates = candidates.reload;

  useEffect(() => {
    if (!working) return;
    const timer = window.setInterval(reload, 2_000);
    return () => window.clearInterval(timer);
  }, [reload, working]);

  useEffect(() => {
    if (state === 'applied') reloadCandidates();
  }, [reloadCandidates, state]);

  async function send(path: string, init: RequestInit, fallback: string) {
    setBusy(true);
    setError('');
    try {
      const next = await auth.request<ImportDetail>(path, init);
      batch.mutate(() => next);
      reloadCandidates();
    } catch (reason) {
      setError(errorMessage(reason, fallback));
    } finally {
      setBusy(false);
    }
  }


  if (batch.error) return <Alert severity="error">{batch.error}</Alert>;
  if (!batch.data) {
    return (
      <PageSkeleton label="Loading import">
        <ListSkeleton rows={5} />
      </PageSkeleton>
    );
  }
  const detail = batch.data;
  const total = Object.values(detail.matches).reduce((sum, count) => sum + (count ?? 0), 0);
  const pending = detail.matches.pending ?? 0;

  return (
    <div className="page-enter">
      <MuiLink className="mono-sm" component={Link} to="/import" underline="always">
        All imports
      </MuiLink>
      <p className="eyebrow mt-8">
        {detail.sourceApp ? `${importApps[detail.sourceApp]} backup` : 'Backup'} ·{' '}
        {importStateLabels[detail.state].toLowerCase()}
      </p>
      <h1 className="page-title">Review import</h1>
      {detail.previouslyAppliedAt && (
        <Alert className="mt-6 max-w-3xl" severity="info">
          You applied this same backup on {new Date(detail.previouslyAppliedAt).toLocaleString()}.
          Titles already in your library are left as they are unless you keep the greater progress.
        </Alert>
      )}
      {(error || detail.error) && <Alert className="mt-6 max-w-3xl" severity="error">{error || detail.error}</Alert>}
      {detail.state === 'parsing' && <p className="mt-8 text-muted">Reading the backup…</p>}
      {detail.state === 'matching' && (
        <p className="mt-8 text-muted">
          Matching titles against the catalogue: {(total - pending).toLocaleString()} of{' '}
          {total.toLocaleString()} done. You can leave this page and come back.
        </p>
      )}
      {detail.state === 'applying' && <p className="mt-8 text-muted">Applying the import…</p>}
      {detail.state === 'applied' && (
        <section className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          {Object.entries(outcomes).map(([key, label]) => (
            <p className="m-0" key={key}>
              <strong className="text-2xl font-medium">
                {(detail.outcomes[key as keyof ImportDetail['outcomes']] ?? 0).toLocaleString()}
              </strong>{' '}
              <span className="mono-sm text-faint">{label.toLowerCase()}</span>
            </p>
          ))}
          <Button href="/library" variant="primary">
            Open library
          </Button>
        </section>
      )}
      {detail.state === 'ready' && (
        <section className="mt-8 grid max-w-3xl gap-5 rounded-xl border border-line bg-surface p-5">
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <FormLabel className="mb-2" component="legend">When a title is already in your library</FormLabel>
            {(
              [
                ['add_missing', 'Leave it unchanged and only add missing titles'],
                ['keep_greater_progress', 'Raise its progress when the backup is further along'],
              ] as const
            ).map(([value, label]) => (
              <Radio
                checked={policy === value}
                className="text-sm text-muted"
                key={value}
                label={label}
                name="policy"
                onChange={() => setPolicy(value)}
              />
            ))}
            <p className="mono-sm m-0 mt-1 text-faint">
              Completed and dropped titles, ratings, reviews and notification settings are never changed.
            </p>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={busy || detail.undecided > 0}
              onClick={() =>
                void send(
                  `/imports/${id}/apply`,
                  { method: 'POST', body: JSON.stringify({ conflictPolicy: policy }) },
                  'Could not apply the import',
                )
              }
              variant="primary"
            >
              Apply import
            </Button>
            {detail.undecided > 0 && (
              <>
                <span className="text-sm text-muted">
                  {detail.undecided.toLocaleString()} suggested{' '}
                  {detail.undecided === 1 ? 'match needs' : 'matches need'} a decision.
                </span>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void send(`/imports/${id}/accept-suggestions`, { method: 'POST' }, 'Could not accept suggestions')
                  }
                  size="small"
                >
                  Import all top suggestions
                </Button>
              </>
            )}
          </div>
        </section>
      )}
      {(detail.state === 'ready' || detail.state === 'applied') && (
        <>
          <ToggleButtonGroup
            aria-label="Import entries"
            className="scroll-x mt-10"
            exclusive
            onChange={(_, next: ImportMatch | 'conflict' | null) => next && setSearchParams({ match: next })}
            size="small"
            value={match}
          >
            {tabs.filter((tab) => tab.match !== 'conflict' || detail.state === 'ready').map((tab) => (
              <ToggleButton key={tab.match} value={tab.match}>
                {tab.label}{' '}
                <span className="mono-sm text-faint">
                  {tab.match === 'conflict' ? detail.conflicts : (detail.matches[tab.match] ?? 0)}
                </span>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {candidates.loading && <ListSkeleton label="Loading entries" />}
          {candidates.error && <Alert className="mt-6" severity="error">{candidates.error}</Alert>}
          {candidates.data &&
            (candidates.data.results.length === 0 ? (
              <div className="mt-6">
                <EmptyState title="Nothing here" />
              </div>
            ) : (
              <div className="fade-in">
                <ul className="m-0 p-0">
                  {candidates.data.results.map((candidate) => (
                    <CandidateRow
                      batchState={detail.state}
                      candidate={candidate}
                      key={candidate.id}
                      onDecide={(decision, choice) =>
                        void send(
                          `/imports/${id}/candidates/${candidate.id}`,
                          { method: 'PATCH', body: JSON.stringify({ decision, choice }) },
                          'Could not save this decision',
                        )
                      }
                    />
                  ))}
                </ul>
                <Pagination
                  maxPages={500}
                  page={candidates.data.page}
                  pageHref={(next) => `/import/${id}?match=${match}&page=${next}`}
                  totalPages={candidates.data.totalPages}
                />
              </div>
            ))}
        </>
      )}
      {!working && (
        <Button className="mt-10" onClick={() => setDeleting(true)} size="small" variant="text">
          Delete this import review
        </Button>
      )}
      {deleting && (
        <ConfirmDialog
          confirmLabel="Delete"
          eyebrow="Library import"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await auth.request(`/imports/${id}`, { method: 'DELETE' });
            navigate('/import');
          }}
          title="Delete this import review?"
        >
          <p className="m-0">Your library is not changed. You can upload the backup again later.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
