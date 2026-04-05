#!/usr/bin/env python3
"""
Debug script for email configuration issues.
Run this on Render to diagnose SMTP problems without API calls.

Usage (from backend directory):
python debug_email.py
"""
import os
import sys
import smtplib
from email.mime.text import MIMEText

def debug_env_vars():
    """Check what environment variables are set."""
    env_vars = [
        'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD',
        'SMTP_FROM_EMAIL', 'SMTP_TO_EMAIL', 'SMTP_USE_TLS'
    ]

    print("🔍 Environment Variables Check:")
    for var in env_vars:
        value = os.environ.get(var)
        if var == 'SMTP_PASSWORD' and value:
            # Hide password but show length
            print(f"  {var}: [SET - {len(value)} chars]")
        elif value:
            print(f"  {var}: {value}")
        else:
            print(f"  {var}: [NOT SET]")
    print()

def test_smtp_connection():
    """Test SMTP connection and authentication."""
    host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    port = int(os.environ.get('SMTP_PORT', 587))
    user = os.environ.get('SMTP_USER')
    password = os.environ.get('SMTP_PASSWORD')
    use_tls = os.environ.get('SMTP_USE_TLS', 'true').lower() == 'true'

    print(f"🌐 Testing SMTP connection to {host}:{port}")

    # Check required vars
    if not all([host, user, password]):
        print("❌ Missing required SMTP variables")
        return False

    try:
        print(f"📡 Connecting to {host}:{port}...")
        with smtplib.SMTP(host, port, timeout=10) as server:
            print("✅ Connected successfully")

            if use_tls:
                print("🔒 Starting TLS...")
                server.starttls()
                print("✅ TLS enabled")

            print(f"🔑 Authenticating as {user}...")
            server.login(user, password)
            print("✅ Authentication successful")

            return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ Authentication failed: {e}")
        print("💡 Check Gmail app password (16 characters, no spaces)")
        return False
    except smtplib.SMTPConnectError as e:
        print(f"❌ Connection failed: {e}")
        print("💡 Check host/port or network connectivity")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_send_email():
    """Test sending an actual email."""
    host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    port = int(os.environ.get('SMTP_PORT', 587))
    user = os.environ.get('SMTP_USER')
    password = os.environ.get('SMTP_PASSWORD')
    from_email = os.environ.get('SMTP_FROM_EMAIL', user)
    to_email = os.environ.get('SMTP_TO_EMAIL', user)
    use_tls = os.environ.get('SMTP_USE_TLS', 'true').lower() == 'true'

    if not all([host, user, password, to_email]):
        print("❌ Missing required email variables")
        return False

    try:
        print(f"📧 Sending test email to {to_email}...")

        msg = MIMEText("This is a test email from the iotivate.dev debug script!\n\nIf you see this, SMTP is working correctly.", "plain", "utf-8")
        msg["Subject"] = "[iotivate] SMTP Debug Test"
        msg["From"] = from_email
        msg["To"] = to_email

        with smtplib.SMTP(host, port, timeout=10) as server:
            if use_tls:
                server.starttls()
            server.login(user, password)
            server.sendmail(from_email, [to_email], msg.as_string())

        print(f"✅ Email sent successfully to {to_email}")
        print(f"📥 Check your inbox at {to_email}")
        return True

    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False

def main():
    print("🔧 iotivate.dev Email Debug Tool")
    print("=" * 50)

    debug_env_vars()

    if test_smtp_connection():
        print("🎉 SMTP connection test passed!")
        print()
        test_send_email()
    else:
        print("❌ SMTP connection test failed")
        print("\n🔧 Common fixes:")
        print("  1. Check Gmail app password (not regular password)")
        print("  2. Ensure 2FA is enabled on Gmail account")
        print("  3. Verify all environment variables are set")
        print("  4. Check for typos in email addresses")

if __name__ == "__main__":
    main()