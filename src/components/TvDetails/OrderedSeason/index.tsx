import AirDateBadge from '@app/components/AirDateBadge';
import Badge from '@app/components/Common/Badge';
import globalMessages from '@app/i18n/globalMessages';
import { useIntl } from 'react-intl';

/**
 * Episode list rendered from the fork's local ordered data (DVD/absolute) —
 * used instead of <Season> when a series' effective ordering isn't aired.
 * Availability badges are correct here because per-episode tracking is keyed
 * by the library's own numbering, which is exactly this display numbering.
 */

export interface OrderedEpisode {
  episodeNumber: number;
  title: string;
  airDate: string | null;
  overview: string;
  available: boolean;
}

const OrderedSeason = ({ episodes }: { episodes: OrderedEpisode[] }) => {
  const intl = useIntl();
  return (
    <div className="flex flex-col justify-center divide-y divide-gray-700">
      {episodes
        .slice()
        .reverse()
        .map((episode) => (
          <div
            className="flex flex-col space-y-4 py-4"
            key={`ordered-episode-${episode.episodeNumber}`}
          >
            <div className="flex-1">
              <div className="flex flex-col space-y-2 xl:flex-row xl:items-center xl:space-x-2 xl:space-y-0">
                <h3 className="text-lg">
                  {episode.episodeNumber} - {episode.title}
                </h3>
                {episode.airDate && <AirDateBadge airDate={episode.airDate} />}
                {episode.available && (
                  <Badge badgeType="success">
                    {intl.formatMessage(globalMessages.available)}
                  </Badge>
                )}
              </div>
              {episode.overview && <p>{episode.overview}</p>}
            </div>
          </div>
        ))}
    </div>
  );
};

export default OrderedSeason;
