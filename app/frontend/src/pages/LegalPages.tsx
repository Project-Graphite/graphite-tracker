import type { ReactNode } from 'react';
import { Link } from 'react-router';

const repository = 'https://github.com/Project-Graphite/graphite-tracker';

function LegalPage({ children, title }: { children: ReactNode; title: string }) {
  return (
    <article className="page-enter max-w-3xl">
      <p className="eyebrow">Graphite Tracker</p>
      <h1 className="page-title">{title}</h1>
      <div className="mt-8 grid gap-8 text-muted [&_h2]:m-0 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-ink [&_p]:m-0 [&_section]:grid [&_section]:gap-3">
        {children}
      </div>
    </article>
  );
}

function External({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="rule-link" href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <section>
        <h2>What is stored</h2>
        <p>
          Your email address, handle, display name, optional bio and a salted hash of your password;
          the titles in your library with their list, progress, platforms, source preferences and
          notification choices; your ratings, reviews and reports; and a record of library and
          review activity. Each signed-in device holds a sign-in cookie that scripts cannot read;
          the server keeps only a hash of it, and it stops working after 30 days.
        </p>
        <p>
          A Mihon or AniYomi backup is read once and discarded. Only the titles, progress and
          tracker status found in it are kept, for seven days, so you can review the import.
        </p>
      </section>
      <section>
        <h2>What is public</h2>
        <p>
          Nothing, until you choose. Profiles start private and show only your display name. You
          decide in <Link className="rule-link" to="/settings">settings</Link> whether your profile
          and each of its sections are public, and every change applies to earlier activity too.
          A review you mark as public appears on its title with your display name and a link to
          your profile.
        </p>
      </section>
      <section>
        <h2>Other services</h2>
        <p>
          The server looks titles up at TMDB, MangaDex, IGDB and RAWG without sending anything about
          you. Posters and artwork load straight from those services, so they see your browser's
          request like any other image on the web. There are no ads, analytics or tracking cookies.
        </p>
      </section>
      <section>
        <h2>Moderation</h2>
        <p>
          The administrator can see public reviews, reports and account names, handles and email
          addresses to deal with abuse. Private reviews and private profile sections are not shown
          in the moderation tools.
        </p>
      </section>
      <section>
        <h2>Your control</h2>
        <p>
          You can edit or remove any library entry, rating or review at any time. To have your
          account deleted, ask through the <External href={`${repository}/issues`}>issue tracker</External>{' '}
          with your handle only; never post your email address or other personal details there.
        </p>
      </section>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms">
      <section>
        <h2>The service</h2>
        <p>
          Graphite Tracker is a free, non-commercial project provided as it is, without warranty.
          Features may change and the service may be unavailable at times.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>
          Use your own email address, keep your password to yourself, and keep one account per
          person. You are responsible for what is posted from your account.
        </p>
      </section>
      <section>
        <h2>Reviews</h2>
        <p>
          Write your own words. Do not post harassment, hate, spam, personal information about
          others or anything illegal, and mark reviews that reveal plot points as containing
          spoilers. The administrator may hide reviews and deactivate accounts that break these
          rules.
        </p>
      </section>
      <section>
        <h2>Catalogue data</h2>
        <p>
          Titles, descriptions, artwork and ratings belong to their sources and are shown under their
          terms, listed in the <Link className="rule-link" to="/credits">credits</Link>. Graphite
          Tracker does not host, stream or link to copies of films, shows, comics or games.
        </p>
      </section>
      <section>
        <h2>Source code</h2>
        <p>
          The application is open source under the{' '}
          <External href={`${repository}/blob/main/LICENSE`}>MIT licence</External>.
        </p>
      </section>
    </LegalPage>
  );
}

export function CreditsPage() {
  return (
    <LegalPage title="Credits">
      <section>
        <h2>The Movie Database</h2>
        <a className="w-fit" href="https://www.themoviedb.org/" rel="noreferrer" target="_blank">
          <img alt="The Movie Database (TMDB)" className="h-5" src="/tmdb.svg" />
        </a>
        <p>
          Movie, TV and anime data and artwork come from TMDB. This product uses the TMDB API but is
          not endorsed or certified by TMDB.
        </p>
      </section>
      <section>
        <h2>MangaDex</h2>
        <p>
          Manga and manhwa data and covers are provided by{' '}
          <External href="https://mangadex.org/">MangaDex</External>. Graphite Tracker is not
          affiliated with MangaDex. It links to MangaDex titles and never hosts chapters or offers a
          reader.
        </p>
      </section>
      <section>
        <h2>IGDB and Twitch</h2>
        <p>
          Game data is provided by <External href="https://www.igdb.com/">IGDB</External>, accessed
          through the Twitch developer API under the Twitch Developer Services Agreement. IGDB and
          Twitch do not endorse Graphite Tracker.
        </p>
      </section>
      <section>
        <h2>RAWG</h2>
        <p>
          When this server uses RAWG for games, game data is provided by{' '}
          <External href="https://rawg.io/">RAWG</External>.
        </p>
      </section>
      <section>
        <h2>Non-commercial use</h2>
        <p>
          Graphite Tracker is free, shows no ads and sells nothing, which keeps it within the
          non-commercial terms of these sources.
        </p>
      </section>
    </LegalPage>
  );
}
