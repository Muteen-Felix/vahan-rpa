import type {
  Job,
  Runner,
  UiHealthCheckNowResponse,
  UiHealthReportsResponse,
  UiHealthSchedule,
  VahanFilters,
} from "../contracts";

export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  runners: () => request<Runner[]>("/api/runners"),
  uiHealthSchedule: () => request<UiHealthSchedule>("/api/ui-health/schedule"),
  updateUiHealthSchedule: (intervalDays: number) =>
    request<UiHealthSchedule>("/api/ui-health/schedule", {
      method: "PUT",
      body: JSON.stringify({ intervalDays }),
    }),
  runUiHealthCheckNow: (runnerId?: string) =>
    request<UiHealthCheckNowResponse>("/api/ui-health/run-now", {
      method: "POST",
      body: JSON.stringify(runnerId ? { runnerId } : {}),
    }),
  uiHealthReports: (date?: string) => request<UiHealthReportsResponse>(
    `/api/ui-health/reports${date ? `?date=${encodeURIComponent(date)}` : ""}`,
  ),
  createJob: (runnerId: string, filters: VahanFilters) =>
    request<Job>("/api/jobs", {
      method: "POST",
      body: JSON.stringify({ runnerId, filters }),
    }),
  getJob: (jobId: string) => request<Job>(`/api/jobs/${jobId}`),
  cancelJob: (jobId: string) => request<Job>(`/api/jobs/${jobId}/cancel`, { method: "POST" }),
};
