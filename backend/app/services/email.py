import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger(__name__)


def send_email(to: str, subject: str, text: str, html: str | None = None) -> None:
    if not settings.smtp_host:
        log.warning("SMTP not configured. Email to %s:\n%s\n%s", to, subject, text)
        return

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        if settings.smtp_use_ssl:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
            server.starttls()
        with server:
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
    except Exception:  # never break the request because mail failed
        log.exception("Failed to send email to %s", to)


def send_password_reset_email(to: str, name: str, link: str) -> None:
    minutes = settings.reset_token_expire_minutes
    text = (
        f"Hello {name},\n\n"
        f"We received a request to reset your Post Finance password.\n"
        f"Open this link to choose a new one (valid for {minutes} minutes):\n\n{link}\n\n"
        f"If you didn't ask for this, you can ignore this email."
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1e293b">
      <h2 style="color:#2c317b">Reset your password</h2>
      <p>Hello {name},</p>
      <p>We received a request to reset your Post Finance password. The link is valid for {minutes} minutes.</p>
      <p><a href="{link}" style="display:inline-block;background:#2c317b;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Reset password</a></p>
      <p style="font-size:12px;color:#64748b">If the button doesn't work, paste this link into your browser:<br>{link}</p>
      <p style="font-size:12px;color:#64748b">If you didn't ask for this, you can ignore this email.</p>
    </div>"""
    send_email(to, "Reset your Post Finance password", text, html)


def send_password_changed_email(to: str, name: str) -> None:
    send_email(
        to,
        "Your Post Finance password was changed",
        f"Hello {name},\n\nYour password was just changed. If this wasn't you, contact an administrator immediately.",
    )