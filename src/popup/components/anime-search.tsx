import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ANIME_SEARCH_MAX_LENGTH,
  ANIME_SEARCH_PAGE_SIZE,
  requestAnimeSearch,
} from '../../api/anime-search-messages';
import { formatAnimeTagQuery, parseAnimeSearchQuery } from '../../api/anime-search-query';
import type { Anime } from '../../domain/anime';
import type { AppCopy } from '../../locales';
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_FORMAT_FILTERS,
  searchFormatTypes,
  toggleSearchFormat,
} from '../search-state';
import {
  DEFAULT_SEARCH_SORT,
  SEARCH_SORT_OPTIONS,
  flipSearchSortDirection,
  searchSortLabel,
  sortAnimeResults,
  toggleSearchSort,
  type SearchSort,
  type SearchSortKey,
} from '../search-sort';
import { applyTagSuggestion, searchTagSuggestions } from '../tag-suggestions';
import type { AnimeCardData } from './anime';
import { Button, EmptyState, ErrorState, Icon, Skeleton } from './ui';

const SEARCH_SKELETON_ROWS = 4;

const SEARCH_AUTOFILL_MAX_PAGES = 3;

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SearchState {
  readonly status: SearchStatus;
  readonly results: readonly Anime[];
  readonly query: string;
  readonly nextOffset: number;
  readonly hasMore: boolean;
  readonly errorMessage: string | null;
}

const IDLE: SearchState = {
  status: 'idle',
  results: [],
  query: '',
  nextOffset: 0,
  hasMore: false,
  errorMessage: null,
};

export function AnimeSearchField({
  query,
  onQueryChange,
  copy,
}: {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly copy: AppCopy;
}) {
  const listboxId = `${useId()}-listbox`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const suggestions = useMemo(() => searchTagSuggestions(query), [query]);
  const isOpen = suggestions.length > 0 && dismissedQuery !== query;
  const selectedIndex =
    suggestions.length === 0 ? -1 : Math.min(activeIndex, suggestions.length - 1);

  const accept = useCallback(
    (index: number) => {
      const suggestion = suggestions[index];
      if (suggestion === undefined) return;
      onQueryChange(applyTagSuggestion(query, suggestion.name));
      setActiveIndex(-1);
    },
    [onQueryChange, query, suggestions],
  );

  return (
    <div className="anime-search-field" ref={fieldRef}>
      <Icon name="search" size={14} />

      <input
        type="search"
        className="anime-search-input"
        value={query}
        placeholder={copy.searchPlaceholder}
        aria-label={copy.searchFieldLabel}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && selectedIndex >= 0 ? `${listboxId}-option-${selectedIndex}` : undefined
        }
        maxLength={ANIME_SEARCH_MAX_LENGTH}
        autoComplete="off"
        spellCheck={false}
        onBlur={(event) => {
          if (!fieldRef.current?.contains(event.relatedTarget as Node | null)) {
            setDismissedQuery(query);
          }
        }}
        onChange={(event) => {
          setActiveIndex(-1);
          onQueryChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!isOpen) return;
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((current) => {
              if (current < 0) return step === 1 ? 0 : suggestions.length - 1;
              return (current + step + suggestions.length) % suggestions.length;
            });
            return;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            if (!isOpen || selectedIndex < 0) return;
            event.preventDefault();
            accept(selectedIndex);
            return;
          }
          if (event.key === 'Escape') {
            if (isOpen) {
              event.preventDefault();
              setDismissedQuery(query);
              return;
            }
            onQueryChange('');
          }
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

      {isOpen && suggestions.length > 0 && (
        <ul
          className="anime-search-suggestions"
          id={listboxId}
          role="listbox"
          aria-label={copy.searchTagSuggestions}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.kind}-${suggestion.name}`}
              id={`${listboxId}-option-${index}`}
              className="anime-search-suggestion"
              role="option"
              aria-selected={index === selectedIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                accept(index);
              }}
            >
              <span>{`#${suggestion.name}`}</span>
              <span className="anime-search-suggestion-kind">
                {suggestion.kind === 'genre' ? copy.genre : copy.theme}
              </span>
            </li>
          ))}
        </ul>
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

