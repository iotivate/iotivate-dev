#!/usr/bin/env python3
"""
Simple SMTP test script for iotivate.dev email configuration.
Run this to verify your SMTP settings work before testing password reset.

Usage: python test_email.py
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from app.services.email import send_email
from app.config import settings

def test_smtp():
    print("🧪 Testing SMTP Configuration...")
    print(f"Host: {settings.smtp_host}:{settings.smtp_port}")
    print(f"User: {settings.smtp_user}")
    print(f"TLS: {settings.smtp_use_tls}")
    print(f"Configured: {settings.smtp_configured}")
    print()

    if not settings.smtp_configured:
        print("❌ SMTP not configured. Please update your .env file with:")
        print("   SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_TO_EMAIL")
        return False

    try:
        print("📤 Sending test email...")
        send_email(
            subject="[iotivate] SMTP Test",
            body="This is a test email to verify SMTP configuration works!\n\nIf you see this, password reset emails will work. ✅",
            to_email=settings.smtp_to_email
        )
        print("✅ Test email sent successfully!")
        print(f"📧 Check your inbox: {settings.smtp_to_email}")
        return True

    except Exception as e:
        print(f"❌ Email sending failed: {e}")
        print("\n🔧 Common issues:")
        print("   - Invalid Gmail app password")
        print("   - 2FA not enabled on Gmail")
        print("   - Wrong email/password")
        print("   - Firewall blocking port 587")
        return False

if __name__ == "__main__":
    test_smtp()