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
