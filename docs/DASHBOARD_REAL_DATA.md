This branch adds database-backed CMS dashboard endpoints used by the dashboard cleanup PR.

Dependency: CMS OTP auth PR #19 is now merged, so the admin routes use the live authentication middleware and users table.

Apply migration 008_create_cms_messages.sql before using the Messages screen.
