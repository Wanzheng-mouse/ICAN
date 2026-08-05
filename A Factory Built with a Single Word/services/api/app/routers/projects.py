"""Project, project-file and project-member endpoints (formerly in main.py)."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.domain import (
    get_current_user,
    get_or_404,
    project_file_to_read,
    require_project_access,
    scenario_to_read,
    validate_project_file_content,
)
from app.models import (
    Project,
    ProjectFile,
    ProjectMembership,
    ProjectRequestKey,
    Scenario,
    SimulationRun,
    User,
)
from app.schemas import (
    ProjectCreate,
    ProjectFileRead,
    ProjectMemberRead,
    ProjectMemberUpsert,
    ProjectRead,
    ProjectUpdate,
    ProjectWorkspaceRead,
    SimulationRead,
)
from app.shared import PREFIX, _utcnow

router = APIRouter()


@router.post(f"{PREFIX}/projects", response_model=ProjectRead, status_code=201, tags=["projects"])
def create_project(
    payload: ProjectCreate,
    user: User = Depends(get_current_user),
    request: Request = None,
    db: Session = Depends(get_db),
) -> Project:
    if user.role == "viewer":
        raise HTTPException(status_code=403, detail="只读用户不能创建项目")
    if request:
        key = request.headers.get("X-Idempotency-Key")
        if key:
            existing = (
                db.query(ProjectRequestKey)
                .filter(
                    ProjectRequestKey.request_key == key.strip(),
                    ProjectRequestKey.user_id == user.id,
                )
                .first()
            )
            if existing:
                return db.get(Project, existing.project_id)
    project = Project(name=payload.name.strip(), requirement=payload.requirement.strip())
    db.add(project)
    db.flush()
    db.add(ProjectMembership(project_id=project.id, user_id=user.id, role="owner"))
    if request:
        key = request.headers.get("X-Idempotency-Key")
        if key:
            db.add(
                ProjectRequestKey(request_key=key.strip(), user_id=user.id, project_id=project.id)
            )
    db.commit()
    db.refresh(project)
    return project


@router.get(f"{PREFIX}/projects", response_model=list[ProjectRead], tags=["projects"])
def list_projects(
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Project]:
    query = db.query(Project)
    if user.role != "admin":
        query = query.join(ProjectMembership, ProjectMembership.project_id == Project.id).filter(
            ProjectMembership.user_id == user.id
        )
    if not include_archived:
        query = query.filter(Project.status != "archived")
    return list(query.order_by(Project.created_at.desc()).all())


@router.get(f"{PREFIX}/projects/{{project_id}}", response_model=ProjectRead, tags=["projects"])
def get_project(
    project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Project:
    return require_project_access(project_id, user, db)


@router.patch(f"{PREFIX}/projects/{{project_id}}", response_model=ProjectRead, tags=["projects"])
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = require_project_access(project_id, user, db, write=True)
    if payload.name is not None:
        existing = (
            db.query(Project)
            .join(ProjectMembership, ProjectMembership.project_id == Project.id)
            .filter(
                ProjectMembership.user_id == user.id,
                Project.name == payload.name.strip(),
                Project.id != project_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail=f"项目名称「{payload.name}」已被占用")
        payload.name = payload.name.strip()
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            if field_name == "status" and value == "archived":
                project.archived_at = (
                    __import__("datetime")
                    .datetime.now(__import__("datetime").timezone.utc)
                    .replace(tzinfo=None)
                )
            setattr(project, field_name, value)
    project.updated_at = _utcnow()
    db.commit()
    db.refresh(project)
    return project


@router.get(
    f"{PREFIX}/projects/{{project_id}}/workspace",
    response_model=ProjectWorkspaceRead,
    tags=["projects"],
)
def get_project_workspace(
    project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProjectWorkspaceRead:
    project = require_project_access(project_id, user, db)
    scenarios = (
        db.query(Scenario)
        .filter(Scenario.project_id == project_id)
        .order_by(Scenario.updated_at.desc())
        .all()
    )
    files = (
        db.query(ProjectFile)
        .filter(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.created_at.desc())
        .all()
    )
    return ProjectWorkspaceRead(
        project=ProjectRead.model_validate(project),
        scenarios=[scenario_to_read(item, db) for item in scenarios],
        files=[project_file_to_read(item) for item in files],
    )


@router.get(
    f"{PREFIX}/projects/{{project_id}}/simulations",
    response_model=list[SimulationRead],
    tags=["projects"],
)
def list_project_simulations(
    project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[SimulationRun]:
    require_project_access(project_id, user, db)
    return list(
        db.query(SimulationRun)
        .filter(SimulationRun.project_id == project_id)
        .order_by(SimulationRun.created_at.desc())
        .all()
    )


@router.get(
    f"{PREFIX}/projects/{{project_id}}/files",
    response_model=list[ProjectFileRead],
    tags=["projects"],
)
def list_project_files(
    project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ProjectFileRead]:
    require_project_access(project_id, user, db)
    items = (
        db.query(ProjectFile)
        .filter(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.created_at.desc())
        .all()
    )
    return [project_file_to_read(item) for item in items]


@router.post(
    f"{PREFIX}/projects/{{project_id}}/files",
    response_model=ProjectFileRead,
    status_code=201,
    tags=["projects"],
)
async def upload_project_file(
    project_id: str,
    request: Request,
    kind: str = "attachment",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectFileRead:
    require_project_access(project_id, user, db, write=True)
    body = await request.body()
    filename = request.headers.get("X-Filename", f"file-{uuid4().hex[:8]}")
    content_type = request.headers.get("Content-Type", "application/octet-stream")
    ext = Path(filename).suffix.lower()
    ext_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".pdf": "application/pdf",
        ".csv": "text/csv",
        ".json": "application/json",
        ".yaml": "application/json",
        ".yml": "application/json",
        ".txt": "text/plain",
    }
    validate_project_file_content(ext, body)
    upload_dir = Path(settings.upload_dir).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    project_dir = upload_dir / project_id
    project_dir.mkdir(exist_ok=True)
    stored_name = f"{uuid4().hex}{ext}"
    (project_dir / stored_name).write_bytes(body)
    item = ProjectFile(
        project_id=project_id,
        uploader_id=user.id,
        filename=filename,
        stored_name=stored_name,
        content_type=ext_map.get(ext, content_type),
        size=len(body),
        kind=kind,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return project_file_to_read(item)


@router.get(f"{PREFIX}/projects/{{project_id}}/files/{{file_id}}/download", tags=["projects"])
def download_project_file(
    project_id: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    require_project_access(project_id, user, db)
    item = get_or_404(ProjectFile, file_id, db, "Project file")
    if item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Project file not found")
    path = Path(settings.upload_dir).resolve() / project_id / item.stored_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="文件内容不存在")
    return Response(
        content=path.read_bytes(),
        media_type=item.content_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(item.filename)}"},
    )


@router.delete(
    f"{PREFIX}/projects/{{project_id}}/files/{{file_id}}", status_code=204, tags=["projects"]
)
def delete_project_file(
    project_id: str,
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    require_project_access(project_id, user, db, write=True)
    item = get_or_404(ProjectFile, file_id, db, "Project file")
    if item.project_id != project_id:
        raise HTTPException(status_code=404, detail="Project file not found")
    db.delete(item)
    db.commit()
    return Response(status_code=204)


@router.get(
    f"{PREFIX}/projects/{{project_id}}/members",
    response_model=list[ProjectMemberRead],
    tags=["projects"],
)
def list_project_members(
    project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ProjectMemberRead]:
    require_project_access(project_id, user, db)
    memberships = (
        db.query(ProjectMembership).filter(ProjectMembership.project_id == project_id).all()
    )
    result: list[ProjectMemberRead] = []
    for m in memberships:
        member = db.get(User, m.user_id)
        if member:
            result.append(
                ProjectMemberRead(
                    user_id=member.id,
                    login_name=member.login_name,
                    name=member.name,
                    email=member.email,
                    role=m.role,
                )
            )
    return result


@router.post(
    f"{PREFIX}/projects/{{project_id}}/members", response_model=ProjectMemberRead, tags=["projects"]
)
def add_project_member(
    project_id: str,
    payload: ProjectMemberUpsert,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectMemberRead:
    require_project_access(project_id, user, db, write=True)
    identity = payload.identity.strip().lower()
    member = db.query(User).filter((User.login_name == identity) | (User.email == identity)).first()
    if member is None:
        raise HTTPException(status_code=404, detail="用户不存在，请先注册")
    existing = (
        db.query(ProjectMembership)
        .filter(ProjectMembership.project_id == project_id, ProjectMembership.user_id == member.id)
        .first()
    )
    if existing:
        existing.role = payload.role
        db.commit()
        db.refresh(existing)
        return ProjectMemberRead(
            user_id=member.id,
            login_name=member.login_name,
            name=member.name,
            email=member.email,
            role=existing.role,
        )
    membership = ProjectMembership(project_id=project_id, user_id=member.id, role=payload.role)
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return ProjectMemberRead(
        user_id=member.id,
        login_name=member.login_name,
        name=member.name,
        email=member.email,
        role=membership.role,
    )


@router.delete(
    f"{PREFIX}/projects/{{project_id}}/members/{{user_id}}", status_code=204, tags=["projects"]
)
def remove_project_member(
    project_id: str,
    user_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    require_project_access(project_id, user, db, write=True)
    membership = (
        db.query(ProjectMembership)
        .filter(ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id)
        .first()
    )
    if membership:
        db.delete(membership)
        db.commit()
    return Response(status_code=204)
