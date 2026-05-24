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

### Filter state stays mode-local (not shared)

Per the design decision, fullscreen mode and the in-page table mode
each own their own filter state. There's no lifting into context, no
sync mechanism between them. Opening fullscreen starts from default
filters; closing leaves the table panels' filters untouched.

The existing `VehicleFilterContext` keeps its shape (selected bike +
in-page bike visibility channel). The fullscreen overlay's filter
state lives entirely inside the overlay component (three `useState`
hooks, one per slice). The overlay's filter state survives until the
overlay is unmounted (i.e., across collapse/expand of accordion
sections or interaction within the same fullscreen session, but NOT
across opening fullscreen twice).

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

### Combined visibility for the fullscreen map

Inside the fullscreen overlay, the marker set is derived locally from
the overlay's own filter state:

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

Both are computed inside `FullscreenMapOverlay` with `useMemo` and
passed straight to its `MapShell`. They never enter the shared
context — the in-page map under `OverviewMapBanner` keeps its
existing behavior (only vehicle filters affect bike markers via the
existing `filteredBikeIds` channel, stations are never filtered).

### Table-side compute stays exactly as today

`VehiclesPanel`, `RidersPanel`, `StationsPanel` keep their existing
local filter `useState` and visibility computation. The only
refactor on the table side: each panel's local visibility logic
becomes a call into the same extracted pure helper
(`applyVehicleFilters` / `applyRiderFilters` /
`applyStationFilters`), so the fullscreen overlay can call the same
function on its own state without duplicating logic. The panel's
behavior is bit-for-bit identical to today.

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

Closing the overlay: the overlay (and its filter state) is unmounted.
The in-page table re-appears with whatever filters it had before
fullscreen opened — they're independent state, never modified by the
overlay. The `selectedBikeId` (which lives in the shared context, not
in the overlay) is preserved across the toggle.

Re-opening the fullscreen overlay starts with default filter values.
Operators who want the same view twice need to re-enter their
filters — accepted UX trade-off per the "no filter sharing" design
decision.

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
- ESC or `[✕ 닫기]` returns to the page. Table reappears with its own
  filter state untouched. The bike selected for the detail panel
  (if any) is preserved (it lives in shared context).
- Re-opening fullscreen starts with default filters — overlay state
  is unmounted on close.
- Within fullscreen, accordion sections collapse/expand
  independently. Collapsed state is local (not persisted on close).

## Error handling & edge cases

- **Rider filter "ALL"**: rider filtering effectively becomes a
  pass-through — visible bikes = vehicle filter result. Bikes with no
  assigned rider are visible.
- **Rider filter not "ALL", bike has no rider**: the bike is filtered
  out — its rider couldn't possibly match a non-ALL rider filter.
- **All filters at defaults**: visible sets fall back to "show
  everything" — the overlay's compute returns the full bike/station
  arrays unchanged. `MapShell` renders them all.
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
- Filter state in 차량/라이더/BSS tabs is NOT touched by the
  fullscreen overlay (open → apply some filters in fullscreen → close
  → tab filters are unchanged).
- Re-opening fullscreen starts with defaults (overlay state is
  unmounted on close).
- ESC closes overlay.
- Filter row in 차량 / 라이더 / BSS tabs still works identically
  (regression check on the refactor — same helpers, same behavior).

## Out-of-scope follow-ups

- Filter persistence across reload (localStorage).
- Keyboard navigation across filter controls.
- Mobile / small-viewport layout (current target is desktop ops console).
- Rider detail panel inside the map canvas.
- BSS detail panel inside the map canvas.
- "Save filter preset" UX.
