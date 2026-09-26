import { CatalogCandidate } from './source.types';

const lgbtqTerm =
  /(?:^|[^a-z])(lgbt\w*\+?|(?<!enola )gay|lesbian\w*|queer|transgender|trans (?:man|men|woman|women|masc|lesbian)|bisexual\w*|homosexual\w*|same[- ]sex|sapphic|non-?binary|two-spirit|drag queens?|yaoi|bara|bxb|gxg|shounen[- ]ai|shoujo[- ]ai|boys?'? ?love|girls'? ?love|bl|gl)(?![a-z])|^yuri$/i;
const lgbtqTitle =
  /(?:^|[^a-z])(queer|lgbtq?\+?|yaoi|shounen[- ]ai|shoujo[- ]ai|boys'? ?love|girls'? ?love)(?![a-z])/i;

export function looksLgbtq(tags: string[]) {
  return tags.some((tag) => lgbtqTerm.test(tag.trim()));
}

export function isLgbtq(item: CatalogCandidate) {
  return (
    item.lgbtq === true ||
    [item.title, item.originalTitle, ...(item.alternateTitles ?? [])].some((title) =>
      lgbtqTitle.test(title),
    )
  );
}
