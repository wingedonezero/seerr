import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import useVerticalScroll from '@app/hooks/useVerticalScroll';
import { Permission, useUser } from '@app/hooks/useUser';
import {
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowUpIcon,
  Bars4Icon,
  CheckCircleIcon,
  Squares2X2Icon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import { MediaStatus } from '@server/constants/media';
import axios from 'axios';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

/**
 * Shared whole-library browser: poster grid / list views over /api/v1/grid
 * (local database only — no external APIs in the hot path). The Requests and
 * Library pages are both thin configurations of this component: they differ
 * only in which tabs (status buckets) they expose.
 *
 * Search is per-tab: each tab keeps its own query and only sifts the items
 * that tab already shows. View mode, density, sort and type filter persist
 * per page in localStorage.
 */

export interface GridSeason {
  seasonNumber: number;
  status: MediaStatus;
}

export interface GridMetadata {
  title: string;
  originalTitle: string;
  year: number | null;
  posterPath: string;
  overview: string;
  seriesStatus: string;
  seasons: { seasonNumber: number; episodeCount: number }[];
  newSeasons: number[];
  lastRefreshedAt: string | null;
}

export interface GridItem {
  id: number;
  tmdbId: number;
  tvdbId: number | null;
  mediaType: 'movie' | 'tv';
  status: MediaStatus;
  status4k: MediaStatus;
  mediaAddedAt: string | null;
  createdAt: string;
  seasons: GridSeason[];
  requestIds: number[];
  requestedSeasons: number[];
  firstRequestedAt: string | null;
  flags: string[];
  metadata: GridMetadata | null;
}

interface GridResponse {
  items: GridItem[];
  hydrated: number;
  refresh: { running: boolean; progress: number; total: number };
}

export interface GridTab {
  id: string;
  label: string;
  filter: (item: GridItem) => boolean;
}

interface MediaGridPageProps {
  pageTitle: string;
  tabs: GridTab[];
  defaultTab: string;
  /** offer multi-select + bulk request deletion (Requests page only) */
  enableBulkDelete?: boolean;
  /** localStorage key for view preferences */
  storageKey: string;
}

const PAGE_STEP = 60;
/** poster grid density steps: minimum card width in px */
const DENSITIES = [110, 146, 184];
/** statuses where a 'downloading' mark makes sense (still being acquired) */
const TOGET_LIKE = [
  MediaStatus.PENDING,
  MediaStatus.PROCESSING,
  MediaStatus.PARTIALLY_AVAILABLE,
];

const STATUS_LABELS: Record<number, { label: string; className: string }> = {
  [MediaStatus.UNKNOWN]: { label: 'Unknown', className: 'bg-gray-600' },
  [MediaStatus.PENDING]: { label: 'Requested', className: 'bg-indigo-600' },
  [MediaStatus.PROCESSING]: { label: 'Requested', className: 'bg-amber-600' },
  [MediaStatus.PARTIALLY_AVAILABLE]: {
    label: 'Partial',
    className: 'bg-orange-600',
  },
  [MediaStatus.AVAILABLE]: { label: 'In Library', className: 'bg-green-600' },
  [MediaStatus.BLOCKLISTED]: { label: 'Blocklisted', className: 'bg-red-800' },
  [MediaStatus.DELETED]: { label: 'Deleted', className: 'bg-red-600' },
};

const MediaGridPage = ({
  pageTitle,
  tabs,
  defaultTab,
  enableBulkDelete = false,
  storageKey,
}: MediaGridPageProps) => {
  const { hasPermission } = useUser();
  const [tab, setTab] = useState(defaultTab);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'added' | 'title' | 'year'>('added');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [density, setDensity] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [visible, setVisible] = useState(PAGE_STEP);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // restore / persist view preferences (per page)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      if (saved.typeFilter) setTypeFilter(saved.typeFilter);
      if (saved.sortBy) setSortBy(saved.sortBy);
      if (saved.sortDir) setSortDir(saved.sortDir);
      if (saved.view) setView(saved.view);
      if (typeof saved.density === 'number') setDensity(saved.density);
      if (saved.tab && tabs.some((t) => t.id === saved.tab)) setTab(saved.tab);
    } catch {
      // corrupted prefs are not worth surfacing
    }
    setPrefsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ typeFilter, sortBy, sortDir, view, density, tab })
    );
  }, [prefsLoaded, storageKey, typeFilter, sortBy, sortDir, view, density, tab]);

  const { data, mutate } = useSWR<GridResponse>('/api/v1/grid', {
    refreshInterval: (latest) => (latest?.refresh.running ? 3000 : 0),
  });

  const query = queries[tab] ?? '';

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tabs) c[t.id] = 0;
    for (const item of data?.items ?? []) {
      if (typeFilter !== 'all' && item.mediaType !== typeFilter) {
        continue; // tab counts answer "how many, given the current type filter"
      }
      for (const t of tabs) {
        if (t.filter(item)) c[t.id]++;
      }
    }
    return c;
  }, [data, tabs, typeFilter]);

  const items = useMemo(() => {
    const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0];
    let list = (data?.items ?? []).filter(activeTab.filter);
    if (typeFilter !== 'all') {
      list = list.filter((i) => i.mediaType === typeFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          (i.metadata?.title ?? '').toLowerCase().includes(q) ||
          (i.metadata?.originalTitle ?? '').toLowerCase().includes(q) ||
          String(i.tmdbId) === q
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'title') {
        return (
          (a.metadata?.title ?? '￿').localeCompare(b.metadata?.title ?? '￿') *
          dir
        );
      }
      if (sortBy === 'year') {
        return ((a.metadata?.year ?? 0) - (b.metadata?.year ?? 0)) * dir;
      }
      const aDate = a.firstRequestedAt ?? a.mediaAddedAt ?? a.createdAt;
      const bDate = b.firstRequestedAt ?? b.mediaAddedAt ?? b.createdAt;
      return (new Date(aDate).getTime() - new Date(bDate).getTime()) * dir;
    });
  }, [data, tabs, tab, typeFilter, query, sortBy, sortDir]);

  useVerticalScroll(
    () => setVisible((v) => v + PAGE_STEP),
    visible < items.length
  );
  const shown = items.slice(0, visible);

  const selectedRequestIds = useMemo(
    () =>
      (data?.items ?? [])
        .filter((i) => selected.has(i.id))
        .flatMap((i) => i.requestIds),
    [data, selected]
  );

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    if (selectedRequestIds.length === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedRequestIds.length} request(s)? Library files are not touched.`
      )
    ) {
      return;
    }
    await axios.post('/api/v1/grid/bulk-delete-requests', {
      requestIds: selectedRequestIds,
    });
    setSelected(new Set());
    setSelectMode(false);
    mutate();
  };

  const ackNewSeasons = async (item: GridItem) => {
    await axios.post(
      `/api/v1/grid/ack-new-seasons/${item.mediaType}/${item.tmdbId}`
    );
    mutate();
  };

  const toggleFlag = async (item: GridItem, flag: 'downloading' | 'tobuy') => {
    await axios.post(
      `/api/v1/grid/flag/${item.mediaType}/${item.tmdbId}/${flag}`
    );
    mutate();
  };

  if (!data) {
    return <LoadingSpinner />;
  }

  const newSeasonBadge = (item: GridItem, extraClass = '') =>
    (item.metadata?.newSeasons.length ?? 0) > 0 ? (
      <button
        type="button"
        title="New season detected — click to dismiss"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ackNewSeasons(item);
        }}
        className={`rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-black shadow ${extraClass}`}
      >
        S{item.metadata?.newSeasons.join(', S')} new
      </button>
    ) : null;

  return (
    <>
      <PageTitle title={pageTitle} />
      <div className="mb-4 flex flex-col justify-between gap-2 lg:flex-row lg:items-end">
        <h1 className="text-3xl font-bold text-white">{pageTitle}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {data.refresh.running ? (
            <span className="text-sm text-gray-400">
              Fetching metadata {data.refresh.progress} / {data.refresh.total}…
            </span>
          ) : (
            hasPermission(Permission.ADMIN) && (
              <Button
                buttonType="ghost"
                onClick={async () => {
                  await axios.post('/api/v1/grid/refresh');
                  mutate();
                }}
                title="Hydrate/refresh title metadata"
              >
                <ArrowPathIcon className="h-4 w-4" />
              </Button>
            )
          )}
          <input
            type="search"
            className="block w-56 rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
            placeholder="Search this tab…"
            value={query}
            onChange={(e) => {
              setQueries((prev) => ({ ...prev, [tab]: e.target.value }));
              setVisible(PAGE_STEP);
            }}
          />
          <select
            className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as 'all' | 'movie' | 'tv')
            }
          >
            <option value="all">All types</option>
            <option value="movie">Movies</option>
            <option value="tv">Series</option>
          </select>
          <select
            className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-white"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'added' | 'title' | 'year')
            }
          >
            <option value="added">Date added</option>
            <option value="title">Title</option>
            <option value="year">Year</option>
          </select>
          <Button
            buttonType="ghost"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title="Sort direction"
          >
            {sortDir === 'asc' ? (
              <ArrowUpIcon className="h-4 w-4" />
            ) : (
              <ArrowDownIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            buttonType="ghost"
            onClick={() =>
              view === 'grid'
                ? setDensity((d) => (d + 1) % DENSITIES.length)
                : setView('grid')
            }
            title={view === 'grid' ? 'Poster size' : 'Grid view'}
          >
            <Squares2X2Icon className="h-4 w-4" />
          </Button>
          <Button
            buttonType={view === 'list' ? 'primary' : 'ghost'}
            onClick={() => setView(view === 'list' ? 'grid' : 'list')}
            title="List view"
          >
            <Bars4Icon className="h-4 w-4" />
          </Button>
          {enableBulkDelete && hasPermission(Permission.MANAGE_REQUESTS) && (
            <Button
              buttonType={selectMode ? 'danger' : 'ghost'}
              onClick={() => {
                setSelectMode((m) => !m);
                setSelected(new Set());
              }}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setVisible(PAGE_STEP);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t.label}
            <span className="ml-2 rounded-full bg-black bg-opacity-30 px-2 text-xs">
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {selectMode && selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-red-500 bg-red-900 bg-opacity-30 px-4 py-2">
          <span className="text-sm text-red-200">
            {selected.size} title(s) — {selectedRequestIds.length} request(s)
          </span>
          <Button buttonType="danger" onClick={bulkDelete}>
            <TrashIcon className="mr-1 h-4 w-4" />
            <span>Delete {selectedRequestIds.length} request(s)</span>
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-32 w-full text-center text-2xl text-gray-400">
          No titles match here.
        </div>
      ) : view === 'grid' ? (
        <ul
          className="cards-vertical"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${DENSITIES[density]}px, 1fr))`,
          }}
        >
          {shown.map((item) => (
            <li
              key={`${item.mediaType}-${item.tmdbId}`}
              className="group relative"
            >
              <TitleCard
                id={item.tmdbId}
                image={item.metadata?.posterPath || undefined}
                title={item.metadata?.title || `#${item.tmdbId}`}
                year={
                  item.metadata?.year ? String(item.metadata.year) : undefined
                }
                mediaType={item.mediaType}
                status={item.status}
                canExpand
              />
              <div className="absolute bottom-10 left-1/2 z-30 -translate-x-1/2">
                {newSeasonBadge(item)}
              </div>
              {!selectMode && (
                <div className="pointer-events-none absolute inset-x-1 bottom-16 z-30 flex justify-between px-1">
                  <button
                    type="button"
                    title={
                      item.flags.includes('tobuy')
                        ? 'Marked to buy — click to clear'
                        : 'Mark to buy'
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFlag(item, 'tobuy');
                    }}
                    className={`pointer-events-auto rounded-md px-1.5 py-0.5 text-xs font-bold shadow transition ${
                      item.flags.includes('tobuy')
                        ? 'bg-amber-500 text-black opacity-100'
                        : 'bg-black bg-opacity-60 text-white opacity-0 hover:bg-opacity-90 group-hover:opacity-100'
                    }`}
                  >
                    🛒
                  </button>
                  {TOGET_LIKE.includes(item.status) && (
                    <button
                      type="button"
                      title={
                        item.flags.includes('downloading')
                          ? 'Marked as downloading — click to clear'
                          : 'Mark as downloading'
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        toggleFlag(item, 'downloading');
                      }}
                      className={`pointer-events-auto rounded-md px-1.5 py-0.5 text-xs font-bold shadow transition ${
                        item.flags.includes('downloading')
                          ? 'bg-indigo-500 text-white opacity-100'
                          : 'bg-black bg-opacity-60 text-white opacity-0 hover:bg-opacity-90 group-hover:opacity-100'
                      }`}
                    >
                      ⬇
                    </button>
                  )}
                </div>
              )}
              {selectMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSelected(item.id);
                  }}
                  className={`absolute inset-0 z-40 rounded-xl border-4 transition ${
                    selected.has(item.id)
                      ? 'border-red-500 bg-red-500 bg-opacity-20'
                      : 'border-transparent bg-black bg-opacity-10 hover:border-gray-400'
                  }`}
                >
                  {selected.has(item.id) && (
                    <CheckCircleIcon className="absolute right-2 top-2 h-8 w-8 text-red-400" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1">
          {shown.map((item) => {
            const status = STATUS_LABELS[item.status] ?? STATUS_LABELS[1];
            const seasonsOwned = item.seasons.filter(
              (s) =>
                s.seasonNumber !== 0 && s.status === MediaStatus.AVAILABLE
            ).length;
            const seasonsTotal =
              item.metadata?.seasons.filter((s) => s.seasonNumber !== 0)
                .length ?? null;
            const row = (
              <div className="flex items-center gap-3 rounded-md bg-gray-800 px-3 py-2 transition hover:bg-gray-700">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4"
                  />
                )}
                <img
                  src={
                    item.metadata?.posterPath
                      ? `https://image.tmdb.org/t/p/w92${item.metadata.posterPath}`
                      : '/images/seerr_poster_not_found_logo_top.png'
                  }
                  alt=""
                  className="h-14 w-9 flex-none rounded object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">
                    {item.metadata?.title || `#${item.tmdbId}`}
                    {item.metadata?.year ? (
                      <span className="ml-2 font-normal text-gray-400">
                        ({item.metadata.year})
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.mediaType === 'tv' ? 'Series' : 'Movie'}
                    {item.mediaType === 'tv' && seasonsTotal
                      ? ` · ${seasonsOwned}/${seasonsTotal} seasons`
                      : ''}
                    {item.requestedSeasons.length > 0
                      ? ` · requested S${item.requestedSeasons.join(', S')}`
                      : ''}
                  </div>
                </div>
                {item.flags.includes('downloading') && (
                  <span className="flex-none rounded bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white">
                    ⬇ Downloading
                  </span>
                )}
                {item.flags.includes('tobuy') && (
                  <span className="flex-none rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
                    🛒 To Buy
                  </span>
                )}
                {newSeasonBadge(item, 'flex-none')}
                <span
                  className={`flex-none rounded px-2 py-0.5 text-xs font-bold text-white ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
            );
            return (
              <li key={`${item.mediaType}-${item.tmdbId}`}>
                {selectMode ? (
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => toggleSelected(item.id)}
                  >
                    {row}
                  </button>
                ) : (
                  <Link
                    href={`/${item.mediaType === 'tv' ? 'tv' : 'movie'}/${item.tmdbId}`}
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};

export default MediaGridPage;
