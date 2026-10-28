# Zawal and Isha-end update

## Opt-in contract

Set `params.ihtiyat = 1` for the app, or a district's nonnegative finite margin in minutes. Explicit `0` is valid. With this field set, the Zawal/Dhuhr window replaces (does not add to) `adjustments.dhuhr` and `methodAdjustments.dhuhr`, and is centred on raw solar transit. `dhuhr === zawalEnd`; Dhuhr azan remains one minute later.

Leaving `ihtiyat` undefined preserves the legacy Dhuhr correction path for other library consumers. Its fixed constants remain intentionally as a compatibility fallback. This differs from the colleague's request to remove the constants globally, to avoid silently changing other methods and custom adjustments.

Precise mode uses raw transit, truncated to seconds by the existing TimeComponents conversion. Nonprecise mode keeps the existing nearest-minute transit rounding before offsets. No outward rounding or app display formatting change is included. Symmetry is exact to millisecond Date resolution around that mode's centre.

`ishaEnd` now means the following civil day's Sehri end. Its own enumerable, configurable, assignable Date property is populated lazily, avoiding recursive next-day construction. `currentPrayer` now advances during the day. A day's object still returns `none` before its first event; use the prior day's object to ask about that prior night's Isha after midnight. `nextPrayer` retains its existing single-day contract, returning `none` after Isha.

## Important diagnosis

The app's Karachi method already adds one minute before the fixed +64 seconds. Its actual precise Dhuhr start was raw transit +124 seconds, not +64 seconds. The reported one-minute early Dhuhr claim does not apply to that path. The new explicit margin replaces the method minute rather than double-counting it. Seasonal Dhuhr change is approximately -0.3 to +6.9 seconds; the beginning of Zawal moves from raw transit -3 minutes to about -2m04s through -2m11s.

The same-date half-width is a geocentric approximation evaluated at noon UTC, not a claim of submillisecond observational accuracy. The supplied five anchor vectors and the full 2026–2030 range were checked; the referenced independent 1,826-row CSV was not supplied.

## Verification and limits

- New source tests cover daily 2026–2030 half-width range, five anchors, two precision modes, 0/fractional/custom margins, invalid input, raw symmetry, no double correction, latitude/location independence, current-prayer transitions, midnight and year/leap-day rollover, and property serialization/assignment.
- Baseline full engine suite already had 20 failing tests (legacy upstream timing/currentPrayer expectations). The exact same test names fail after this update, with additional new tests passing. This is not a clean full-suite pass.
- Existing high-latitude MiddleOfNight behaviour can put next-day Sehri before Isha (London June/July). The new end faithfully reports next Sehri and does not invent an extra prayer window; redesigning high-latitude twilight rules is outside this change.
- Webpack 4 on Node 24 needs `NODE_OPTIONS=--openssl-legacy-provider npm run build`; this is a temporary build compatibility option, not a persistent configuration change.
- The app must consume the rebuilt package. Adding `ihtiyat` while retaining the registry's old `namaz@4.4.0` does not activate the new calculation. The local tarball is for verification only and keeps version 4.4.0; choose a new version, publish and update the app dependency/lockfile in an explicitly authorized release step. Nothing was published, pushed, merged or deployed.