function AnimeSearchFormatFilter({
  keys,
  onToggle,
  copy,
}: {
  readonly keys: readonly string[];
  readonly onToggle: (key: string) => void;
  readonly copy: AppCopy;
}) {
  return (
    <div className="anime-search-formats" role="group" aria-label={copy.searchFormatFilterLabel}>
      {SEARCH_FORMAT_FILTERS.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className="anime-search-format"
          aria-pressed={keys.includes(filter.key)}
          onClick={() => onToggle(filter.key)}
        >
          {filter.label(copy)}
        </button>
      ))}
    </div>
  );
}

function AnimeSearchSort({
  sort,
  onToggleKey,
  onFlipDirection,
  copy,
}: {
  readonly sort: SearchSort;
  readonly onToggleKey: (key: SearchSortKey) => void;
  readonly onFlipDirection: () => void;
  readonly copy: AppCopy;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const isAscending = sort.direction === 'asc';
  const directionLabel = isAscending ? copy.searchSortAscending : copy.searchSortDescending;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [open]);

  return (
    <div
      className="dropdown anime-search-sort"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        className="dropdown-trigger anime-search-sort-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="sr-only">{copy.searchSortLabel}</span>
        {searchSortLabel(sort.key, copy)}
        <Icon name="chevron-down" size={14} />
      </button>

      <button
        className="anime-search-sort-direction"
        type="button"
        aria-label={`${directionLabel}: ${searchSortLabel(sort.key, copy)}`}
        title={directionLabel}
        disabled={sort.key === 'relevance'}
        onClick={onFlipDirection}
      >
        <Icon name={isAscending ? 'arrow-up' : 'arrow-down'} size={13} />
      </button>

      {open && (
        <div className="dropdown-menu anime-search-sort-menu" role="menu">
          {SEARCH_SORT_OPTIONS.map((option) => (
            <button
              className={`dropdown-option${option.key === sort.key ? ' is-selected' : ''}`}
              key={option.key}
              type="button"
              role="menuitemradio"
              aria-checked={option.key === sort.key}
              onClick={() => {
                onToggleKey(option.key);
                setOpen(false);
              }}
            >
              {option.label(copy)}
              {option.key !== 'relevance' && (
                <Icon
                  name={option.defaultDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={13}
                  className="anime-search-sort-option-direction"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [formatKeys, setFormatKeys] = useState<readonly string[]>([]);
  const [sort, setSort] = useState<SearchSort>(DEFAULT_SEARCH_SORT);
  const sequence = useRef(0);
  const autoFillRef = useRef(0);

  const toggleFormat = useCallback((key: string) => {
    setFormatKeys((current) => toggleSearchFormat(current, key));
  }, []);

  const selectSortKey = useCallback((key: SearchSortKey) => {
    setSort((current) => toggleSearchSort(current, key));
  }, []);

  const flipSortDirection = useCallback(() => {
    setSort((current) => flipSearchSortDirection(current));
  }, []);

  const formats = useMemo(() => searchFormatTypes(formatKeys), [formatKeys]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(normalized), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalized]);

  useEffect(() => {
    const current = sequence.current + 1;
    sequence.current = current;
    autoFillRef.current = 0;

    setLoadingMore(false);
    const parsed = parseAnimeSearchQuery(debouncedQuery);
    if (!isAuthenticated || parsed === null) {
      setState(IDLE);
      return;
    }
    setState({
      status: 'loading',
      results: [],
      query: debouncedQuery,
      nextOffset: 0,
      hasMore: false,
      errorMessage: null,
    });

    void requestAnimeSearch(debouncedQuery.trim().slice(0, ANIME_SEARCH_MAX_LENGTH), 0, formats)
      .then((page) => {
        if (sequence.current !== current) return;
        setState({
          status: 'ready',
          results: page.results,
          query: debouncedQuery,
          nextOffset: page.nextOffset,
          hasMore: page.hasMore,
          errorMessage: null,
        });
      })
      .catch((error: unknown) => {
        if (sequence.current !== current) return;
        setState({
          status: 'error',
          results: [],
          query: debouncedQuery,
          nextOffset: 0,
          hasMore: false,
          errorMessage: error instanceof Error ? error.message : copy.searchFailed,
        });
      });
    return () => {
      sequence.current += 1;
    };
  }, [debouncedQuery, isAuthenticated, attempt, formats, copy.searchFailed]);

  const loadMore = useCallback(() => {
    if (loadingMore || !state.hasMore || state.status !== 'ready') return;
    const current = sequence.current;
    const query = state.query.trim().slice(0, ANIME_SEARCH_MAX_LENGTH);
    setLoadingMore(true);
    void requestAnimeSearch(query, state.nextOffset, formats)
      .then((page) => {
        if (sequence.current !== current) return;
        setState((previous) => ({
          ...previous,
          results: [...previous.results, ...page.results],
          nextOffset: page.nextOffset,

          hasMore: page.hasMore,
        }));
      })
      .catch(() => {
        if (sequence.current !== current) return;
        setState((previous) => ({ ...previous, hasMore: false }));
      })
      .finally(() => {
        if (sequence.current === current) setLoadingMore(false);
      });
  }, [loadingMore, state.hasMore, state.status, state.nextOffset, state.query, formats]);

  useEffect(() => {
    if (formats.length === 0) return;
    if (state.status !== 'ready' || !state.hasMore || loadingMore) return;
    if (state.results.length >= ANIME_SEARCH_PAGE_SIZE) return;
    if (autoFillRef.current >= SEARCH_AUTOFILL_MAX_PAGES) return;
    autoFillRef.current += 1;
    loadMore();
  }, [formats.length, state.status, state.hasMore, state.results.length, loadingMore, loadMore]);

  const isLoading = state.status === 'loading' || debouncedQuery !== normalized;

  const sortedResults = useMemo(() => sortAnimeResults(state.results, sort), [state.results, sort]);

  const parsed = parseAnimeSearchQuery(state.query === '' ? normalized : state.query);
  const headingTitle =
    parsed?.kind === 'tag'
      ? copy.searchTagResultsTitle(formatAnimeTagQuery(parsed.values))
      : copy.searchResultsTitle;

  const heading = (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{copy.searchEyebrow}</p>

        <h2 id="anime-search-title">{headingTitle}</h2>
      </div>

      {state.status === 'ready' && (
        <div className="anime-search-controls">
          <AnimeSearchSort
            sort={sort}
            onToggleKey={selectSortKey}
            onFlipDirection={flipSortDirection}
            copy={copy}
          />

          <AnimeSearchFormatFilter keys={formatKeys} onToggle={toggleFormat} copy={copy} />

          <span className="section-count">{copy.titles(state.results.length)}</span>
        </div>
      )}
    </div>
  );

  const loadMoreButton =
    state.hasMore && state.status === 'ready' ? (
      <div className="anime-search-more">
        <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? copy.searchLoadingMore : copy.searchLoadMore}
        </Button>
      </div>
    ) : null;

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
      ) : state.results.length === 0 && state.hasMore ? (
        <div className="anime-search-more-block">
          <EmptyState
            title={copy.searchResultsTitle}
            message={copy.searchNoResults(state.query === '' ? normalized : state.query)}
          />

          {loadMoreButton}
        </div>
      ) : state.results.length === 0 ? (
        <EmptyState
          title={copy.searchResultsTitle}
          message={
            formats.length > 0
              ? copy.searchFormatEmpty
              : copy.searchNoResults(state.query === '' ? normalized : state.query)
          }
        />
      ) : (
        <>
          <ul className="anime-search-results">
            {sortedResults.map((anime) => (
              <SearchResultRow
                key={`${anime.provider ?? providerName}-${anime.id}`}
                anime={anime}
                onSelect={onSelect}
                copy={copy}
              />
            ))}
          </ul>

          {loadMoreButton}
        </>
      )}
    </section>
  );
}
