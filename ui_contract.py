"""Runtime contract checks for the VAHAN report page.

The report page is an external system, so selector failures must be treated as
UI drift rather than as ordinary retries.  This module keeps the checks small,
deterministic, and independent from the business flow.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from playwright.sync_api import Locator, Page


UI_CONTRACT_VERSION = "v1"
REPORT_PATH_FRAGMENT = "/analytics/vahanpublicreport"


class UIDriftError(RuntimeError):
    """Raised when the page no longer matches a supported UI contract."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        step: str = "preflight",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.step = step
        self.details = details or {}


REQUIRED_CONTROLS = {
    "form": "#vahanPublicForm",
    "category": "#vehicleCategoryGroup",
    "fuel": "#vehicleFuel",
    "yaxis": "#yAxis",
    "xaxis": "#xAxis",
    "captcha": "#externalCaptcha",
    "apply": "#applyTrigger",
}


def normalize_text(value: str | None) -> str:
    """Normalize labels while preserving meaningful punctuation."""

    return " ".join((value or "").split()).strip().casefold()


def _count(locator: Locator) -> int:
    return locator.count()


def _require_one(page: Page, selector: str, name: str, step: str) -> Locator:
    locator = page.locator(selector)
    count = _count(locator)
    if count != 1:
        raise UIDriftError(
            "UI_DRIFT_REQUIRED_CONTROL",
            f"Không tìm thấy duy nhất control bắt buộc '{name}' ({selector}), count={count}.",
            step=step,
            details={"control": name, "selector": selector, "count": count},
        )
    return locator


def _option_labels(locator: Locator) -> list[str]:
    options = locator.locator("option")
    labels: list[str] = []
    for index in range(options.count()):
        option = options.nth(index)
        labels.append(
            normalize_text(option.get_attribute("label") or option.inner_text())
        )
    return labels


def get_dropdown_container(page: Page, hidden_select_id: str, *, step: str = "filter") -> Locator:
    """Resolve a multiselect wrapper inside the same field group as its select.

    The previous implementation used ``following::div[1]`` across the whole
    document.  That works only while the vendor keeps the generated widget in
    the same DOM order.  Scoping to the field group prevents a newly inserted
    dropdown elsewhere on the page from being selected accidentally.
    """

    hidden = _require_one(page, f"#{hidden_select_id}", hidden_select_id, step)
    group = hidden.locator(
        "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' form-group ')][1]"
    )
    candidates = group.locator("div.multiselect-dropdown")
    count = candidates.count()

    if count != 1:
        # Keep a narrowly scoped parent fallback for minor wrapper changes.  It
        # is still constrained to the select's immediate parent, never the
        # whole document.
        parent_candidates = hidden.locator("xpath=..").locator("div.multiselect-dropdown")
        if parent_candidates.count() == 1:
            candidates = parent_candidates
            count = 1

    if count != 1:
        raise UIDriftError(
            "UI_DRIFT_MULTISELECT_WRAPPER",
            f"Không xác định được widget multiselect duy nhất cho #{hidden_select_id}, count={count}.",
            step=step,
            details={"hidden_select_id": hidden_select_id, "wrapper_count": count},
        )

    return candidates.first


def _stable_control_fingerprint(page: Page, step: str) -> list[dict[str, Any]]:
    fingerprint: list[dict[str, Any]] = []
    for name, selector in REQUIRED_CONTROLS.items():
        locator = _require_one(page, selector, name, step)
        fingerprint.append(
            {
                "name": name,
                "selector": selector,
                "tag": locator.evaluate("el => el.tagName.toLowerCase()"),
                "id": locator.get_attribute("id"),
                "name_attr": locator.get_attribute("name"),
                "multiple": locator.get_attribute("multiple") is not None,
            }
        )
    return fingerprint


