# Fullscreen Map Mode with Unified Filters — Design

## Goal

Add a "전체화면" mode to the root page `/` where the map takes over the
entire viewport (sidebar + header included) and operators get all the
management filters — vehicles, riders, BSS — bundled into a left-side
collapsible filter panel. The intent is to recreate the old
`/monitoring` page's feel inside the root page without spawning a
separate route.

The smaller `OverviewMapSearch` that landed in #282 (inline search in
the toggle row) stays put — the new fullscreen mode is a separate layer
above the existing inline search.

## Non-Goals

- No new route. Fullscreen is a fixed-position overlay above `/`.
- No backend changes.
- No keyboard shortcuts beyond `Escape` to close.
- No filter persistence across browser sessions (Esc / close button
  doesn't reset filters, but a hard reload does — that's the existing
  table-side behavior too).
- BSS detail panel still NOT added — same scope decision as #282.
- Rider detail panel inside the map canvas — out of scope.

## Architecture

### Three concerns to lift into shared state

The root page already wraps a `VehicleFilterContext` provider around
the client tabs. Today that context carries:

- `filteredBikeIds: ReadonlySet<string> | null` — derived visibility set
  published by `VehiclesPanel`
- `selectedBikeId` + setter — bike picked from row click / marker click

For the fullscreen mode we need the **raw filter state** to live in
the context, plus a **second visibility channel** for stations:

```ts
type FilterContextValue = {
  // raw filter state (lifted from each panel)
  vehicleFilters: VehicleFilterState;
  setVehicleFilters: (next: VehicleFilterState) => void;
  riderFilters: RiderFilterState;
  setRiderFilters: (next: RiderFilterState) => void;
  stationFilters: StationFilterState;
  setStationFilters: (next: StationFilterState) => void;

  // derived visibility (computed and published by panels OR by fullscreen)
  filteredBikeIds: ReadonlySet<string> | null;
  setFilteredBikeIds: (ids: ReadonlySet<string> | null) => void;
  filteredStationIds: ReadonlySet<string> | null;
  setFilteredStationIds: (ids: ReadonlySet<string> | null) => void;

  // selected for detail panel
  selectedBikeId: string | null;
  setSelectedBikeId: (id: string | null) => void;
};
```

The three `*Filters` slices replace the per-panel `useState` calls.
`VehiclesPanel`, `RidersPanel`, `StationsPanel` read from context
instead of owning state. When fullscreen mode is open the panels are
unmounted (table area is hidden behind the overlay), so the overlay
becomes the owner of the same state — close fullscreen → panels
re-mount → see the same filter state. State sharing is achieved by
having a single source of truth, not by sync mechanisms.

### Filter UI extraction (DRY)

Each panel's filter row is split out into a presentational component
that accepts a `layout: "horizontal" | "vertical"` prop:

- `VehicleFilterControls` — 6 controls (query / engineType /
  operationStatus / connection / ignition / maintenance)
- `RiderFilterControls` — 6 controls (query / education / assignment /
  contractCategory / insurance / ignition)
- `StationFilterControls` — 2 controls (query / stock)

Horizontal layout = the current toggle-row look; vertical layout =
stacked for the fullscreen left aside.

### Filter computation extraction (pure)

The visibility computation in each panel becomes a pure helper that
takes raw data + filter state and returns the matching ID set:

- `applyVehicleFilters({ vehicles, bikePinById, ignitionStatusByBikeId,
  maintenanceSummaryByBike, filters }): Set<vehicleId>`
- `applyRiderFilters({ riders, educationTypeByRiderId, ...
  filters }): Set<riderId>`
- `applyStationFilters({ stations, filters }): Set<stationId>`

Each panel computes its own visible-IDs the same way it does today,
just by calling the extracted helper. The fullscreen overlay computes
all three and combines.

### Combined visibility for the map (single source of truth)

The map marker set must be the SAME computation no matter which mode
is rendering it — otherwise operators would see different markers for
identical filter state when toggling fullscreen. To avoid that, the
combined visibility is computed in ONE place and consumed by both
maps:

- **Visible bike IDs** =
  `applyVehicleFilters(...)`
  ∩
  `{ bikeId | bikeActiveRiderById.get(bikeId) ∈ applyRiderFilters(...) }`

  The rider filter narrows the bike set by selecting bikes whose
  assigned rider matches the rider filter. Bikes with no rider are
  included only if `riderFilters` is at its defaults (i.e. no rider
  filtering is in effect) — otherwise they're filtered out because
  "no rider matches the rider filter."

- **Visible station IDs** = `applyStationFilters(...)`.

These two sets live in the context as `filteredBikeIds` and
`filteredStationIds`. The provider itself derives them with
`useMemo` from the raw filter slices + the data the root page already
hands to the provider (`vehicles`, `riders`, `stations`,
`bikeActiveRiderById`, the lookup maps). Panels and the fullscreen
overlay are consumers, not writers.

