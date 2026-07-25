from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings


logger = logging.getLogger("ican.mail")


def send_password_reset(email: str, token: str) -> bool:
    """Send a reset link when SMTP is configured; never log the secret token."""
    if not settings.smtp_host:
        logger.info("password_reset_email_skipped", extra={"recipient": email, "reason": "smtp_not_configured"})
        return False
    message = EmailMessage()
    message["Subject"] = "ICAN 密码重置"
    message["From"] = settings.smtp_from or settings.smtp_username
    message["To"] = email
    reset_url = f"{settings.frontend_url.rstrip('/')}/forgot-password?token={token}"
    message.set_content(f"请在 30 分钟内打开以下链接重置密码：\n\n{reset_url}\n\n如非本人操作，请忽略本邮件。")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
    return True
