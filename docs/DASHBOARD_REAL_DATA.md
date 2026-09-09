This branch adds database-backed CMS dashboard endpoints used by the dashboard cleanup PR.

Dependency: merge CMS OTP auth PR first so /api/admin endpoints have the final authentication middleware and users table.

Apply migration 007_create_cms_messages.sql before using the Messages screen.
