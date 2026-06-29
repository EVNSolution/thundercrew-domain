import assert from "node:assert/strict";
import test from "node:test";

import { mergeTrack, interpolateAt, isPlayable } from "./real-vehicle-playback.ts";

test("interpolateAt clamps before first point", () => {
  const track = [{ lat: 0, lng: 0, t: 100 }, { lat: 10, lng: 20, t: 200 }];
  assert.deepEqual(interpolateAt(track, 50), { lat: 0, lng: 0 });
});

test("interpolateAt clamps after last point (parked/stale)", () => {
  const track = [{ lat: 0, lng: 0, t: 100 }, { lat: 10, lng: 20, t: 200 }];
  assert.deepEqual(interpolateAt(track, 500), { lat: 10, lng: 20 });
});

test("interpolateAt linear midpoint", () => {
  const track = [{ lat: 0, lng: 0, t: 100 }, { lat: 10, lng: 20, t: 200 }];
  assert.deepEqual(interpolateAt(track, 150), { lat: 5, lng: 10 });
});

test("interpolateAt single point returns that point", () => {
  assert.deepEqual(interpolateAt([{ lat: 3, lng: 4, t: 100 }], 999), { lat: 3, lng: 4 });
});

test("interpolateAt empty returns null", () => {
  assert.equal(interpolateAt([], 100), null);
});

test("mergeTrack dedups by t, sorts, drops below floor", () => {
  const existing = [{ lat: 0, lng: 0, t: 100 }, { lat: 1, lng: 1, t: 200 }];
  const incoming = [{ lat: 9, lng: 9, t: 200 }, { lat: 2, lng: 2, t: 300 }];
  const merged = mergeTrack(existing, incoming, 150);
  assert.deepEqual(merged.map((p) => p.t), [200, 300]);
  assert.deepEqual(merged[0], { lat: 9, lng: 9, t: 200 });
});

test("isPlayable needs >= 2 points", () => {
  assert.equal(isPlayable([{ lat: 0, lng: 0, t: 1 }]), false);
  assert.equal(isPlayable([{ lat: 0, lng: 0, t: 1 }, { lat: 1, lng: 1, t: 2 }]), true);
});
