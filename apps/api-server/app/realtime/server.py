import socketio

from app.config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=list(settings.cors_origins),
    logger=settings.debug,
    engineio_logger=settings.debug,
)

# Import modules for their event-handler registrations.
from app.realtime import runner_events, ui_events  # noqa: E402, F401
