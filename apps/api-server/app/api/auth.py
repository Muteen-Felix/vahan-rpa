from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from app.config import settings
from app.security import credentials_match, issue_access_token


router = APIRouter(prefix="/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=1024)


@router.get("/status")
async def auth_status() -> dict[str, bool | int]:
    return {
        "configured": settings.ui_auth_configured,
        "tokenTtlSeconds": settings.ui_auth_token_ttl_seconds,
    }


@router.post("/login")
async def login(command: LoginRequest, response: Response) -> dict[str, str | int]:
    if not settings.ui_auth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on the API server.",
        )
    if not credentials_match(command.username, command.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return {
        "accessToken": issue_access_token(command.username),
        "tokenType": "Bearer",
        "expiresIn": settings.ui_auth_token_ttl_seconds,
        "username": command.username,
    }


@router.get("/me")
async def current_user(request: Request) -> dict[str, str]:
    username = getattr(request.state, "authenticated_user", None)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return {"username": username}
