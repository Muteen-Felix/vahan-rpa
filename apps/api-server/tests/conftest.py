import pytest_asyncio

from app.services import services


@pytest_asyncio.fixture(autouse=True)
async def clear_memory_state():
    await services.jobs.clear()
    await services.runners.clear()
    yield
    await services.jobs.clear()
    await services.runners.clear()
