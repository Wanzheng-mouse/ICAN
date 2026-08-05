"""Authentication, user profile, and template-event endpoints.

Moved verbatim from ``app/main.py`` during the phase-2 router split (M4).
All paths and behaviours are preserved.
"""

from __future__ import annotations

import secrets
from datetime import timedelta
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.domain import (
    DEFAULT_PREFERENCES,
    get_current_token,
    get_current_user,
    get_or_404,
    hash_password,
    issue_token,
    user_to_read,
    verify_password,
)
from app.models import AuthToken, PasswordResetToken, User
from app.schemas import (
    AuthRead,
    LoginRequest,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestRead,
    ProfileUpdate,
    RegisterRequest,
    UserPreferences,
    UserRead,
)
from app.services.mail import send_password_reset
from app.shared import PREFIX, _utcnow

router = APIRouter()


@router.post(f"{PREFIX}/auth/login", response_model=AuthRead, tags=["auth"])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthRead:
    username = payload.username.strip()
    user = (
        db.query(User)
        .filter((User.login_name == username) | (User.name == username) | (User.email == username))
        .first()
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    return AuthRead(token=issue_token(db, user, payload.remember), user=user_to_read(user))


@router.post(f"{PREFIX}/auth/register", response_model=AuthRead, status_code=201, tags=["auth"])
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthRead:
    login_name = payload.loginName
    email = payload.email
    duplicate = (
        db.query(User).filter((User.login_name == login_name) | (User.email == email)).first()
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="该账号或邮箱已被注册")
    user = User(
        login_name=login_name,
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        role="operator",
        department=payload.department,
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={quote(payload.name)}",
        preferences=DEFAULT_PREFERENCES,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="该账号或邮箱已被注册") from None
    db.refresh(user)
    return AuthRead(token=issue_token(db, user, payload.remember), user=user_to_read(user))


@router.post(f"{PREFIX}/auth/logout", status_code=204, tags=["auth"])
def logout(token: str = Depends(get_current_token), db: Session = Depends(get_db)) -> Response:
    stored = db.get(AuthToken, token)
    if stored is not None:
        db.delete(stored)
        db.commit()
    return Response(status_code=204)


@router.post(
    f"{PREFIX}/auth/forgot-password", response_model=PasswordResetRequestRead, tags=["auth"]
)
def request_password_reset(
    payload: PasswordResetRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
) -> PasswordResetRequestRead:
    generic = "如果邮箱已注册，密码重置凭据已经生成"
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user is None:
        return PasswordResetRequestRead(message=generic)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used.is_(False)
    ).update({PasswordResetToken.used: True})
    token = secrets.token_urlsafe(40)
    db.add(PasswordResetToken(token=token, user_id=user.id))
    db.commit()
    background_tasks.add_task(send_password_reset, user.email, token)
    return PasswordResetRequestRead(
        message=generic, reset_token=token if settings.expose_reset_token else None
    )


@router.post(f"{PREFIX}/auth/reset-password", status_code=204, tags=["auth"])
def reset_password(payload: PasswordResetConfirm, db: Session = Depends(get_db)) -> Response:
    reset = db.get(PasswordResetToken, payload.token)
    if reset is None or reset.used or reset.created_at < _utcnow() - timedelta(minutes=30):
        raise HTTPException(status_code=400, detail="重置凭据无效或已过期")
    user = get_or_404(User, reset.user_id, db, "User")
    user.password_hash = hash_password(payload.new_password)
    reset.used = True
    db.query(AuthToken).filter(AuthToken.user_id == user.id).delete()
    db.commit()
    return Response(status_code=204)


@router.post(f"{PREFIX}/auth/change-password", status_code=204, tags=["auth"])
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """已登录用户主动修改密码。
    1. 校验旧密码正确性。
    2. 写入新密码哈希。
    3. 立即吊销该用户全部已签发 token，强制重新登录。
    """
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="原密码不正确")
    user.password_hash = hash_password(payload.new_password)
    db.query(AuthToken).filter(AuthToken.user_id == user.id).delete()
    db.commit()
    return Response(status_code=204)


@router.get(f"{PREFIX}/users/me", response_model=UserRead, tags=["users"])
def get_my_profile(user: User = Depends(get_current_user)) -> UserRead:
    return user_to_read(user)


@router.put(f"{PREFIX}/users/me", response_model=UserRead, tags=["users"])
def update_profile(
    payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserRead:
    data = payload.model_dump(exclude_unset=True)
    prefs = data.get("preferences")
    if prefs is not None:
        merged = {**(user.preferences or {}), **prefs}
        UserPreferences.model_validate({"defaultPage": merged.get("defaultPage", "/")})
        user.preferences = merged
    user.name = data.get("name", user.name)
    user.department = data.get("department", user.department)
    user.avatar = data.get("avatar", user.avatar)
    db.commit()
    db.refresh(user)
    return user_to_read(user)
