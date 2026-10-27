# dsh-hud

[![release](https://img.shields.io/npm/v/%40konnga%2Fdsh-hud?label=release&color=fb8c00)](https://www.npmjs.com/package/@konnga/dsh-hud) [![node](https://img.shields.io/badge/node-%3E%3D20-43853d?logo=nodedotjs&logoColor=white)](#install) [![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**English** | [中文](./README.md)

A read-only DeepSeek Harness status panel: branch, ahead/behind, changed files and diffs — plus which files *this session* touched, what you have reviewed, and what tools ran.

> Screenshots in this file were taken in the **Chinese UI**; the plugin's own labels follow your UI language, and every quoted label below is the English one you would actually see.

![The capsule row above the composer: Git status on the left, tools & skills in the middle, this session's running time on the right (the balance capsule came later; the screenshot predates it)](docs/images/capsules.webp)

## Install

Desktop: **Settings → Plugins → Add plugin**, then enter `@konnga/dsh-hud`.

For local development, point the profile at the checkout (host changes apply immediately; client code is re-read on app restart):

```json
"@konnga/dsh-hud": "link:/path/to/dsh-hud"
```

## What it gives you

| Feature | In one line | Where |
| --- | --- | --- |
| **Git capsule** | Workspace name, branch, ahead/behind, change counts, files this session touched | Leftmost of the row above the composer (click to open the panel) |
| **Tools capsule** | What is running now (live seconds), per-tool call counts, skills used | Same row, middle |
| **Session timer capsule** | How long this session has been running; hover for model/tool wall time and turns | Same row, rightmost (after the balance) |
| **Balance capsule** | **Follows the current session's model provider**: the official account for the platform ledger, that relay's own balance for a relay; `⚠` low-balance warning, **click to paste a dashboard token** (that is how the relay's current balance becomes readable), hover shows balance / API requests / account usage / key usage | Same row, before the timer |
| **Panel** | Change overview, change list, recent commits, tags; click any row for its diff | Click the Git capsule |
| **Diffs, commit detail, images** | Unstaged / staged, word wrap, copy diff; image side-by-side + zoom | Right of the panel, draggable |
| **Per-turn image changes** | Images touched this turn: click to view one, `⇄` for before/after | Next to the built-in "edited N files" card |
| **Sidebar session rows** | Hover or click `⋯` to expand: git summary + per-session attribution | Every sidebar session row |
| **Keyboard** | `↑↓` `Enter` `[ ]` `n p` `Space` `v` `r` `Esc` inside the panel | Once the panel is active |
| **`↑` prompt recall** | Empty composer + `↑` brings back your previous prompt | In the composer |

## What you will see

### Capsules (the row above the composer)

```
dsh-hud · git:(main*) ↑1 ↓2 M4 A1 ?1 │ ●3   │   ✓ bash ×16 │ …   │   ⏱ 2h 14m   │  ¥128.40+
```

> Hover tips on the capsules are **bubbles the plugin draws itself** — not the browser's native tooltip, which never showed up in the real app and whose delay and styling we cannot control anyway.

**Git** (leftmost)

- `dsh-hud` — workspace name (elided in the middle when long; hover for the full path). Shown even outside a git repository.
- `git:(main*)` — branch. `*` means the worktree is dirty; detached shows `git:(detached abc1234)`.
- `↑1 ↓2` — ahead/behind the upstream (hidden when zero).
- `M4 A1 ?1` — change counts, only non-zero ones: `M` modified · `A` added · `D` deleted · `R` renamed · `C` copied · `T` type change · `?` untracked · `!` conflicted.
- `●3` — this session changed 3 files (hidden when there are none).

**Tools** (middle, appears once a tool has run)

```
◐ bash: pnpm test 1.2s                                     ← running, seconds tick live
✓ bash ×16 │ ✓ apply_patch ×6 │ skills: office-xlsx ×2 +2   ← idle
```

- One count per tool; the leading `✓` / `✗` is the result of **its own most recent** call.
- After `skills:` come skill *names* (so you can tell which skill, not just how many calls).
- At most 3 tools + 2 skills are laid out; the rest collapse into `+k`. Hover for the full list and the latest results.

**Session timer** (rightmost, after the balance capsule)

```
⏱ 2h 14m
```

- **How long this session has been running.** Same definition as [codex-hud](https://github.com/konnga/codex-hud)'s session duration: `now − session createdAt` (idle time included). Format: `<1m` / `45m` / `2h 14m` / `3d 2h`.
- Hover adds what actually happened during that time:

  ```
  This session's running time · started 2026-10-14 17:58 · model 1h 29m, tools 23m · 27 turns / 380 steps
  ```

  The last two come from the built-in `sessionStats` projection; when that projection is absent we show the wall clock only and invent nothing.
- Right after a restart it may be missing for a few seconds: the session is restored into the host store asynchronously (measured: about 30 s). So a failed lookup is retried every **3 s** and drops to once a minute once it succeeds. If the session is archived or the host has no `sessions` service, the capsule is not drawn at all.

Here it is on a real machine:

![Hovering the session timer capsule: a bubble above it reads the session's running time, when it started, the model and tool wall time, and the turn and step counts, with the capsule itself "⏱ 4d 16h 31m" below](docs/images/pill-tip.webp)

*The same bubble is used by the Git and tools capsules (the Git one is multi-line: full path / upstream / per-type counts).*

**Account balance** (before the timer)

```
¥128.40+
```

**Balance** (before the timer) — it shows the ledger the current session is actually spending from:

| The session uses | Capsule shows | Example |
| --- | --- | --- |
| DeepSeek Platform account (`deepseek-account`) | the platform wallet balance | `¥128.40+` |
| Official API key (`deepseek-official`) | the wallet from `GET /user/balance` | `¥128.60+` |
| Third-party relay readable with an API key | whatever remaining quota that relay reports | `$2,265.33` |
| Relay that exposes the remainder only to a web session (web token configured) | the account balance from the site's own console | `$137.48` |
| Relay reports "unlimited" / no web token configured | **used** (remaining unknown, never invented) | `used $1.24` |
| Unrecognised relay (neither protocol answers) | the site id plus `--` (unreadable, said plainly) | `api404 --` |
| Not resolved yet (new session / just switched / host not ready) | `--` (**never** the platform account balance as a stand-in) | `--` |

With a dashboard credential configured, a relay capsule's hover looks like this — four readings coloured by meaning
(see below for why):

![Hovering a relay balance capsule: the bubble reads the site name happycoding, then "balance $137.48" in green, "API requests 3,514" in blue, "$7.51 used on this account" in amber, "$1.24 used on this key" in amber, and "updated 2026-10-27 16:45" in grey; below it the capsule itself "$137.48" and the timer capsule "⏱ 7d 4h 4m"](docs/images/balance-hover.webp)

**DeepSeek account balance** (hover)

```
DeepSeek account balance
¥8.60
Bonus balance ¥2.00
-¥0.30 since last refresh (2026-10-27 08:45)
updated 2026-10-27 08:50
```

The tip holds **readings only** — no usage instructions, no warning prose: the old "click to refresh / right-click for
the usage page / balance below … topping up" lines were removed (they pushed the block to seven lines and squeezed out
the numbers that actually move). Both actions remain: **click = refresh now**, **right-click = open the Platform usage
page** in a new tab. A low balance is signalled by the `⚠` and warning colour on the capsule alone, never restated in the tip.

- The number comes from DSH's own account API (`remote.account.getBalance` — the same data as Settings → Account). Read-only, never persisted.
- Formatting matches DSH's account card rule for rule: `¥0.00` / `<¥0.01` (less than a cent) / `¥1,234.56` (thousands separators, truncated toward zero at two decimals) / a leading `-` for negatives. The currency symbol comes from the amount itself (`¥` / `$`) and is never drawn twice.
- A trailing `+` means there is also bonus balance (the amount is in the hover tip). A trailing `?` in the warning colour means the last refresh failed and what you see is the previous number (the tip says from when).
- **Low-balance warning** — below the threshold (¥10 by default) the capsule gains a `⚠` and the amount turns warning-coloured (**on the capsule only — no text**).
  The threshold can be overridden with the localStorage key `dsh-hud.balanceLow` (write a decimal number, e.g. `localStorage.setItem('dsh-hud.balanceLow', '50')`); reload the page to apply.
- **Change since last refresh** — the hover tip shows something like "-¥0.30 since last refresh (22:37)". This is the difference between **our own two samples**, not Platform's "today's spend";
  it does not accumulate across restarts (we do not know what happened in between), which is why the wording says "since last refresh".
  The subtraction aligns decimals and works on integers, so `8.6 - 8.3` is exactly `0.30` — never `0.2999999999999998`.
- It refreshes every 5 minutes (it costs a real Platform request, and the balance only moves by the minute); **click** to refresh immediately.

### Relay account balance: why some sites can only report usage

The new-api family (`ur` / `muyuan` / `happycoding` / `ccwu` all are) splits its data behind two different auth schemes:

| Endpoint | Accepts | Returns | Measured (`ur`) |
| --- | --- | --- | --- |
| `GET /dashboard/billing/subscription` | ✅ API key | the quota ceiling | `hard_limit_usd: 100000000` (a **placeholder**) |
| `GET /dashboard/billing/usage` | ✅ API key | cumulative usage of **this key** | `$479.44` |
| `GET /api/user/self` | ❌ **dashboard credential only** (PAT / login session; behind `UserAuth()`) | **account** balance + account cumulative usage + request count | `$855.69` / `$526.66` / `3685` |
| `GET /api/usage/token/` | ✅ API key | this key's own quota view (`unlimited_quota: true` here) | `total_available: -199583909` |

So the **account balance** (the console's "current balance") has exactly one readable path, and it rejects `sk` keys.
To see it, configure a **dashboard credential** for that site — **click the balance capsule** and a small panel appears:

```
┌─ Add a dashboard access token ────── ur ─┐
│ This site only exposes its current       │
│ balance to a dashboard session (API      │
│ keys cannot read it). Create an access   │
│ token with the profile:read scope, then  │
│ paste it here.                           │
│ [••••••••••••••••••••]                   │
│ Will be written to UR_ACCESS_TOKEN       │
│                          [Save] [Cancel] │
└──────────────────────────────────────────┘
```

- Where to get it: the site's "personal settings → access tokens", with the **`profile:read`** scope (long-lived).
  Older deployments without that page also accept a login session token copied from the browser's `user.token` (expires).
- **No editing of `~/.dsh/.credentials.yaml`**: the reference name (`UR_ACCESS_TOKEN`) is derived from `UR_API_KEY`,
  and the write goes through DSH's credentials service. Making users hand-edit that file turns "configure a token" into
  "edit a config file" — one bad indent and the whole credential store stops parsing.
- The token is **never echoed**: a `password` input, never in localStorage, never in logs, never in the snapshot,
  and the host never sends it back to the browser (the response carries only the reference name).
- Saving refetches immediately (bypassing the host's 60-second cache) and the panel closes itself.
- When the token expires (new device, sign-out, site reset) it **falls back to the usage path automatically**.
  Sites without a credential keep reporting usage; a `ur —` capsule is the "no credential yet" state and opens the same panel.

- **No hardcoded conversion rate**: `quota` is an integer; dividing by the `quota_per_unit` the site publishes in `/api/status`
  (measured `500000` on `ur`) gives the amount, and non-USD sites are converted with their own published `usd_exchange_rate`.
  Only when the scale is unreadable does it fall back to new-api's default, and that fallback is logged.
  (All four sites report `quota_display_type: USD`, so the non-USD branch is defensive code for them.)
- **Cross-checked digit for digit** (two independent passes, hours apart, each of the four numbers matching its own scale):
  - `ur`: `427845000 / 500000 = $855.69`, `263330000 / 500000 = $526.66`, `request_count = 3685`;
  - `happycoding` (the site in the screenshot above): `68725535 / 500000 = $137.45`, `3774465 / 500000 = $7.55`,
    `request_count = 3525`, `total_usage = 127.0872 cents = $1.27` — the screenshot read `$137.48 / $7.51 / 3,514 / $1.24`,
    and the difference is the usage that actually happened in those minutes (balance down, the other three up),
    **not a conversion error**.

### When the capsule shows `--`

The capsule only draws a reading it actually has. When it has none — not yet, or not readable —
it draws `--` and **never** substitutes the platform account balance: that number may belong to a
different ledger than the one this session spends, so filling it in would report an unrelated figure.

| State | Capsule |
| --- | --- |
| Reading available | `$742.23` |
| Site known, unreadable (e.g. `api404`) | `api404 --` |
| Site not even known yet (new session, just switched, host warming up) | `--` |
| Host says the provider's ledger *is* the platform account | platform balance `⚠ ¥8.60` |

Switching sessions clears the ledger **synchronously**: the previous ledger is gone the instant the new
session binds (`unknown` → `--`), then the new session's model provider is queried. So a switch never
leaves the previous session's site and amount on screen — that is another ledger's money.

### The two "used" figures are two different ledgers

Once a dashboard credential is configured, the hover lists **account** and **this key** usage side by side — they differ:

```
happycoding
balance $137.48                ← quota of /api/user/self ÷ quota_per_unit
API requests 3,514             ← request_count from the same response (right under the balance:
                                 it is the only count on this screen, not money)
$7.51 used on this account     ← used_quota from the same response (whole account)
$1.24 used on this key         ← total_usage of /dashboard/billing/usage (this key only)
updated 2026-10-27 16:45
```

On one site the two can differ substantially (here: `$7.51` on the account vs `$1.24` on this key — the gap is other keys
on the same account; on `ur` it was `$526.66` vs `$479.44`), so they are **two fields and two lines**, not one field behind
a flag — collapsing them would throw away a real reading.

**Why three colours**: this screen holds three amounts and one count, so they are separated by meaning —

| Colour | What uses it | Why |
| --- | --- | --- |
| green | balance | the common reading of "how much is left" |
| blue | API requests | it is a **count**, not money; a third amount in the same colour reads as one |
| amber | both "used" lines | a category colour ("this is spending"), **not** a warning |
| grey | labels / site name / updated-at | timestamps and labels are not readings; colouring them means everything is coloured |

All colours come from DSH's own theme tokens (`state-success-primary` / `state-business-primary` / `state-warn-primary`),
which carry separate values for light and dark themes — no hardcoded hex.

The line order is `balance → API requests → account usage → this key's usage`: the request count sits right under the
balance because it is the only **count** on the screen rather than an amount, and sandwiched between two amounts it reads
like a third one.

### "Used" is not "this month"

These sites **ignore `start_date` / `end_date`** (measured across four sites and four windows — identical answers),
so the figure is cumulative. Since the range has no effect, the request asks for the full history and the label says cumulative —
never a monthly label hinting at monthly arithmetic.

### Balance for the current session's model provider

Switch models inside one session and you switch ledgers — so the capsule follows **the provider the current model belongs to**:

- **Which provider**: the host reads the session's `modelSelection` projection (`next ?? lastUsed`, so a model just picked in the menu counts before the first message is sent).
- **Where to query**: the `baseURL` and credential reference are read live from the **Settings → Models** projection — no second copy that could drift from the user's edits.
- **Credential**: resolved once from DSH's `credentials` service and sent **only to that provider's own baseURL**; never logged, never returned to the browser, never persisted.
- **Three protocols** (measured 2026-10-27 against a real local configuration):

| Source | Endpoint | Fields | Measured |
| --- | --- | --- | --- |
| Platform account | DSH `remote.account.getBalance` | wallet array | already in use; the host does not re-fetch |
| Official API key | `GET {origin}/user/balance` | `balance_infos[].total_balance` (+ `granted_balance`) | `200`, `-0.19 CNY` |
| Relay (one-api / new-api family) | `GET {base}/dashboard/billing/subscription` + `/usage` | `hard_limit_usd` (**remaining**) + `total_usage` (**cents**) | `muyuan` → remaining `2265.33`, used `212.74` |

Three things the implementation states plainly rather than papering over:

1. **`hard_limit_usd` is remaining quota, not a total** — so used is **not** subtracted again. Writing `limit - used` would understate the balance.
2. **`total_usage` is in cents** — measured `21274.26` matches the site's `$212.74`.
3. **`1e8` is an "unlimited" sentinel** — measured on `ur` / `ccwu` / `happycoding`: two probes both returned `100000000` while real usage was climbing. Remaining quota is then **not computable**, so the capsule reports "used" rather than passing off `1e8 - used` as a balance.

Boundaries:

- An unrecognised relay (measured `api404`: both paths 404/502) reports `unsupported` and the capsule renders `api404 --`.
  **No number is drawn** (it never falls back to the platform account's balance — that is a different ledger), but the capsule does not vanish either:
  a `—` is a reading ("this ledger can't be read"), while a blank is just a doubt that sends people off to check logs and reinstall.
- No currency conversion: relay fields are named `*_usd` but some sites account in CNY 1:1 internally; only the site's own stated figures are repeated.
- **Some sites expose remaining quota only to a web session** (measured on `ur`: `/api/user/self` answers `401 AUTH_UNAUTHORIZED`
  while `/dashboard/billing/*` is readable with an API key). The capsule then reports usage only instead of pretending to know the remainder —
  it neither guesses nor rides your web session (that would mean private requests with your account credentials, broken by any site change).
- Caching: 60 s client TTL, 60 s per-provider host cache, 8 s request timeout. Relays rate-limit aggressive polling, and that is how "can't read the balance" actually happens.
- The client re-asks every 30 s (actual requests are gated by the TTL: 60 s on success, 30 s on failure): the first read often lands before the session projection is ready, and waiting five minutes would leave the capsule blank for that long.
- A failed read keeps the previous numbers (a network blip must not make the capsule vanish); switching sessions re-reads immediately instead of reusing the previous session's ledger.
- **Nothing to show, nothing drawn**: signed out, no account plugin, or no wallet at all — the capsule simply does not appear. It never fakes `¥0.00`.

> Why spend totals are not in the capsule: DSH's account API returns **wallet balances only** (`getBalance`) plus the
> account projection — it carries no spending numbers at all; that data exists only on DeepSeek's own usage page
> (**right-click the capsule** to go straight there). The plugin does not scrape Platform-internal endpoints
> (which needs the account credential and breaks whenever Platform changes), nor does it multiply tokens by a
> self-invented price to produce a number that looks precise but is not.

### Panel (click the Git capsule)

![The panel: change overview and this session's changes, change list, recent commits and tags on the left; the selected commit's files in the middle; the diff on the right](docs/images/panel.webp)

*Above: viewing a commit. The title bar is draggable; `⟳` refresh · `⌖` reset position · `✕` collapse.*

1. **Repository path · upstream · short oid**
2. **Summary** — coloured counts grouped by kind; says `Working tree clean — nothing uncommitted` when it is.
3. **This session's changes** — one line of counts plus the toggles `Only this session's` and `Latest turn only`; with review marks you also get `3/8 reviewed` and `Clear reviewed`.
4. **Changes** — each row is `marker status-letter path`, renames read as `old → new`.
   - Leading `●` definitely changed · `◐` possibly changed (inferred from a command; hover shows that command) · `○` unrelated to this session.
   - Trailing `○` / `✓` is the review mark — click it or press `v`; `✓` turning yellow means the file changed again and needs another look.
   - Click any row for that file's diff.
5. **Recent commits** — `shortsha subject [HEAD] 2026-10-16 14:18`; click a row to view that commit, click again to collapse.
6. **Tags** — newest first; click a row to view the commit it points at. A repository without tags says so.

Every timestamp is a **full date + time** in your local zone.

### Diffs, commit detail and images

- **Diff view**: two columns, toolbar with `Unstaged` / `Staged` / `Wrap lines` / `Copy diff`; click a hunk header to fold that hunk.
- **Commit view**: three columns — panel │ commit │ diff — and it opens the commit's first file for you.
- **Two grips to drag**: the one on the right edge sets the diff width (default 470px), the one right of the commit column sets that column's width (default 240px). Both widths are remembered.
- **Image changes**: files recognised as images (PNG / JPEG / GIF / WebP / BMP, **by file header, not by extension**) are drawn side by side with size and byte deltas (`size 1024×768 → 1024×512`, `2.0 KB → 1.0 KB`). When an image cannot be drawn the reason is stated: over the 4 MB per-side limit, not a previewable image, or that side missing (added / deleted).
- **Image zoom**: an always-visible `−` / step / `＋`, defaulting to fit-width, with steps 25% / 50% / 100% / 150% / 200% computed from the image's intrinsic pixels; clicking the step itself returns to fit-width. The step is remembered.

![An image change in the diff column: the toolbar, then a "side by side" toggle and − 100% ＋ zoom buttons, an amber "size 190×140 → 230×160" and "8.8 KB → 11.4 KB", and two images side by side labelled "index" and "worktree"](docs/images/image-diff.webp)

### Per-turn image changes

![Per-turn image changes: three thumbnails, two of them marked ◐ because they were inferred from commands, each followed by a ⇄, ending with "3 more"](docs/images/turn-images.webp)

The built-in "edited N files" card cannot show images, so the plugin puts its own door on that same turn tail:

- click a thumbnail → open that image in the built-in document preview on the right;
- click `⇄` → open this plugin's panel for a **before/after** comparison (the built-in preview only has the current version);
- only images touched **in this turn** are listed, newest first, up to 4 plus `N more`; when a turn touched no images the whole strip is not rendered;
- both attribution tiers are included: files written by tools count as certain, ones inferred from shell commands are marked `◐` (hover shows the command) — images are usually produced by scripts, so certain-only would often be empty.

### Sidebar session rows

The sidebar row itself carries no marks; the information is in the hover card or behind the row-end `⋯`:

```
main* ↑0 ↓0 · modified 7 untracked 2
3 file(s) changed by this session · 4 path(s) commands may have touched (1 still differ)
```

When clean it says `Working tree clean — nothing uncommitted` and `this session has no recorded changes`.

### Keyboard

**Click inside the panel first** (or Tab into it) before it takes over keys; clicking outside hands them back. Cmd/Ctrl/Alt combinations and keys typed in the composer are never touched.

| Key | Action |
| --- | --- |
| `↑` `↓` | Move the selected row (move only, does not open) |
| `Enter` | Open the selected row |
| `[` `]` | Previous / next file, opening it right away |
| `n` `p` | Next / previous hunk (folded ones expand) |
| `Space` | Fold / unfold the current hunk |
| `v` | Mark the current row as reviewed for this revision (press again to clear) |
| `r` | Re-read |
| `Esc` | Step back: collapse the right column (diff / commit) first, then the panel |

While viewing commit detail, `↑ ↓ Enter [ ]` act on that column's list.

### `↑` in the composer recalls your previous prompt

With the composer empty, `↑` brings back your previous prompt; keep pressing to walk further back, `↓` walks forward, and stepping past the newest returns you to your original draft.

- **Plain text only**: `/commands` and `@files` are text already, so they come back intact; attachments and images do not come back (they were never part of the prompt text).
- **Sourced from the session log** (the built-in `turnOutline` projection), not from a copy the plugin keeps — so restarts, paging and compaction do not affect it, and **prompts sent from another client can be recalled too**. If the host lacks that projection, the whole feature silently stays off.
- **It never takes over while the composer has content**, so `↑` in a multi-line draft is always just cursor movement, and it cannot fight the `/` command or `@` mention popups. Modifier keys, IME composition and a non-collapsed selection all make it step aside.
- Typing exits history mode, so a draft is never restored over new content.

> Implementation note: DSH's composer is a Lexical `contenteditable`, and a plugin cannot reach its internal model — so we simulate a paste (falling back to `execCommand`, then to writing text directly), and each tier re-reads the composer after the write has landed before deciding it succeeded. This is the only part of the plugin that touches the DOM; if DSH changes that structure it may stop working, in which case it silently disables itself.

## Development

- `src/host/**` — the host half's source (TypeScript; runs git, serves `/dsh-hud-rpc`), compiled file-by-file by `tsc` into `lib/host/**`.
- `src/client/**` — the browser half's source (TypeScript; depends only on the seed module `react`); `lib/client.js` is a **build artifact** (rolldown), because DSH loads exactly one classic script.
- Convention: `src/` is all source, `lib/` is all artifacts — `pnpm run build` rebuilds both halves (`tsc -p tsconfig.host.json` + `rolldown`), and artifacts are committed together with the source (DSH and the local profile read `lib/` directly).
- `pnpm test` — typecheck (both halves are under **full `strict`**) + the whole suite.
- `pnpm run format` — Prettier formats the sources (`.prettierrc.json`; `lib/` is artifacts and is not formatted); `pnpm run format:check` only checks.
- The package manager is pnpm: `pnpm-lock.yaml` is committed, and `pnpm-workspace.yaml` disables `autoInstallPeers` because DSH provides those client services at runtime.
- `docs/dock-slot-host.md` — a proposal for turning the row above the composer into a registrable inline host.
- **Releasing**: `pnpm run tag && pnpm publish`. `prepublishOnly` runs the tests and then verifies version ↔ git tag (clean tree, `v<version>` exists and points at HEAD); a mismatch blocks the publish.

## License

MIT
