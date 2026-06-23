from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.database import get_supabase
from app.models.projects import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])

_VAULT_EXCLUDED = {"gemini_api_key_secret_id"}


# ---------------------------------------------------------------------------
# Vault helpers — chamam funções públicas wrapper definidas na migration SQL.
# Requerem a extensão supabase_vault habilitada no projeto Supabase.
# ---------------------------------------------------------------------------

def _vault_store(db: Client, secret: str, name: str) -> str:
    result = db.rpc("vault_create_secret", {"p_secret": secret, "p_name": name}).execute()
    return result.data


def _vault_delete(db: Client, secret_id: str) -> None:
    db.rpc("vault_delete_secret", {"p_secret_id": secret_id}).execute()


# ---------------------------------------------------------------------------
# Row → response dict
# ---------------------------------------------------------------------------

def _to_response(row: dict, sessions: list[dict] | None = None) -> dict:
    has_active = any(s.get("status") == "active" for s in (sessions or []))
    return {
        **{k: v for k, v in row.items() if k not in _VAULT_EXCLUDED},
        "has_api_key": bool(row.get("gemini_api_key_secret_id")),
        "has_active_session": has_active,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[ProjectResponse])
async def list_projects(db: Client = Depends(get_supabase)):
    result = db.table("projects").select("*, sessions(status)").execute()
    return [_to_response(row, row.pop("sessions", [])) for row in result.data]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, db: Client = Depends(get_supabase)):
    secret_id = _vault_store(db, payload.gemini_api_key, f"gemini-{payload.client}")
    row = payload.model_dump(mode="json", exclude={"gemini_api_key"})
    row["gemini_api_key_secret_id"] = secret_id
    result = db.table("projects").insert(row).execute()
    return _to_response(result.data[0])


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, db: Client = Depends(get_supabase)):
    result = (
        db.table("projects")
        .select("*, sessions(status)")
        .eq("id", str(project_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")
    row = result.data[0]
    return _to_response(row, row.pop("sessions", []))


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID, payload: ProjectUpdate, db: Client = Depends(get_supabase)
):
    existing = (
        db.table("projects")
        .select("id, gemini_api_key_secret_id")
        .eq("id", str(project_id))
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = payload.model_dump(mode="json", exclude_none=True, exclude={"gemini_api_key"})

    if payload.gemini_api_key:
        old_id = existing.data[0].get("gemini_api_key_secret_id")
        if old_id:
            _vault_delete(db, old_id)
        updates["gemini_api_key_secret_id"] = _vault_store(
            db, payload.gemini_api_key, f"gemini-{project_id}"
        )

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = (
        db.table("projects").update(updates).eq("id", str(project_id)).execute()
    )
    return _to_response(result.data[0])


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: UUID, db: Client = Depends(get_supabase)):
    existing = (
        db.table("projects")
        .select("id, gemini_api_key_secret_id")
        .eq("id", str(project_id))
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Project not found")

    secret_id = existing.data[0].get("gemini_api_key_secret_id")
    if secret_id:
        _vault_delete(db, secret_id)

    db.table("projects").delete().eq("id", str(project_id)).execute()
