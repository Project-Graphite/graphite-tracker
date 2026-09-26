import { useState } from 'react';
import { useNavigate } from 'react-router';
import { apiRequest, errorMessage } from './api';
import { titleHref, type CatalogCategory } from './catalog';

export function sourceLink(value: string) {
  const candidate = /^https?:\/\//i.test(value)
    ? value
    : /^(www\.)?[\w-]+(\.[\w-]+)+\/\S+$/i.test(value)
      ? `https://${value}`
      : null;
  if (!candidate || /\s/.test(candidate)) return null;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

export function useCatalogSearch() {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  async function submit(query: string, searchHref: (query: string) => string) {
    setError('');
    const link = sourceLink(query);
    if (!link) {
      navigate(searchHref(query));
      return;
    }
    setOpening(true);
    try {
      navigate(
        titleHref(
          await apiRequest<{ category: CatalogCategory; externalId: string; source: string }>(
            `/catalog/recognize?url=${encodeURIComponent(link)}`,
          ),
        ),
      );
    } catch (reason) {
      setError(errorMessage(reason, 'This link is not from a supported source'));
    } finally {
      setOpening(false);
    }
  }

  return { error, opening, submit };
}
