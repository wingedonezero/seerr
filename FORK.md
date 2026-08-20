# Fork manifest

This is wingedonezero's personal fork of [seerr-team/seerr](https://github.com/seerr-team/seerr),
run as a single-user instance on Tower. It diverges deliberately: features land here
that upstream would not take (disc/source library, request-tab redesign, DVD-order
support), and upstream is only merged selectively.

- **Forked from**: upstream `main` at `69f73a6f1486fdb51b8ddae9a94a8dfb629f461c` (v3.4.1, 2026-07-30)
- **Upstream remote**: none kept configured — Git GUIs auto-fetch remotes and drag in
  upstream's ~155 tags and branch spam. To sync, add it temporarily in a terminal:
  `git remote add upstream https://github.com/seerr-team/seerr.git`,
  `git fetch upstream --no-tags main`, review/cherry-pick, then `git remote remove upstream`.
- **Image**: `ghcr.io/wingedonezero/seerr:latest`, built by `.github/workflows/build.yml`
  on every push to `main` (amd64 only)

## Working agreements

- Keep our changes in clearly-owned files/namespaces where possible so upstream
  cherry-picks touch us minimally.
- Every divergence gets a row in the log below.
- To review upstream movement: `git fetch upstream && git log main..upstream/main --oneline`.
  Cherry-pick individual fixes rather than wholesale merges once the UI diverges.
- Upstream work branches can be fetched one-off into `refs/remotes/tmp/<name>`;
  never push `tmp/*` refs.

## Divergence log

