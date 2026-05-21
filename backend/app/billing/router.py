from fastapi import APIRouter


router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/health")
def billing_health():
    return {"provider": "culqi", "status": "pending-setup"}
