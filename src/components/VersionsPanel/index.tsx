import Button from '@app/components/Common/Button';
import { useState } from 'react';
import useSWR from 'swr';

/**
 * Shows the library versions of a title (deliberate Jellyfin duplicates like
 * "… - 1080p") with per-season completion, and an expandable flat file
 * listing served live from Jellyfin's database.
 */

interface VersionCoverage {
  seasonNumber: number;
  covered: number;
  total: number;
}

interface VersionRow {
  id: number;
  title: string;
  label: string;
  isMain: boolean;
  coverage: VersionCoverage[];
}

interface VersionFile {
  season?: number;
  episode?: number;
  episodeEnd?: number;
  name?: string;
  path: string;
  size?: number;
}

const fmtSize = (n?: number) => {
  if (!n) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`;
};

const VersionsPanel = ({
  mediaType,
  tmdbId,
}: {
  mediaType: 'movie' | 'tv';
  tmdbId: number;
}) => {
  const { data } = useSWR<{ versions: VersionRow[] }>(
    `/api/v1/grid/versions/${mediaType}/${tmdbId}`
  );
  const [showFiles, setShowFiles] = useState(false);
  const { data: filesData } = useSWR<{
    versions: {
      title: string;
      label: string;
      isMain: boolean;
      files: VersionFile[];
    }[];
  }>(showFiles ? `/api/v1/grid/files/${mediaType}/${tmdbId}` : null);

  if (!data || data.versions.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-700 bg-gray-800 bg-opacity-50 p-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-200">
          Library versions ({data.versions.length})
        </h2>
        <Button buttonType="ghost" onClick={() => setShowFiles((s) => !s)}>
          {showFiles ? 'Hide files' : 'Show files'}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {data.versions.map((v) => (
          <div
            key={v.id}
            className="flex flex-wrap items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm"
          >
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold ${
                v.isMain
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-600 text-gray-200'
              }`}
            >
              {v.isMain ? 'MAIN' : v.label || 'version'}
            </span>
            <span className="text-gray-200">{v.title}</span>
            {mediaType === 'tv' && v.coverage.length > 0 && (
              <span className="text-xs text-gray-400">
                {v.coverage
                  .filter((c) => c.seasonNumber !== 0)
                  .map(
                    (c) => `S${c.seasonNumber} ${c.covered}/${c.total}`
                  )
                  .join(' · ')}
              </span>
            )}
          </div>
        ))}
      </div>
      {showFiles && filesData && (
        <div className="mt-3 space-y-3">
          {filesData.versions.map((v, vi) => (
            <div key={`files-${vi}`}>
              <div className="mb-1 text-xs font-bold uppercase text-gray-400">
                {v.isMain ? 'Main' : v.label || v.title}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md bg-gray-900 p-2 font-mono text-xs text-gray-300">
                {v.files.length === 0 ? (
                  <div className="text-gray-500">No file data.</div>
                ) : (
                  v.files.map((f, fi) => (
                    <div key={fi} className="truncate py-0.5" title={f.path}>
                      {f.season != null
                        ? `S${String(f.season).padStart(2, '0')}E${String(
                            f.episode
                          ).padStart(2, '0')}${
                            f.episodeEnd ? `-E${String(f.episodeEnd).padStart(2, '0')}` : ''
                          } · `
                        : ''}
                      {f.path.split('/').pop()}
                      {f.size ? (
                        <span className="text-gray-500"> · {fmtSize(f.size)}</span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VersionsPanel;
