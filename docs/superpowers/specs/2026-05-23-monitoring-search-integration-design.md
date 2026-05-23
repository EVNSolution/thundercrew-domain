# Monitoring-style Search on the Root Page — Design

## Goal

Bring back the old `/monitoring` page's search experience as part of the
root page (`/`), so an operator can type a vehicle plate, a BSS name, or a
rider's name/phone and immediately jump to that target on the live map.

The old `/monitoring` route was retired into a permanent redirect to `/`
once the single-page integration landed, but the underlying components
(`MonitoringSearch`, `BikeDetailPanel`, `StationDetailPanel`,
`DashboardCanvas`, `MapShell`) are all still in the codebase. The root
page already shows a global "지도 보기" toggle (`OverviewMapBanner`) that
mounts `MapShell` with bike + station pins, and a context-driven
`VehicleDetailDialog` opens whenever `selectedBikeId` is published into
`VehicleFilterContext`. What's missing is the search affordance and the
"select → auto-open map + pan + open detail" choreography.

## Non-Goals

- No new route. `/monitoring` stays a redirect; the search lives on `/`.
- No BSS detail panel. A BSS hit pans the map only.
- No polling change. The root page keeps doing one SSR fetch, same as today.
- No keyboard navigation, recent searches, or advanced query syntax.
- No backend changes. Search is 100% client-side over data the root page
  already passes down.

## Architecture

### Placement

`OverviewMapBanner` already owns the toggle row at the top of its
section and the map canvas below. The search input lives in that
toggle row, between the toggle label and the existing count hint, with
its dropdown anchored under the input:

```
[ ☐ 지도 보기 ]  [ search input (flex-grow) ]  [ N대 차량 · M개 BSS ]
                  └─ dropdown (absolute) ───────┘
```

The search bar stays visible whether the map is open or closed. When the
operator picks a result, `OverviewMapBanner` flips the toggle on as part
of the same click handler — they don't need to open the map manually
first.

### New component: `OverviewMapSearch`

A new client component under `components/overview/OverviewMapSearch.tsx`
modeled after `MonitoringSearch.tsx`, but supporting three result kinds:

- **`bike`** — matched by `plateNumber` substring against `bikePins`.
  Label = plate number, sublabel = `modelName`. Selecting it produces
  `{ kind: "bike", bikeId, latitude, longitude }`.
- **`station`** — matched by `name` or `address` substring against
  `stationPins`. Label = station name, sublabel = address. Selecting it
  produces `{ kind: "station", latitude, longitude }`.
- **`rider`** — matched by `name` or `phoneNumber` substring against the
  rider info map. Each candidate is filtered to riders who currently have
  a bike assigned (via `bikeActiveRiderById`). Label = rider name,
  sublabel = `phoneNumber · plateNumber-of-paired-bike`. Selecting it
  produces `{ kind: "rider", bikeId, latitude, longitude }` — the bike's
  lat/lng so the map can pan there immediately.

Result list is capped at 8 entries total (same as old `MonitoringSearch`),
filled in a fixed kind order — bikes first, then riders, then stations —
and truncated at 8. Matches that bring the total above 8 are dropped from
the end of the list. The bike-first ordering matches the operator's most
common task (find a specific vehicle) and mirrors the old monitoring
search behavior where bikes preceded stations.

### Wiring inside `OverviewMapBanner`

The component already holds the `open` state and reads `selectedBikeId`
from `VehicleFilterContext`. The change is additive:

1. A new `targetLocationOverride` state that `OverviewMapSearch` can set
   independently of the bike-based `targetLocation` derivation. When a
   BSS hit is selected, only this override is set; the existing
   bike-based path stays untouched. Each set produces a fresh object so
   `MapShell` re-pans even on the same target.
2. A select handler that, for every kind:
   - sets `open` to `true` (auto-open),
   - sets `targetLocationOverride` to the result's lat/lng,
   - for `bike` / `rider` kinds, also calls
     `setSelectedBikeId(result.bikeId)` so the existing
     `VehicleDetailDialog` flow lights up.
3. `targetLocation` passed to `MapShell` becomes the latest of the
   override and the bike-derived target: search wins on the click, but
   the bike-follow effect still works after.

The rider-search resolution needs a small helper: invert
`bikeActiveRiderById` (which is `Map<bikeId, riderId>`) into a
`Map<riderId, bikeId>` so a rider hit can find its paired bike. This
inversion is memoized inside `OverviewMapSearch`.

### Data sources (no new fetches)

`OverviewMapBanner` already receives:

- `bikePins: ReadonlyArray<FrontendDashboardBikePin>` — search source for
  bikes, also lat/lng for "go to bike".
- `stationPins: ReadonlyArray<FrontendDashboardStationPin>` — search
  source for BSS.
- `bikeActiveRiderById?: Map<string, string>` (bike → rider) — used to
  resolve a rider hit to a bike.
- `riderInfoById?: Map<string, { name: string; phone: string }>` —
  search source for riders.

Nothing else needs to be plumbed through the page.

## User-visible behavior

- Typing in the empty input shows no dropdown. The dropdown appears when
  the input is focused **and** there are matches.
- Result categories are visually grouped with a small kind chip (차량 /
  BSS / 라이더) on the left of each row.
- Clicking a result:
  - Closes the dropdown and clears the input.
  - If the map is closed, it opens immediately (the toggle goes on with
    the same click).
  - The map pans to the target (and, for bikes/riders, the
    `VehicleDetailDialog` opens inside the canvas as it already does on
    table-row clicks).
- Clicking outside the input closes the dropdown without committing.

## Error handling & edge cases

- **No bikePins / no stationPins / no rider maps**: the search just
  returns no matches in that category. The dropdown can still show
  matches from the categories that have data.
- **Rider without an assigned bike**: filtered out at match time — they
  have no map target so a result row would lead nowhere.
- **Stale rider info**: rider's name was changed since the page render —
  the search runs over the snapshot the page passed down. A refresh
  picks up the new name; we don't refetch on every keystroke.
- **Selecting a bike that disappeared between render and click**:
  `OverviewMapBanner` already handles the lookup of `bikePin` from
  `bikePinById`; if it's gone, the existing code path falls back
  gracefully and no panel opens.
- **Map toggle and bike-detail follow**: the existing follow effect that
  re-pans to a moving selected bike must still work. The search-target
  override is just another input to the same `targetLocation` prop, and
  the latest set wins.

## Testing

- **Manual smoke**:
  - Type a partial plate that matches one bike — pick it — map opens to
    that bike with the detail dialog inside the canvas.
  - Type a rider name — pick it — map opens, pans to the bike that rider
    is currently on, detail dialog shows that bike + the rider's name /
    phone in the existing fields.
  - Type a BSS name or address — pick it — map opens, pans to the BSS,
    no detail dialog.
  - With map already open: a click on a result doesn't toggle it shut.
- **Static checks**: `npm run typecheck`, `npm run lint`.

## Out-of-scope follow-ups

- Polling and live-updates on `/` (would also help the existing
  `OverviewMapBanner` independent of search).
- Backend full-text search for cross-tenant lookups beyond the on-page
  snapshot.
- Rider detail dialog inside the map canvas (today riders are only
  visible via the bike they're paired with).
- BSS detail panel inside the map canvas.
