import { useEffect, useRef, useState } from "react";

import type { ExportedReportItem } from "../contracts";
import { AuthenticatedDownload } from "./AuthenticatedDownload";
import { api } from "../services/api-client";

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function reportDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDay(date: string): string {
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function formatDateDraft(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateDraft(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${yearText}-${monthText}-${dayText}`;
}

function monthFromDateKey(date: string): Date {
  const [year, month] = date.split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
}

export function ExportedReportsList({ refreshTrigger }: { refreshTrigger?: number }) {
  const [reports, setReports] = useState<ExportedReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1, 12);
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarInitialized = useRef(false);
  const calendarPickerRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseDateDraft(dateInput);
  const dateInputHasValue = dateInput.length > 0;
  const dateInputIncomplete = dateInputHasValue && dateInput.length < 10;
  const dateInputInvalid = dateInputHasValue && !selectedDate;

  const filteredReports = selectedDate
    ? reports.filter((report) => reportDateKey(report.createdAt) === selectedDate)
    : dateInputHasValue && !dateInputIncomplete ? [] : reports;
  const reportCountLabel = filteredReports.length === 1 ? "file" : "files";
  const reportDates = new Set(reports.map((report) => reportDateKey(report.createdAt)).filter(Boolean));
  const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 12);
  const firstWeekdayOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCellCount = Math.ceil((firstWeekdayOffset + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: calendarCellCount }, (_, index) => {
    const day = index - firstWeekdayOffset + 1;
    if (day < 1 || day > daysInMonth) return null;
    const month = String(calendarMonth.getMonth() + 1).padStart(2, "0");
    const dayText = String(day).padStart(2, "0");
    const date = `${calendarMonth.getFullYear()}-${month}-${dayText}`;
    return { day, date, hasReports: reportDates.has(date) };
  });

  useEffect(() => {
    if (calendarInitialized.current || reports.length === 0) return;
    const dates = reports.map((report) => reportDateKey(report.createdAt)).filter(Boolean).sort();
    const latestDate = dates[dates.length - 1];
    if (!latestDate) return;
    setCalendarMonth(monthFromDateKey(latestDate));
    calendarInitialized.current = true;
  }, [reports]);

  useEffect(() => {
    if (!calendarOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !calendarPickerRef.current?.contains(event.target)) {
        setCalendarOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCalendarOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [calendarOpen]);

  function moveCalendarMonth(offset: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12));
  }

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const data = await api.exportedReports();
      setReports(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the report list.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [refreshTrigger]);

  return (
    <section className="panel exported-reports-panel">
      <div className="panel-heading" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
          <span className="step-number" style={{ background: "#ecfdf3", color: "#137a37", borderColor: "#16a34a" }}>✓</span>
          <div>
            <h2>Excel files ({reports.length})</h2>
            <p>Excel files stored securely on your server</p>
          </div>
        </div>
        <button
          className="secondary-button"
          type="button"
          style={{ width: "auto", minHeight: "36px", padding: "6px 14px", marginTop: 0 }}
          onClick={loadReports}
          disabled={loading}
        >
          {loading ? "Loading..." : "🔄 Refresh"}
        </button>
      </div>

      {error && <p className="error-message" style={{ marginTop: "14px" }}>{error}</p>}

      {reports.length > 0 && (
        <div className="exported-reports-toolbar">
          <div className="exported-date-filter" ref={calendarPickerRef}>
            <label htmlFor="exported-report-date">Filter by export date</label>
            <div className="exported-date-control">
              <input
                id="exported-report-date"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="dd/mm/yyyy"
                maxLength={10}
                value={dateInput}
                aria-invalid={dateInputInvalid && !dateInputIncomplete}
                aria-describedby={dateInputIncomplete ? "exported-report-date-help" : dateInputInvalid ? "exported-report-date-error" : undefined}
                onChange={(event) => {
                  const value = formatDateDraft(event.currentTarget.value);
                  setDateInput(value);
                  const parsedDate = parseDateDraft(value);
                  if (parsedDate) setCalendarMonth(monthFromDateKey(parsedDate));
                }}
                disabled={loading}
              />
              <button
                className="exported-date-picker-trigger"
                type="button"
                aria-label={calendarOpen ? "Close calendar" : "Open calendar"}
                aria-expanded={calendarOpen}
                aria-controls="exported-report-calendar"
                onClick={() => setCalendarOpen((open) => !open)}
                disabled={loading}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="3" y="5" width="14" height="12" rx="2" />
                  <path d="M6 3v4M14 3v4M3 9h14" />
                </svg>
              </button>
            </div>
            {dateInputIncomplete && <small className="exported-date-help" id="exported-report-date-help">Enter a date in dd/mm/yyyy format.</small>}
            {dateInputInvalid && !dateInputIncomplete && (
              <small className="exported-date-error" id="exported-report-date-error" role="alert">Invalid date.</small>
            )}

            {calendarOpen && (
              <section className="exported-report-calendar" id="exported-report-calendar" aria-label="Report date calendar">
                <div className="exported-report-calendar-heading">
                  <h3>{calendarMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h3>
                  <div className="exported-report-calendar-nav">
                    <button type="button" aria-label="Previous month" title="Previous month" onClick={() => moveCalendarMonth(-1)}>‹</button>
                    <button type="button" aria-label="Next month" title="Next month" onClick={() => moveCalendarMonth(1)}>›</button>
                  </div>
                </div>
                <div className="exported-report-weekdays" aria-hidden="true">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="exported-report-calendar-days">
                  {calendarCells.map((cell, index) => {
                    if (!cell) return <span className="exported-report-calendar-blank" key={`blank-${index}`} />;
                    const isSelected = selectedDate === cell.date;
                    const today = new Date();
                    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    const isToday = todayKey === cell.date;
                    const classes = [
                      "exported-calendar-day",
                      cell.hasReports ? "has-reports" : "",
                      isSelected ? "selected" : "",
                      isToday ? "today" : "",
                    ].filter(Boolean).join(" ");
                    return (
                      <button
                        className={classes}
                        type="button"
                        key={cell.date}
                        aria-pressed={isSelected}
                        aria-label={`${formatDay(cell.date)}${cell.hasReports ? ", reports available" : ", no reports"}`}
                        title={`${formatDay(cell.date)}${cell.hasReports ? " · Reports available" : ""}`}
                        onClick={() => {
                          setDateInput(formatDay(cell.date));
                          setCalendarOpen(false);
                        }}
                      >
                        <span>{cell.day}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="exported-report-calendar-legend">
                  <span><i /> Days with reports</span>
                </div>
              </section>
            )}
          </div>
          <p className="exported-reports-summary" aria-live="polite">
            <strong>{filteredReports.length}</strong>
            {selectedDate ? ` ${reportCountLabel} · ${formatDay(selectedDate)}` : dateInputIncomplete ? " · Entering date" : dateInputInvalid ? " · Invalid date" : ` ${reportCountLabel} · all dates`}
          </p>
          {dateInputHasValue && (
            <button
              className="exported-reports-reset"
              type="button"
              onClick={() => setDateInput("")}
              disabled={loading}
            >
              Show all dates
            </button>
          )}
        </div>
      )}

      {reports.length === 0 && !loading && (
        <p className="health-reports-empty" style={{ margin: "18px 0 0" }}>
          No reports have been exported yet. Completed scenario reports will appear here.
        </p>
      )}

      {reports.length === 0 && loading && (
        <p className="health-reports-loading">Loading reports...</p>
      )}

      {selectedDate && reports.length > 0 && filteredReports.length === 0 && (
        <p className="health-reports-empty exported-reports-empty">
          No reports were exported on {formatDay(selectedDate)}.
        </p>
      )}

      {filteredReports.length > 0 && (
        <div className="health-report-table-wrap exported-reports-table-wrap">
          <table className="health-report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Scenario / File name</th>
                <th>Size</th>
                <th>Exported</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report, idx) => (
                <tr key={report.jobId}>
                  <td style={{ width: "40px", color: "var(--muted)" }}>{idx + 1}</td>
                  <td>
                    <strong style={{ color: "var(--navy)", fontSize: "12px" }}>{report.scenarioName}</strong>
                    <small style={{ color: "var(--muted)", fontFamily: "monospace" }}>{report.fileName}</small>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, color: "#137a37" }}>{formatSize(report.fileSize)}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>
                    {formatDate(report.createdAt)}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <AuthenticatedDownload
                      className="primary-button"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        width: "auto",
                        minHeight: "34px",
                        padding: "6px 14px",
                        textDecoration: "none",
                        fontSize: "11px",
                      }}
                      path={report.downloadUrl}
                      fileName={report.fileName}
                    >
                      📥 Download
                    </AuthenticatedDownload>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
