import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cityNameOf,
  isMetro,
  listRegionNames,
  featuresForRegion,
  pointInFeature,
  pointInRegion,
  regionFitPoints
} from "./region-filter.ts";

// 단순 사각형 폴리곤 (경기 남부 어딘가 흉내).
const square = (name, code, [minLng, minLat, maxLng, maxLat]) => ({
  type: "Feature",
  properties: { name, code },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]
    ]]
  }
});

const sido = {
  type: "FeatureCollection",
  features: [
    square("서울특별시", "11", [126.8, 37.4, 127.2, 37.7]),
    square("경기도", "31", [126.5, 36.9, 127.9, 38.3])
  ]
};

const sigungu = {
  type: "FeatureCollection",
  features: [
    square("종로구", "11010", [126.95, 37.55, 127.01, 37.63]),
    square("수원시장안구", "31011", [126.97, 37.28, 127.05, 37.33]),
    square("수원시권선구", "31012", [126.93, 37.23, 127.03, 37.28]),
    square("의정부시", "31030", [127.0, 37.7, 127.13, 37.78])
  ]
};

test("단위 분류 — 광역/도/시/구", () => {
  assert.equal(isMetro("서울특별시"), true);
  assert.equal(isMetro("경기도"), false);
  assert.deepEqual(listRegionNames("METRO", sido, sigungu), ["서울특별시"]);
  assert.deepEqual(listRegionNames("PROVINCE", sido, sigungu), ["경기도"]);
  // 시 = 단독 시 + 분할 구의 시 그룹
  assert.deepEqual(listRegionNames("CITY", sido, sigungu), ["수원시", "의정부시"]);
  assert.deepEqual(listRegionNames("DISTRICT", sido, sigungu), ["수원시권선구", "수원시장안구", "종로구"]);
});

test("시 이름 파생 — X시Y구 → X시", () => {
  assert.equal(cityNameOf("수원시장안구"), "수원시");
  assert.equal(cityNameOf("의정부시"), "의정부시");
  assert.equal(cityNameOf("종로구"), null);
});

test("시 그룹은 분할 구 전부를 폴리곤으로 갖는다", () => {
  const features = featuresForRegion("CITY", "수원시", sido, sigungu);
  assert.deepEqual(features.map((f) => f.properties.name).sort(), ["수원시권선구", "수원시장안구"]);
});

test("point-in-polygon — 내부/외부/구멍", () => {
  const f = square("테스트", "99", [127.0, 37.0, 127.1, 37.1]);
  assert.equal(pointInFeature(127.05, 37.05, f), true);
  assert.equal(pointInFeature(127.2, 37.05, f), false);

  const withHole = {
    ...f,
    geometry: {
      type: "Polygon",
      coordinates: [
        f.geometry.coordinates[0],
        [[127.04, 37.04], [127.06, 37.04], [127.06, 37.06], [127.04, 37.06], [127.04, 37.04]]
      ]
    }
  };
  assert.equal(pointInFeature(127.05, 37.05, withHole), false, "구멍 안은 제외");
  assert.equal(pointInFeature(127.02, 37.02, withHole), true, "구멍 밖 폴리곤 안은 포함");
});

test("권역 판정 — 시 그룹은 하나라도 포함이면 포함", () => {
  const region = {
    unit: "CITY",
    name: "수원시",
    features: featuresForRegion("CITY", "수원시", sido, sigungu)
  };
  assert.equal(pointInRegion(127.0, 37.3, region), true, "장안구 안");
  assert.equal(pointInRegion(126.98, 37.25, region), true, "권선구 안");
  assert.equal(pointInRegion(127.1, 37.75, region), false, "의정부는 밖");
});

test("fit 좌표 — 그룹 전체 bbox", () => {
  const region = {
    unit: "CITY",
    name: "수원시",
    features: featuresForRegion("CITY", "수원시", sido, sigungu)
  };
  const [sw, ne] = regionFitPoints(region);
  assert.equal(sw.longitude, 126.93);
  assert.equal(sw.latitude, 37.23);
  assert.equal(ne.longitude, 127.05);
  assert.equal(ne.latitude, 37.33);
});
