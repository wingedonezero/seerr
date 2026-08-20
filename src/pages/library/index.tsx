import type { GridItem, GridTab } from '@app/components/MediaGridPage';
import MediaGridPage from '@app/components/MediaGridPage';
import { MediaStatus } from '@server/constants/media';
import type { NextPage } from 'next';

/**
 * Library = what you own and how completely. Future home of the ownership
 * features: To Buy / Downloading flags, disc sources, missing-specials and
 * tag filters, removed-title (phantom) views.
 */
const tabs: GridTab[] = [
  {
    id: 'available',
    label: 'In Library',
    filter: (i: GridItem) => i.status === MediaStatus.AVAILABLE,
  },
  {
    id: 'partial',
    label: 'Partial',
    filter: (i: GridItem) => i.status === MediaStatus.PARTIALLY_AVAILABLE,
  },
  {
    id: 'all',
    label: 'All',
    filter: (i: GridItem) =>
      i.status === MediaStatus.AVAILABLE ||
      i.status === MediaStatus.PARTIALLY_AVAILABLE,
  },
];

const LibraryPage: NextPage = () => {
  return (
    <MediaGridPage
      pageTitle="Library"
      tabs={tabs}
      defaultTab="available"
      storageKey="seerr-grid-library"
    />
  );
};

export default LibraryPage;
