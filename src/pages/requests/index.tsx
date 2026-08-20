import type { GridItem, GridTab } from '@app/components/MediaGridPage';
import MediaGridPage from '@app/components/MediaGridPage';
import { MediaStatus } from '@server/constants/media';
import type { NextPage } from 'next';

/**
 * Requests = the To Get pipeline: everything asked for and not fully owned,
 * plus newly-detected seasons (a new season is a new thing to get, even on
 * an otherwise-complete show). Ownership browsing lives on /library.
 */
const TOGET_STATUSES = [
  MediaStatus.PENDING,
  MediaStatus.PROCESSING,
  MediaStatus.PARTIALLY_AVAILABLE,
];

const tabs: GridTab[] = [
  {
    id: 'toget',
    label: 'To Get',
    filter: (i: GridItem) => TOGET_STATUSES.includes(i.status),
  },
  {
    id: 'partial',
    label: 'Partial',
    filter: (i: GridItem) => i.status === MediaStatus.PARTIALLY_AVAILABLE,
  },
  {
    id: 'downloading',
    label: 'Downloading',
    filter: (i: GridItem) => i.flags.includes('downloading'),
  },
  {
    id: 'tobuy',
    label: 'To Buy',
    filter: (i: GridItem) => i.flags.includes('tobuy'),
  },
  {
    id: 'newseasons',
    label: 'New Seasons',
    filter: (i: GridItem) => (i.metadata?.newSeasons.length ?? 0) > 0,
  },
];

const RequestsPage: NextPage = () => {
  return (
    <MediaGridPage
      pageTitle="Requests"
      tabs={tabs}
      defaultTab="toget"
      enableBulkDelete
      storageKey="seerr-grid-requests"
    />
  );
};

export default RequestsPage;
