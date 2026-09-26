import { isLgbtq } from './lgbtq-content';
import { CatalogPage } from './source.types';

const explicit =
  /(?:^|[^a-z0-9])(hentai|porn|porno|pornographic|nsfw|r-?18|18\+|eroge|nukige)(?![a-z0-9])/i;
const explicitTitle =
  /(?:^|[^a-z0-9])(erotic|erotica|sex sim(?:ulator)?|ecchi|lewd|smut)(?![a-z0-9])/i;
const adultTag =
  /^(adult|adults? only|adult content|erotic|erotica|hentai|nsfw|porn|pornographic|sexual content)$/i;

export function looksAdult(titles: string[], synopsis: string, tags: string[]) {
  return (
    titles.some((title) => explicit.test(title) || explicitTitle.test(title)) ||
    explicit.test(synopsis) ||
    tags.some((tag) => adultTag.test(tag.trim()))
  );
}

export function withoutHidden(page: CatalogPage, adult: boolean | undefined): CatalogPage {
  const results = page.results.filter((item) => !isLgbtq(item) && (adult || !item.adult));
  return {
    ...page,
    results,
    totalResults: results.length === page.results.length ? page.totalResults : null,
  };
}
