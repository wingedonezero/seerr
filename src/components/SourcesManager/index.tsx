import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import { XMarkIcon } from '@heroicons/react/24/solid';
import axios from 'axios';
import { useState } from 'react';
import useSWR from 'swr';

/**
 * Editor for a title's disc/remux/encode sources and their logs, scoped to
 * one season (or the whole title for movies). Every action is one small API
 * call — create, save, delete — so there is never a half-written state.
 */

export interface SourceLogData {
  id: number;
  title: string;
  body: string;
}

export interface SourceData {
  id: number;
  seasonNumber: number | null;
  kind: string;
  name: string;
  grp: string;
  versionLabel: string;
  info: string;
  logs: SourceLogData[];
}

interface SourcesManagerProps {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  /** null = whole title (movies); 0 = Specials */
  seasonNumber: number | null;
  displayTitle: string;
  onClose: () => void;
}

const KIND_STYLES: Record<string, string> = {
  disc: 'bg-blue-500 bg-opacity-20 text-blue-300',
  remux: 'bg-purple-500 bg-opacity-20 text-purple-300',
  encode: 'bg-green-500 bg-opacity-20 text-green-300',
};

const SourcesManager = ({
  mediaType,
  tmdbId,
  seasonNumber,
  displayTitle,
  onClose,
}: SourcesManagerProps) => {
  const { data, mutate } = useSWR<{
    sources: SourceData[];
    order: { detected: string; override: string; effective: string };
  }>(`/api/v1/sources/${mediaType}/${tmdbId}`);
  const [busy, setBusy] = useState(false);
  const [savedTick, setSavedTick] = useState<number | null>(null);

  const scoped = (data?.sources ?? []).filter((s) =>
    seasonNumber === null
      ? s.seasonNumber === null || s.seasonNumber === undefined
      : s.seasonNumber === seasonNumber
  );

  const call = async (fn: () => Promise<unknown>, sourceId?: number) => {
    setBusy(true);
    try {
      await fn();
      await mutate();
      if (sourceId) {
        setSavedTick(sourceId);
        setTimeout(() => setSavedTick(null), 1500);
      }
    } finally {
      setBusy(false);
    }
  };

  const addSource = (kind: string) =>
    call(() =>
      axios.post(`/api/v1/sources/${mediaType}/${tmdbId}`, {
        kind,
        seasonNumber,
      })
    );

  const scopeLabel =
    seasonNumber === null
      ? ''
      : seasonNumber === 0
        ? ' — Specials'
        : ` — Season ${seasonNumber}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mt-8 w-full max-w-3xl rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
          onClick={onClose}
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <h2 className="mb-1 text-xl font-bold text-white">
          Sources &amp; logs
        </h2>
        <p className="mb-2 text-sm text-gray-400">
          {displayTitle}
          {scopeLabel}
        </p>
        {mediaType === 'tv' && data?.order && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
            <span>
              Episode order:{' '}
              <span className="font-semibold text-gray-200">
                {data.order.effective}
              </span>
              {data.order.override
                ? ' (manual)'
                : data.order.detected
                  ? ' (detected)'
                  : ''}
            </span>
            <select
              className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white"
              value={data.order.override}
              onChange={(e) =>
                call(() =>
                  axios.post(`/api/v1/grid/order/${mediaType}/${tmdbId}`, {
                    order: e.target.value,
                  })
                )
              }
            >
              <option value="">Auto-detect</option>
              <option value="aired">Aired</option>
              <option value="dvd">DVD</option>
              <option value="absolute">Absolute</option>
            </select>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <Button buttonType="ghost" onClick={() => addSource('disc')}>
            + Disc
          </Button>
          <Button buttonType="ghost" onClick={() => addSource('remux')}>
            + Remux
          </Button>
          <Button buttonType="ghost" onClick={() => addSource('encode')}>
            + Encode
          </Button>
          <a
            className="ml-auto rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:text-white"
            href={`/api/v1/sources/export/${mediaType}/${tmdbId}`}
          >
            Export title .txt zip
          </a>
        </div>

        {!data ? (
          <LoadingSpinner />
        ) : scoped.length === 0 ? (
          <p className="py-8 text-center text-gray-400">
            No sources here yet — add a disc, remux or encode above.
          </p>
        ) : (
          scoped.map((source) => (
            <SourceEditor
              key={source.id}
              source={source}
              busy={busy}
              saved={savedTick === source.id}
              onCall={call}
            />
          ))
        )}
      </div>
    </div>
  );
};

const SourceEditor = ({
  source,
  busy,
  saved,
  onCall,
}: {
  source: SourceData;
  busy: boolean;
  saved: boolean;
  onCall: (fn: () => Promise<unknown>, sourceId?: number) => Promise<void>;
}) => {
  const [name, setName] = useState(source.name);
  const [grp, setGrp] = useState(source.grp);
  const [versionLabel, setVersionLabel] = useState(source.versionLabel ?? '');
  const [info, setInfo] = useState(source.info);
  const [logEdits, setLogEdits] = useState<
    Record<number, { title: string; body: string }>
  >({});

  const logState = (log: SourceLogData) =>
    logEdits[log.id] ?? { title: log.title, body: log.body };

  return (
    <div className="mb-4 rounded-md border border-gray-700 bg-gray-900 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
            KIND_STYLES[source.kind] ?? 'bg-gray-600'
          }`}
        >
          {source.kind}
        </span>
        <input
          type="text"
          className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white"
          placeholder={
            source.kind === 'disc'
              ? 'Disc name — e.g. Andromeda S01D01 NTSC DVD'
              : 'Release name'
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {source.kind !== 'disc' && (
          <input
            type="text"
            className="w-40 rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white"
            placeholder="Group"
            value={grp}
            onChange={(e) => setGrp(e.target.value)}
          />
        )}
        <input
          type="text"
          className="w-28 rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white"
          placeholder="Version"
          title="Which library version this belongs to (e.g. 1080p, 480p) — blank = main"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
        />
        <Button
          buttonType="primary"
          disabled={busy}
          onClick={() =>
            onCall(
              () =>
                axios.put(`/api/v1/sources/source/${source.id}`, {
                  name,
                  grp,
                  info,
                  versionLabel,
                }),
              source.id
            )
          }
        >
          {saved ? 'Saved ✓' : 'Save'}
        </Button>
        <Button
          buttonType="danger"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                `Delete "${name || source.kind}" and its ${source.logs.length} log(s)?`
              )
            ) {
              onCall(() =>
                axios.delete(`/api/v1/sources/source/${source.id}`)
              );
            }
          }}
        >
          ✕
        </Button>
      </div>
      <textarea
        className="mb-2 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 font-mono text-xs text-white"
        rows={3}
        placeholder={
          source.kind === 'disc'
            ? 'Disc info — label, size, protection, playlist, BDInfo summary…'
            : 'Release info…'
        }
        value={info}
        onChange={(e) => setInfo(e.target.value)}
      />
      {source.logs.map((log) => (
        <div
          key={log.id}
          className="mb-2 border-t border-dashed border-gray-700 pt-2"
        >
          <div className="mb-1 flex items-center gap-2">
            <input
              type="text"
              className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-1 text-sm text-white"
              placeholder="Log title — e.g. D01 makemkv"
              value={logState(log).title}
              onChange={(e) =>
                setLogEdits((prev) => ({
                  ...prev,
                  [log.id]: { ...logState(log), title: e.target.value },
                }))
              }
            />
            <Button
              buttonType="ghost"
              disabled={busy}
              onClick={() =>
                onCall(
                  () =>
                    axios.put(`/api/v1/sources/logs/${log.id}`, logState(log)),
                  source.id
                )
              }
            >
              Save log
            </Button>
            <Button
              buttonType="danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Delete log "${logState(log).title || 'untitled'}"?`)) {
                  onCall(() => axios.delete(`/api/v1/sources/logs/${log.id}`));
                }
              }}
            >
              ✕
            </Button>
          </div>
          <textarea
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 font-mono text-xs text-white"
            rows={4}
            placeholder="Paste the log text…"
            value={logState(log).body}
            onChange={(e) =>
              setLogEdits((prev) => ({
                ...prev,
                [log.id]: { ...logState(log), body: e.target.value },
              }))
            }
          />
        </div>
      ))}
      <Button
        buttonType="ghost"
        disabled={busy}
        onClick={() =>
          onCall(() =>
            axios.post(`/api/v1/sources/source/${source.id}/logs`, {
              title: '',
              body: '',
            })
          )
        }
      >
        + Add log
      </Button>
    </div>
  );
};

export default SourcesManager;
