# Backend fix script - applies all remaining changes to main.py
import os

os.chdir(r'E:\UJN\ICAN\A Factory Built with a Single Word')

with open('services/api/app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix login endpoint to use remember parameter
old_login = '''@app.post(f"{PREFIX}/auth/login", response_model=AuthRead, tags=["auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthRead:
    username = payload.username.strip()
    user = db.query(User).filter(
        (User.login_name == username) | (User.name == username) | (User.email == username.lower())
    ).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    return AuthRead(token=issue_token(db, user), user=user_to_read(user))'''

new_login = '''@app.post(f"{PREFIX}/auth/login", response_model=AuthRead, tags=["auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthRead:
    username = payload.username.strip()
    user = db.query(User).filter(
        (User.login_name == username) | (User.name == username) | (User.email == username.lower())
    ).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    return AuthRead(token=issue_token(db, user, remember=payload.password), user=user_to_read(user))'''

if old_login in content:
    content = content.replace(old_login, new_login)
    print("Applied login fix")
else:
    print("WARNING: Could not find login endpoint to fix")
    # Show what's around line 1063
    lines = content.split('\n')
    for i in range(1060, min(1075, len(lines))):
        print(f"  {i+1}: {lines[i][:100]}")

# 2. Add file listing endpoint before download endpoint
file_listing = '''
@app.get(f"{PREFIX}/projects/{{project_id}}/files")
def list_project_files(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectFileRead]:
    require_project_access(project_id, user, db)
    files = db.query(ProjectFile).filter(
        ProjectFile.project_id == project_id
    ).order_by(ProjectFile.created_at.desc()).all()
    return [project_file_to_read(item) for item in files]
'''

# Insert before the download endpoint
if 'list_project_files' not in content:
    download_marker = '@app.get(f"{PREFIX}/projects/{project_id}/files/{file_id}/download")'
    if download_marker in content:
        content = content.replace(download_marker, file_listing + download_marker)
        print("Applied file listing endpoint")
    else:
        print("WARNING: Could not find download endpoint marker")
else:
    print("File listing already exists")

# 3. Add pagination to project list
old_list_projects = '''@app.get(f"{PREFIX}/projects", response_model=list[ProjectRead])
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
    return list(query.order_by(Project.created_at.desc()).all())'''

new_list_projects = '''@app.get(f"{PREFIX}/projects", response_model=list[ProjectRead])
def list_projects(
    include_archived: bool = False,
    status_filter: str | None = None,
    q: str = "",
    page: int = 1,
    page_size: int = 20,
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
    if status_filter:
        query = query.filter(Project.status == status_filter)
    if q:
        keyword = q.strip().lower()
        query = query.filter(
            (Project.name.ilike(f"%{keyword}%")) | (Project.requirement.ilike(f"%{keyword}%"))
        )
    return list(query.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all())'''

if old_list_projects in content:
    content = content.replace(old_list_projects, new_list_projects)
    print("Applied project list pagination")
else:
    print("WARNING: Could not find list_projects to fix")

# 4. Update update_project to set updated_at when archiving
old_update = '''@app.patch(f"{PREFIX}/projects/{{project_id}}", response_model=ProjectRead)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = require_project_access(project_id, user, db, write=True)
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(project, field_name, value)
    db.commit()
    db.refresh(project)
    return project'''

new_update = '''@app.patch(f"{PREFIX}/projects/{{project_id}}", response_model=ProjectRead)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = require_project_access(project_id, user, db, write=True)
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            if field_name == "status" and value == "archived":
                project.archived_at = datetime.utcnow()
            setattr(project, field_name, value)
    db.commit()
    db.refresh(project)
    return project'''

if old_update in content:
    content = content.replace(old_update, new_update)
    print("Applied update_project with archived_at")
else:
    print("WARNING: Could not find update_project to fix")

# 5. Add token cleanup on startup
old_lifespan = '''@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_schema()
    with SessionLocal() as db:
        seed_templates(db)
        seed_users(db)
        seed_notifications(db)
        seed_project_memberships(db)
        seed_scenario_versions(db)
    yield'''

new_lifespan = '''@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_schema()
    with SessionLocal() as db:
        seed_templates(db)
        seed_users(db)
        seed_notifications(db)
        seed_project_memberships(db)
        seed_scenario_versions(db)
        # Clean up expired tokens on startup
        db.query(AuthToken).filter(AuthToken.expires_at < datetime.utcnow()).delete()
        db.commit()
    yield'''

if old_lifespan in content:
    content = content.replace(old_lifespan, new_lifespan)
    print("Applied lifespan with token cleanup")
else:
    print("WARNING: Could not find lifespan to fix")

# 6. Update notification_to_dict to include item_type and item_id
old_notif_dict = '''def notification_to_dict(item: Notification) -> dict[str, Any]:
    return {
        "id": item.id,
        "type": item.type,
        "title": item.title,
        "content": item.content,
        "read": item.read,
        "createdAt": item.created_at.strftime("%Y-%m-%d %H:%M"),
        "targetUrl": item.target_url,
    }'''

new_notif_dict = '''def notification_to_dict(item: Notification) -> dict[str, Any]:
    return {
        "id": item.id,
        "type": item.type,
        "title": item.title,
        "content": item.content,
        "read": item.read,
        "createdAt": item.created_at.strftime("%Y-%m-%d %H:%M"),
        "targetUrl": item.target_url,
        "itemType": item.item_type,
        "itemId": item.item_id,
    }'''

if old_notif_dict in content:
    content = content.replace(old_notif_dict, new_notif_dict)
    print("Applied notification_to_dict with item fields")
else:
    print("WARNING: Could not find notification_to_dict to fix")

# 7. Update seed_notifications to include item_type/item_id
old_seed_notif = '''        for item_type, title, content, target_url in defaults:
            db.add(Notification(
                user_id=user.id,
                type=item_type,
                title=title,
                content=content,
                target_url=target_url,
            ))'''

new_seed_notif = '''        for item_type, title, content, target_url in defaults:
            db.add(Notification(
                user_id=user.id,
                type=item_type,
                title=title,
                content=content,
                target_url=target_url,
                item_type=item_type,
                item_id="",
            ))'''

if old_seed_notif in content:
    content = content.replace(old_seed_notif, new_seed_notif)
    print("Applied seed_notifications with item fields")
else:
    print("WARNING: Could not find seed_notifications to fix")

with open('services/api/app/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE - all fixes applied")
