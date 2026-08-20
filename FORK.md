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
| 2026-08-20 | media_metadata table + tiered refresh job (`metadata-refresh`, daily 6am: ongoing TV 1d / ended TV 7d / upcoming movies 1d / movies 30d, ~2 req/s pacing) with new-season detection; grid API (`/api/v1/grid` + refresh/ack/bulk-delete-requests); shared MediaGridPage component (grid/list views, poster density, per-tab search, infinite scroll, multi-select); Requests page replaced (tabs To Get/Partial/New Seasons, bulk request delete); new Library page + sidebar entry (In Library/Partial/All) | `server/entity/MediaMetadata.ts`, `server/lib/metadatarefresh.ts`, `server/routes/grid.ts`, `server/job/schedule.ts`, `src/components/MediaGridPage/`, `src/pages/requests/`, `src/pages/library/`, `src/components/Layout/Sidebar/`, migrations `AddMediaMetadataTable` | Whole-library browsing from local DB only; Requests = the To Get pipeline, Library = ownership browsing (future home of flags/discs/tag filters) |
