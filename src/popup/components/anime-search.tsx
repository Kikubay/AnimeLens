import { useEffect, useRef, useState } from 'react';
import { ANIME_SEARCH_MIN_LENGTH, requestAnimeSearch } from '../../api/anime-search-messages';
import type { Anime } from '../../domain/anime';
import type { AppCopy } from '../../locales';
import { SEARCH_DEBOUNCE_MS } from '../search-state';
import type { AnimeCardData } from './anime';
import { Button, EmptyState, ErrorState, Icon, Skeleton } from './ui';

const SEARCH_SKELETON_ROWS = 4;

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SearchState {
  readonly status: SearchStatus;
  readonly results: readonly Anime[];
  readonly query: string;
  readonly errorMessage: string | null;
}

const IDLE: SearchState = { status: 'idle', results: [], query: '', errorMessage: null };

export function AnimeSearchField({
  query,
  onQueryChange,
  copy,
}: {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly copy: AppCopy;
}) {
  return (
    <div className="anime-search-field">
      <Icon name="search" size={14} />
      <input
        type="search"
        className="anime-search-input"
        value={query}
        placeholder={copy.searchPlaceholder}
        aria-label={copy.searchFieldLabel}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onQueryChange('');
        }}
      />
      {query.length > 0 && (
        <button
          className="anime-search-clear"
          type="button"
          onClick={() => onQueryChange('')}
          aria-label={copy.searchClear}
          title={copy.searchClear}
        >
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  );
}

function resultMeta(anime: Anime, copy: AppCopy): string {
  return [
    anime.type.toUpperCase(),
    anime.year === null ? null : String(anime.year),
    anime.score === null ? null : `${anime.score.toFixed(1)} / 10`,
    anime.episodeCount === null ? null : `${anime.episodeCount} ${copy.episodesShort}`,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

function toCardData(anime: Anime): AnimeCardData {
  return { ...anime };
}

function SearchResultRow({
  anime,
  onSelect,
  copy,
}: {
  readonly anime: Anime;
  readonly onSelect: (anime: AnimeCardData) => void;
  readonly copy: AppCopy;
}) {
  const imageUrl = anime.image?.medium ?? anime.image?.large;
  return (
    <li className="anime-search-result">
      <button
        className="anime-search-result-main"
        type="button"
        onClick={() => onSelect(toCardData(anime))}
        aria-label={`${copy.openDetails}: ${anime.title.default}`}
      >
        <span className="anime-search-result-cover">
          {imageUrl === null || imageUrl === undefined ? (
            <span className="anime-search-result-cover-label">{anime.title.default}</span>
          ) : (
            <img src={imageUrl} alt="" loading="lazy" decoding="async" />
          )}
        </span>
        <span className="anime-search-result-copy">
          <span className="anime-search-result-title">{anime.title.default}</span>
          <span className="anime-search-result-meta">{resultMeta(anime, copy)}</span>
        </span>
        <Icon name="arrow-right" size={14} />
      </button>
    </li>
  );
}

export function AnimeSearchPanel({
  query,
  isAuthenticated,
  providerName,
  onSelect,
  onConnect,
  copy,
}: {
  readonly query: string;
  readonly isAuthenticated: boolean;
  readonly providerName: string;
  readonly onSelect: (anime: AnimeCardData) => void;
  readonly onConnect: () => void;
  readonly copy: AppCopy;
}) {
  const normalized = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(normalized);
  const [state, setState] = useState<SearchState>(IDLE);
  const [attempt, setAttempt] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(normalized), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalized]);

  useEffect(() => {
    const current = sequence.current + 1;
    sequence.current = current;
    if (!isAuthenticated || debouncedQuery.length < ANIME_SEARCH_MIN_LENGTH) {
      setState(IDLE);
      return;
    }
    setState({ status: 'loading', results: [], query: debouncedQuery, errorMessage: null });
    void requestAnimeSearch(debouncedQuery)
      .then((results) => {
        if (sequence.current !== current) return;
        setState({ status: 'ready', results, query: debouncedQuery, errorMessage: null });
      })
      .catch((error: unknown) => {
        if (sequence.current !== current) return;
        setState({
          status: 'error',
          results: [],
          query: debouncedQuery,
          errorMessage: error instanceof Error ? error.message : copy.searchFailed,
        });
      });
    return () => {
      sequence.current += 1;
    };
  }, [debouncedQuery, isAuthenticated, attempt, copy.searchFailed]);

  const isLoading = state.status === 'loading' || debouncedQuery !== normalized;

  const heading = (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{copy.searchEyebrow}</p>
        <h2 id="anime-search-title">{copy.searchResultsTitle}</h2>
      </div>
      {state.status === 'ready' && (
        <span className="section-count">{copy.titles(state.results.length)}</span>
      )}
    </div>
  );

  return (
    <section className="anime-search-panel" aria-labelledby="anime-search-title">
      {heading}
      {!isAuthenticated ? (
        <EmptyState
          title={copy.searchFieldLabel}
          message={copy.searchAuthRequired(providerName)}
          action={
            <Button size="sm" onClick={onConnect}>
              {copy.providerConnectAction(providerName)}
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="anime-search-skeletons" aria-label={copy.searching} aria-busy="true">
          {Array.from({ length: SEARCH_SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} className="skeleton-search-row" />
          ))}
        </div>
      ) : state.status === 'error' ? (
        <ErrorState
          title={copy.searchFailed}
          message={state.errorMessage ?? copy.searchUnavailable(providerName)}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAttempt((current) => current + 1)}
            >
              {copy.retry}
            </Button>
          }
        />
      ) : state.results.length === 0 ? (
        <EmptyState
          title={copy.searchResultsTitle}
          message={copy.searchNoResults(state.query === '' ? normalized : state.query)}
        />
      ) : (
        <ul className="anime-search-results">
          {state.results.map((anime) => (
            <SearchResultRow
              key={`${anime.provider ?? providerName}-${anime.id}`}
              anime={anime}
              onSelect={onSelect}
              copy={copy}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
