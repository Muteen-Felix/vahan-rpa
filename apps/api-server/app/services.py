from dataclasses import dataclass

from app.repositories import InMemoryJobRepository, InMemoryRunnerRegistry


@dataclass(slots=True)
class Services:
    jobs: InMemoryJobRepository
    runners: InMemoryRunnerRegistry


services = Services(
    jobs=InMemoryJobRepository(),
    runners=InMemoryRunnerRegistry(),
)
