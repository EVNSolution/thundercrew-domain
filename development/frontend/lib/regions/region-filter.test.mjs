import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isMetro,
  splitCityOf,
  listSidoNames,
  listBasicNames,
  listSubNames,
  regionForSelection,
  pointInFeature,
  pointInRegion,
  regionFitPoints
} from "./region-filter.ts";

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
    square("의정부시", "31030", [127.0, 37.7, 127.13, 37.78]),
    square("가평군", "31037", [127.3, 37.7, 127.6, 38.0])
  ]
};

const emd = {
  type: "FeatureCollection",
  features: [
    square("사직동", "1101053", [126.96, 37.56, 126.98, 37.58]),
    square("의정부1동", "3103051", [127.02, 37.72, 127.06, 37.75]),
    square("청평면", "3103752", [127.4, 37.72, 127.5, 37.78])
  ]
};

test("행정 3단계 — 시·도/기초/하부 목록", () => {
  assert.deepEqual(listSidoNames(sido), ["경기도", "서울특별시"]);
  assert.equal(isMetro("서울특별시"), true);
  assert.equal(splitCityOf("수원시장안구"), "수원시");
  assert.equal(splitCityOf("종로구"), null);

  // 2단계: 광역시 자치구 + 도의 시·군 (분할시는 시로 묶임)
  assert.deepEqual(listBasicNames("서울특별시", sido, sigungu), ["종로구"]);
  assert.deepEqual(listBasicNames("경기도", sido, sigungu), ["가평군", "수원시", "의정부시"]);

  // 3단계: 분할시 → 일반구, 단일 기초 → 읍·면·동
  assert.deepEqual(listSubNames("경기도", "수원시", sido, sigungu, null), ["권선구", "장안구"]);
  assert.deepEqual(listSubNames("경기도", "의정부시", sido, sigungu, emd), ["의정부1동"]);
  assert.deepEqual(listSubNames("경기도", "가평군", sido, sigungu, emd), ["청평면"]);
  assert.deepEqual(listSubNames("서울특별시", "종로구", sido, sigungu, emd), ["사직동"]);
  // emd 미로드 시 빈 배열 (분할시 아님)
  assert.deepEqual(listSubNames("서울특별시", "종로구", sido, sigungu, null), []);
});

test("regionForSelection — 가장 구체적인 선택이 이긴다", () => {
  const emdRegion = regionForSelection({ sido: "경기도", basic: "가평군", sub: "청평면" }, sido, sigungu, emd);
  assert.equal(emdRegion.unit, "EMD");
  assert.deepEqual(emdRegion.features.map((f) => f.properties.name), ["청평면"]);

  const districtRegion = regionForSelection({ sido: "경기도", basic: "수원시", sub: "장안구" }, sido, sigungu, null);
  assert.equal(districtRegion.unit, "DISTRICT");
  assert.deepEqual(districtRegion.features.map((f) => f.properties.name), ["수원시장안구"]);

  const basicRegion = regionForSelection({ sido: "경기도", basic: "수원시", sub: "" }, sido, sigungu, null);
  assert.deepEqual(basicRegion.features.map((f) => f.properties.name).sort(), ["수원시권선구", "수원시장안구"]);

  const seoulGu = regionForSelection({ sido: "서울특별시", basic: "종로구", sub: "" }, sido, sigungu, null);
  assert.deepEqual(seoulGu.features.map((f) => f.properties.name), ["종로구"]);

  const sidoRegion = regionForSelection({ sido: "경기도", basic: "", sub: "" }, sido, sigungu, null);
  assert.equal(sidoRegion.unit, "PROVINCE");

  assert.equal(regionForSelection({ sido: "", basic: "", sub: "" }, sido, sigungu, null), null);
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

test("권역 판정과 fit — 분할시 그룹", () => {
  const region = regionForSelection({ sido: "경기도", basic: "수원시", sub: "" }, sido, sigungu, null);
  assert.equal(pointInRegion(127.0, 37.3, region), true, "장안구 안");
  assert.equal(pointInRegion(126.98, 37.25, region), true, "권선구 안");
  assert.equal(pointInRegion(127.1, 37.75, region), false, "의정부는 밖");

  const [sw, ne] = regionFitPoints(region);
  assert.equal(sw.longitude, 126.93);
  assert.equal(ne.latitude, 37.33);
});
