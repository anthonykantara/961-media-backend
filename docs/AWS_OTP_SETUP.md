# AWS OTP Authentication Setup

This application sends CMS login OTPs through Amazon SES. The application code is intentionally provider-ready, but SES infrastructure is configured separately during the AWS deployment work.

## AWS deployment checklist

1. Choose the SES region and set `AWS_REGION`.
2. Verify the 961 sending domain or sender address in SES.
3. Configure SES DKIM/DNS records for the sending domain.
4. Confirm SES production access if the account is still in the SES sandbox.
5. Give the backend runtime IAM permission for `ses:SendEmail`.
6. Store `JWT_SECRET`, `AUTH_OTP_PEPPER`, `AUTH_EMAIL_FROM`, and `CMS_ADMIN_EMAILS` in AWS Secrets Manager or the deployment secret store.
7. Run `npm run migrate` after the auth migration is deployed.
8. Test the full flow: request OTP -> receive email -> verify -> session restore -> logout.

## Runtime variables

Required: `JWT_SECRET`, `AUTH_OTP_PEPPER`, `AUTH_EMAIL_FROM`, `CMS_ADMIN_EMAILS`, `AWS_REGION`.

Optional: `AUTH_OTP_TTL_MINUTES` (default 10), `AUTH_OTP_MAX_ATTEMPTS` (default 5), `AUTH_OTP_MAX_REQUESTS` (default 3 per 15 minutes per user), `AUTH_SESSION_TTL` (default 8h), `JWT_ISSUER` (default `961-media-cms`), `JWT_AUDIENCE` (default `961-media-dashboard`).

Do not put AWS credentials, JWT secrets, OTP peppers, or SES credentials in the frontend bundle.
