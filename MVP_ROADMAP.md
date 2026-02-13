# MVP Roadmap — iotivate.dev

## Current Status: Pre-Launch Ready

Strong engineering foundation (auth, CRUD, payments, file uploads, web flashing).
Remaining gaps are security hardening, observability, and test coverage.

---

## Must Fix Before Launch

- [x] 1. **Admin user creation flow** — No way to bootstrap first admin without raw SQL
- [x] 2. **Database migrations (Alembic)** — Schema changes will corrupt prod data
- [x] 3. **Production Dockerfiles** — Currently running `--reload` and `next dev` in containers
- [x] 4. **Contact form email notifications** — Messages saved to DB but nobody gets notified
- [x] 5. **Password reset flow** — Locked-out users have no recovery path
- [x] 6. **Token refresh mechanism** — Users silently logged out after 60 min
- [x] 7. **robots.txt and sitemap.xml** — Search engines can't index properly
- [x] 8. **Security headers** — Missing HSTS, CSP, X-Frame-Options
- [x] 9. **Logging and error tracking** — Blind to production issues
- [x] 10. **Tests** — 98 backend (pytest) + 14 frontend (vitest) tests passing

---

## Should Have Soon After Launch

- [x] 11. **API response pagination** — All list endpoints return `{items, total, skip, limit}` with admin pagination controls
- [x] 12. **File cleanup on project delete** — R2 objects extracted from project JSON fields and deleted before DB removal
- [x] 13. **Analytics integration** — Plausible script conditional on `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, CSP updated
- [x] 14. **Database backup strategy** — `backend/scripts/backup.sh` with pg_dump, gzip, timestamped files, retention cleanup
- [x] 15. **Blog content** — 5 posts total (smart relay, Web Serial API, OTA updates, ESP32 modules, welcome)
- [x] 16. **Admin UI mobile responsiveness** — Nav overflow, card layouts, button groups stack on mobile
- [x] 17. **Webhook event logging & sync** — WebhookEvent model logs all events, admin page with sync button

---

## Deployment Checklist

- [ ] SECRET_KEY is strong (not default)
- [ ] DATABASE_URL points to managed PostgreSQL
- [ ] R2 credentials are scoped IAM (not root)
- [ ] Lemon Squeezy keys configured + webhook URL set in dashboard
- [ ] CORS_ORIGINS restricted to production domain only
- [ ] TLS/HTTPS certificates configured
- [ ] Admin account created and tested
- [ ] Dockerfiles switched to production builds
- [ ] Contact form email delivery verified
- [ ] Payment webhook tested with Lemon Squeezy sandbox
