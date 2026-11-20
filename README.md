# jambotron-aria-grid

Workspace of the `@jambotron/aria-grid` Angular library — the data grid of Jambotron, built on Angular Aria.
Documentation: [projects/aria-grid/README.md](projects/aria-grid/README.md).

```bash
npm ci
npx ng test aria-grid --watch=false
npx ng build aria-grid
```

## Releases

Branches as in Jambotron: **development → staging → production** (owner, 2026-11-14). Drone (`.drone.yml`) publishes
to the npm registry of Gitea (`jambotron_gang`):

| Branch | Package |
| :--- | :--- |
| `staging` | `<version>-staging.<build>`, dist-tag `staging` — `npm i @jambotron/aria-grid@staging` |
| `production` | `<version>` from `projects/aria-grid/package.json`, dist-tag `latest` — only if that version is not published yet |

A release: raise the version in `projects/aria-grid/package.json` (and `CHANGELOG`, if any), PR into `development`,
then `development → staging`, check the staging package, then `staging → production` on the owner's word.

Public releases are also published by hand to [npmjs.com](https://www.npmjs.com/package/@jambotron/aria-grid)
(account `jambotron`): `npx ng build aria-grid && cd dist/aria-grid && npm publish --access public --registry https://registry.npmjs.org/`.