def _signature(fingerprint: list[dict[str, Any]]) -> str:
    canonical = json.dumps(fingerprint, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def assert_ui_contract(
    page: Page,
    *,
    step: str = "preflight",
    expected_signature: str | None = None,
) -> dict[str, Any]:
    """Validate the supported page contract and return a safe diagnostic snapshot."""

    if REPORT_PATH_FRAGMENT not in page.url:
        raise UIDriftError(
            "UI_DRIFT_WRONG_PAGE",
            "Trang hiện tại không phải VAHAN Public Report; automation đã dừng.",
            step=step,
            details={"url": page.url},
        )

    form = _require_one(page, REQUIRED_CONTROLS["form"], "form", step)
    fingerprint = _stable_control_fingerprint(page, step)

    for name in ("category", "fuel"):
        control = page.locator(REQUIRED_CONTROLS[name])
        if control.get_attribute("multiple") is None:
            raise UIDriftError(
                "UI_DRIFT_CONTROL_TYPE",
                f"Control {name} không còn là multi-select như contract {UI_CONTRACT_VERSION}.",
                step=step,
                details={"control": name, "expected": "multiple select"},
            )

    category_options = _option_labels(page.locator("#vehicleCategoryGroup"))
    if normalize_text("Two Wheeler") not in category_options:
        raise UIDriftError(
            "UI_DRIFT_REQUIRED_OPTION",
            "Không tìm thấy option Category Group 'Two Wheeler'.",
            step=step,
            details={"control": "category", "expected_option": "Two Wheeler"},
        )

    if page.locator("#vehicleFuel option").count() == 0:
        raise UIDriftError(
            "UI_DRIFT_EMPTY_OPTIONS",
            "Danh sách Fuel đang rỗng hoặc chưa được tải.",
            step=step,
            details={"control": "fuel"},
        )

    yaxis_options = _option_labels(page.locator("#yAxis"))
    if normalize_text("Fuel") not in yaxis_options:
        raise UIDriftError(
            "UI_DRIFT_REQUIRED_OPTION",
            "Không tìm thấy option Y-Axis 'Fuel'.",
            step=step,
            details={"control": "yaxis", "expected_option": "Fuel"},
        )

    # Validate wrapper association without relying on global DOM order.
    get_dropdown_container(page, "vehicleCategoryGroup", step=step)
    get_dropdown_container(page, "vehicleFuel", step=step)

    signature = _signature(fingerprint)
    snapshot = {
        "contract_version": UI_CONTRACT_VERSION,
        "signature": signature,
        "url_path": page.url.split("?", 1)[0],
        "controls": fingerprint,
        "form_action": form.get_attribute("action"),
    }

    if expected_signature and expected_signature != signature:
        raise UIDriftError(
            "UI_DRIFT_CHANGED_DURING_RUN",
            "Cấu trúc UI đã thay đổi trong lúc flow đang chạy; dữ liệu chưa được xác nhận.",
            step=step,
            details={"expected_signature": expected_signature, "actual_signature": signature},
        )

    return snapshot


def find_dropdown_option(container: Locator, target_text: str, *, label: str, step: str) -> Locator:
    """Find exactly one custom-dropdown option by normalized attribute/label."""

    target = normalize_text(target_text)
    candidates = container.locator("[data-search-text]")
    matches: list[Locator] = []
    for index in range(candidates.count()):
        candidate = candidates.nth(index)
        data_text = normalize_text(candidate.get_attribute("data-search-text"))
        visible_text = normalize_text(candidate.inner_text())
        if target in (data_text, visible_text):
            matches.append(candidate)

    if len(matches) != 1:
        raise UIDriftError(
            "UI_DRIFT_OPTION_NOT_UNIQUE",
            f"Không tìm thấy duy nhất option '{target_text}' trong {label}, count={len(matches)}.",
            step=step,
            details={"label": label, "target": target_text, "count": len(matches)},
        )
    return matches[0]


def find_all_checkbox(container: Locator, *, label: str, step: str) -> Locator:
    """Find the select-all checkbox by its visible label, with a class fallback."""

    candidates = container.locator("input[type='checkbox']")
    matches: list[Locator] = []
    for index in range(candidates.count()):
        candidate = candidates.nth(index)
        parent_text = normalize_text(candidate.locator("xpath=..").inner_text())
        if parent_text == normalize_text("All"):
            matches.append(candidate)

    if len(matches) != 1:
        fallback = container.locator("div.multiselect-dropdown-all-selector input[type='checkbox']")
        if fallback.count() == 1:
            return fallback.first
        raise UIDriftError(
            "UI_DRIFT_ALL_OPTION_NOT_FOUND",
            f"Không tìm thấy checkbox All duy nhất trong {label}.",
            step=step,
            details={"label": label, "count": len(matches)},
        )
    return matches[0]
