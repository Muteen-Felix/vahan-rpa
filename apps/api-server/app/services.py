from dataclasses import dataclass

from app.config import settings
from app.repositories import (
    InMemoryJobRepository,
    InMemoryRunnerRegistry,
    UiHealthLogStore,
    InMemoryUiHealthScheduleRepository,
)


@dataclass(slots=True)
class Services:
    jobs: InMemoryJobRepository
    runners: InMemoryRunnerRegistry
    ui_health: InMemoryUiHealthScheduleRepository
    ui_health_logs: UiHealthLogStore


services = Services(
    jobs=InMemoryJobRepository(),
    runners=InMemoryRunnerRegistry(),
    ui_health=InMemoryUiHealthScheduleRepository(),
    ui_health_logs=UiHealthLogStore(settings.ui_health_log_dir),
)
