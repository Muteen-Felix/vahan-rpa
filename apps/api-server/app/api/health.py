from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    raise RuntimeError("Giả lập lỗi 500 để test Schemathesis!")
    # return {"status": "ok"}
