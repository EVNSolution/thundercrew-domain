import { useEffect, useRef, useState } from 'react';
import {
  TICK_INTERVAL_MS,
  advanceFleet,
  randomPointNear,
  type SimulatedVehicle,
} from './fleet-simulation';
import { ZONES, initialFleet, zoneById } from '../../mock/delivery-control';

/** 시뮬레이션 on/off. 실차량 텔레메트리가 들어오면 이 변수를 내리면 된다. */
export const simulationEnabled = ['1', 'true', 'yes', 'on'].includes(
  (import.meta.env.VITE_TC_SIMULATION ?? '').toString().trim().toLowerCase(),
);

/**
 * 시뮬레이션 시간 가속 배율.
 *
 * 실시간(1x)으로는 30km/h 차량이 zoom 11 에서 초당 0.1픽셀 움직여 보이지 않는다.
 * 기본 60x 로 두면 초당 약 6픽셀 이동해 눈에 들어온다.
 */
export const simulationSpeed = (() => {
  const raw = Number.parseFloat((import.meta.env.VITE_TC_SIMULATION_SPEED ?? '').toString());
  if (!Number.isFinite(raw) || raw <= 0) return 60;
  return Math.min(600, raw);
})();

/**
 * 시뮬레이션 루프. 켜져 있을 때만 타이머를 돌린다.
 * 꺼져 있으면 초기 배치를 그대로 반환해서 정지된 핀만 보여준다.
 */
export function useFleetSimulation(): {
  fleet: readonly SimulatedVehicle[];
  running: boolean;
} {
  const [fleet, setFleet] = useState<readonly SimulatedVehicle[]>(() => initialFleet(Date.now()));
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!simulationEnabled) return;
    if (typeof window === 'undefined') return;

    lastTickRef.current = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;
      setFleet((current) =>
        advanceFleet(
          current,
          now,
          elapsed,
          (vehicle) => {
            const zone = zoneById(vehicle.zoneId) ?? ZONES[0];
            return randomPointNear(zone.center, 2.5, Math.random);
          },
          Math.random,
          simulationSpeed,
        ),
      );
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return { fleet, running: simulationEnabled };
}
