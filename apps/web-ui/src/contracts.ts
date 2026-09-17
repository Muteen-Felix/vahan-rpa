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

export type JobStatus =
  | "QUEUED"
  | "ASSIGNED"
  | "OPENING_VAHAN"
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
  captchaId?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
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
