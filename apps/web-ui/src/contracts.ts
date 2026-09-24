export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export type RunnerStatus = "ONLINE" | "BUSY" | "RECONNECTING";

export interface Runner {
  id: string;
  name: string;
  version?: string | null;
  status: RunnerStatus;
  currentJobId?: string | null;
  lastSeenAt: string;
}

export interface UiHealthSchedule {
  intervalDays: number;
  updatedAt: string;
  nextCheckAt: string;
}

export interface UiHealthCheckNowResponse {
  ok: boolean;
  requestId: string;
  runnerId: string;
  runnerName: string;
  requestedAt: string;
  status: "REQUESTED";
}

export interface PendingUiHealthCheck {
  requestId: string;
  requestedAt: string;
}

export interface UiHealthDaySummary {
  date: string;
  total: number;
  pass: number;
  dataChanged: number;
  dataChangedErrors: number;
  uiDrift: number;
  uiDriftErrors: number;
  checkError: number;
  latestCheckedAt: string;
}

export interface UiHealthReportFile {
  fileName: string;
  fromDate: string;
  toDate: string;
  part: number;
  rowCount: number;
  sizeBytes: number;
  updatedAt: string;
  containsSelectedDate: boolean;
  downloadUrl: string;
}

export interface UiHealthReportsResponse {
  selectedDate: string | null;
  availableDates: UiHealthDaySummary[];
  reports: UiHealthReportFile[];
  rows: Array<Record<string, string>>;
}

export type JobStatus =
  | "QUEUED"
  | "ASSIGNED"
  | "OPENING_VAHAN"
  | "CAPTURING_CAPTCHA"
  | "FILLING_FILTERS"
  | "WAITING_CAPTCHA"
  | "SUBMITTING"
  | "WAITING_RESULT"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface VahanFilters {
  states: string[];
  rtos: string[];
  categoryGroups: string[];
  fuels: string[];
  archivedFlags?: string[];
  period?: string;
  financialYears?: string[];
  reportYear?: string;
  reportMonth?: string;
  fromYear?: string;
  toYear?: string;
  fromDate?: string;
  toDate?: string;
  delhiNcr?: string;
  emissions?: string[];
  makers?: string[];
  subCategories?: string[];
  classes?: string[];
  evTypes?: string[];
  statuses?: string[];
  ownerTypes?: string[];
  vehicleType?: string;
  fitness?: string;
  yAxis: string;
  xAxis: string;
  autoApply: boolean;
  autoExport: boolean;
}

export interface Scenario {
  name: string;
  filters: VahanFilters;
}

export interface Job {
  id: string;
  runnerId: string;
  status: JobStatus;
  filters: VahanFilters & Record<string, unknown>;
  scenarioName?: string | null;
  captchaId?: string | null;
  error?: string | null;
  excelFileName?: string | null;
  excelFileSize?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedReportItem {
  jobId: string;
  scenarioName: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  downloadUrl: string;
}

export interface CaptchaChallenge {
  jobId: string;
  captchaId: string;
  imageDataUrl: string;
  invalid?: boolean;
  refreshed?: boolean;
}

export interface Acknowledgement {
  ok: boolean;
  error?: string;
  job?: Job;
  captcha?: CaptchaChallenge;
}