**Behavior consequence**: rider and station filters now also affect
the in-page map (under the existing "지도 보기" toggle), not just the
fullscreen overlay. This is intentional and matches the operator's
expectation that "shared filter state" means consistent map behavior.
The vehicle table still filters its OWN rows by vehicle filters only
(unchanged); the rider table by rider filters only; the station table
by station filters only. The map is where the combined set applies.

### Table-side compute stays per-panel

Each panel computes its OWN table-visible rows from its filter slice:

- `VehiclesPanel`'s `visibleVehicles` = `applyVehicleFilters(...)`
- `RidersPanel`'s `visibleRiders` = `applyRiderFilters(...)`
- `StationsPanel`'s `visibleStations` = `applyStationFilters(...)`

These don't publish — they're local to the panel's row rendering.
Only the provider publishes to `filteredBikeIds` /
`filteredStationIds`, eliminating any writer-conflict.

### Fullscreen overlay structure

```
<div className="fullscreen-map-overlay">  position: fixed; inset: 0; z-index: 100
  <header className="fullscreen-map-header">
    [닫기 ✕]  <OverviewMapSearch ... />  [counts: N대 차량 · M개 BSS]
  </header>
  <aside className="fullscreen-map-filters">  position: left, collapsible
    <CollapsibleSection title="차량">
      <VehicleFilterControls layout="vertical" />
    </CollapsibleSection>
    <CollapsibleSection title="라이더">
      <RiderFilterControls layout="vertical" />
    </CollapsibleSection>
    <CollapsibleSection title="BSS">
      <StationFilterControls layout="vertical" />
    </CollapsibleSection>
  </aside>
  <main className="fullscreen-map-canvas">
    <MapShell bikePins={visibleBikes} stationPins={visibleStations} ... />
    <VehicleDetailDialog row={detailRow} ... />
  </main>
</div>
```

### Entering / exiting fullscreen

- A new `[⛶ 전체화면]` button next to the existing `[지도 보기]`
  toggle in `OverviewMapBanner`'s header row.
- Click opens the overlay. The overlay can also auto-open the existing
  `open` state of the in-page map (no need — they're independent).
- ESC key listener on the overlay closes it.
- A `[✕ 닫기]` button in the overlay header closes it.

Closing the overlay: the filter state stays put in context, the
in-page table re-appears with the same filters applied. The selected
bike (if any) also stays selected; if the operator entered fullscreen
with a bike selected, they leave it the same way.

### z-index map

The overlay sits at `z-index: 100`. AppShell sidebar/header are below
(default stacking) — `position: fixed; inset: 0` covers them anyway.
Existing `VehicleDetailDialog` floating panel is rendered inside the
overlay's `<main>`, so it inherits the overlay's stacking context and
shows above the map without needing its own high z-index.

## User-visible behavior

- `/` initial: same as today (table + small toggleable map section,
  inline search in the toggle row).
- Click `[⛶ 전체화면]`: viewport flips to map-only. Left aside shows
  filter accordion (defaults all expanded). Search bar stays usable.
- Filter changes immediately reflect on the map markers.
- Marker click or search-result click opens the same
  `VehicleDetailDialog` inside the overlay (top-right floating).
- ESC or `[✕ 닫기]` returns to the page. Table reappears with the same
  filter state. Selected bike (if any) is preserved.
- Within fullscreen, accordion sections collapse/expand
  independently. Collapsed state is local (not persisted on close).

## Error handling & edge cases

- **Rider filter "ALL"**: rider filtering effectively becomes a
  pass-through — visible bikes = vehicle filter result. Bikes with no
  assigned rider are visible.
- **Rider filter not "ALL", bike has no rider**: the bike is filtered
  out — its rider couldn't possibly match a non-ALL rider filter.
- **All filters at defaults**: visible sets fall back to "show
  everything" (the panels publish `null` to `filteredBikeIds` /
  `filteredStationIds`, which `MapShell` reads as "no filtering").
- **Selected bike disappears under new filter**: the marker doesn't
  render but the detail panel does — it's keyed off context state
  rather than visible IDs. This matches the existing behavior of the
  in-page map.
- **Fullscreen open while bike detail dialog is open**: dialog stays
  open inside the overlay (same component, same context).
- **Sidebar nav links / logout button**: hidden under the overlay.
  Operator must close fullscreen first. ESC is the escape hatch.

## Testing

The repo has no test runner; verification is `npm run typecheck`,
`npm run lint`, plus the manual smoke checklist:

- Toggle fullscreen open + close — table area hidden / restored.
- Apply each of the 14 filters; observe bike or station markers
  narrow accordingly.
- Combined filters: e.g. 차량.engineType = ELECTRIC + 라이더.education
  = ONLINE → only electric bikes whose riders have online education
  pass through.
- Filter persists across mode toggles.
- ESC closes overlay.
- Filter row in 차량 / 라이더 / BSS tabs still works identically
  (regression check on the refactor).

## Out-of-scope follow-ups

- Filter persistence across reload (localStorage).
- Keyboard navigation across filter controls.
- Mobile / small-viewport layout (current target is desktop ops console).
- Rider detail panel inside the map canvas.
- BSS detail panel inside the map canvas.
- "Save filter preset" UX.
