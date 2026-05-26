export interface CleaningSchedule {
  id: string;              // UUID
  bikeId: string;          // UUID
  bikePlateNumber: string;
  scheduledAt: string;     // ISO-8601 LocalDateTime: "2026-06-01T10:00:00"
  address: string;
  memo?: string | null;
}

export interface CleaningScheduleCreateInput {
  bikeId: string;          // UUID
  scheduledAt: string;     // ISO-8601: "2026-06-01T10:00:00"
  address: string;
  memo?: string;
}

const BASE = process.env.NEXT_PUBLIC_SERVICE_OPS_API_BASE_URL ?? "";

export async function createCleaningSchedule(
  input: CleaningScheduleCreateInput
): Promise<CleaningSchedule> {
  const res = await fetch(`${BASE}/api/v1/cleaning-schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createCleaningSchedule failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<CleaningSchedule>;
}

export async function fetchCleaningSchedules(bikeId: string): Promise<CleaningSchedule[]> {
  const res = await fetch(`${BASE}/api/v1/cleaning-schedules?bikeId=${encodeURIComponent(bikeId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`fetchCleaningSchedules failed: ${res.status}`);
  }
  return res.json() as Promise<CleaningSchedule[]>;
}