| Date | Change | Files/areas | Why |
|------|--------|-------------|-----|
| 2026-08-20 | Replaced upstream CI with single ghcr build workflow; removed 18 upstream workflows | `.github/workflows/` | Personal fork: no releases, docs, helm, cypress infra |
| 2026-08-20 | Added this manifest | `FORK.md` | Track what we changed and why |
| 2026-08-20 | Merged upstream WIP branch `feat-episode-availability-media-scanners` (56 commits, per-episode availability: Episode entity + migration, scanner wiring, availabilitySync, flag `enableEpisodeAvailability` default off) | `server/entity/Episode.ts`, `server/lib/scanners/*`, `server/lib/availabilitySync.ts`, `server/migration/*/AddEpisodeTable*` | Upstream hadn't released it; we wanted it now rather than waiting. Watch upstream for their final version when syncing later |
| 2026-08-20 | Our fix: filter cross-listed specials (`ParentIndexNumber` mismatch) out of Jellyfin season episode counts | `server/lib/scanners/jellyfin/index.ts` | TVDB airs-within data made complete seasons read partial (e.g. HOTD S1 12+OVA=13 vs 12). No upstream branch has this; PR-able upstream |
| 2026-08-20 | Cherry-picked upstream `972fe274` (phantom specials blocking TV requests) and `feat/requests-sorting` (more request sort options) | `server/lib/scanners/baseScanner.ts`, `src/components/TvDetails`, `server/lib/requestSort.ts`, `server/routes/request.ts`, `src/components/RequestList` | Small finished upstream work we'd otherwise wait for |
| 2026-08-20 | Versions: media_version table records deliberate Jellyfin duplicates ("Title - 1080p" tmm convention; suffix only parsed as a label when the base matches the canonical title); the MAIN (bare-title) entry drives media status, others carry their own aired-currency coverage; VersionsPanel on detail pages with live per-version file listing from Jellyfin's DB; sources gain versionLabel (label text, deliberately no FK — rescans can't touch logs); requests unchanged (single entry per title) | `server/entity/MediaVersion.ts`, `server/lib/versiontracker.ts`, scanner, `server/routes/grid.ts`, `src/components/VersionsPanel/`, `src/components/SourcesManager/`, migrations `AddMediaVersionsAndSourceVersionLabel` | User keeps 480p/1080p/Director's-Cut duplicates; previously invisible to Seerr and caused last-scan-wins status flapping |
| 2026-08-20 | Order-awareness: TVDB season-type fetch (dvd/absolute) maps alternate numbering onto metadata_episode rows by TVDB episode id; scanner scores Jellyfin (season,episode,title) tuples against stored orderings (titles count double) — NO filesystem/nfo reading, zero disk wake-ups; availability compares in the effective order (override > detected > aired); order shown + manually settable in SourcesManager; /grid/order endpoint | `server/api/tvdb/index.ts`, `server/lib/orderdetection.ts`, `server/lib/metadatarefresh.ts`, `server/lib/scanners/jellyfin/index.ts`, `server/routes/{grid,sources}.ts`, `src/components/SourcesManager/`, migrations `AddOrderColumns` | Jeremiah-class fix: DVD-ordered rips (19 disc eps vs 20 aired) stop reading as partial |
| 2026-08-20 | Disc sources & logs: media_source (kind disc/remux/encode, per-season anchor, unlimited) + source_log (unlimited named text logs, CASCADE from source only); CRUD + export API under /sources (zip of .txt named by disc/log, Season folders); SourcesManager modal opened from a 💿 button on every TV season row and the movie action bar. Keyed (tmdbId, mediaType) — no FK into scanned tables | `server/entity/MediaSource.ts`, `server/entity/SourceLog.ts`, `server/routes/sources.ts`, `src/components/SourcesManager/`, `src/components/TvDetails/`, `src/components/MovieDetails/`, migrations `AddMediaSourceTables` | The dash's core feature, per-season as designed; user data vault untouchable by scanners |
| 2026-08-20 | Flags (dash marks): media_flag table ('downloading' auto-clears via MediaSubscriber when a title turns AVAILABLE; 'tobuy' manual-only), toggle API /grid/flag, hover toggles on grid cards, Downloading + To Buy tabs on Requests, list-view badges. No FK into scanned tables — user marks survive deletions/rescans | `server/entity/MediaFlag.ts`, `server/subscriber/MediaSubscriber.ts`, `server/routes/grid.ts`, `src/components/MediaGridPage/`, `src/pages/requests/`, migrations `AddMediaFlagTable` | Last daily-workflow parity piece with seer-dash; no import from dash (fresh start by user choice) |
| 2026-08-20 | Backups: daily job (5:30am) zips a consistent SQLite snapshot (VACUUM INTO) + settings.json into `<config>/backups`, keeps newest 14 (BACKUP_KEEP); list/run/download API under /settings/backups; section on the Jobs & Cache settings page. New dependency: archiver | `server/lib/backups.ts`, `server/routes/settings/index.ts`, `server/job/schedule.ts`, `src/components/Settings/SettingsJobsCache/`, `seerr-api.yml` | Safety net lands before user-authored data (flags/discs) does |
| 2026-08-20 | Full local record: media_metadata gains genres/runtime/certification/backdrop/network; new metadata_episode table (per-episode titles/dates/overviews, aired-keyed with dvd/absolute columns reserved for order-awareness); refresh job syncs episodes change-limited (refetch only when counts differ or newest season of an airing show) | `server/entity/MetadataEpisode.ts`, `server/lib/metadatarefresh.ts`, migrations `AddMetadataEpisodesAndDetails` | Library/requests titles must render fully offline; episode rows are the foundation for DVD/absolute order mapping |
| 2026-08-20 | media_metadata table + tiered refresh job (`metadata-refresh`, daily 6am: ongoing TV 1d / ended TV 7d / upcoming movies 1d / movies 30d, ~2 req/s pacing) with new-season detection; grid API (`/api/v1/grid` + refresh/ack/bulk-delete-requests); shared MediaGridPage component (grid/list views, poster density, per-tab search, infinite scroll, multi-select); Requests page replaced (tabs To Get/Partial/New Seasons, bulk request delete); new Library page + sidebar entry (In Library/Partial/All) | `server/entity/MediaMetadata.ts`, `server/lib/metadatarefresh.ts`, `server/routes/grid.ts`, `server/job/schedule.ts`, `src/components/MediaGridPage/`, `src/pages/requests/`, `src/pages/library/`, `src/components/Layout/Sidebar/`, migrations `AddMediaMetadataTable` | Whole-library browsing from local DB only; Requests = the To Get pipeline, Library = ownership browsing (future home of flags/discs/tag filters) |
