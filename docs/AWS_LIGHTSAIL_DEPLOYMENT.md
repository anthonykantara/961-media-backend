# 961 Media AWS deployment

This is the low-cost production deployment for the 961 Media backend.

## Target architecture

```text
Cloudflare
   |
   v
api.the961.com
   |
   v
Lightsail Ubuntu instance
  Nginx :80/:443
   |
   v
Node/Express :5000
   |
   +--> PostgreSQL (same instance, localhost only)
   +--> AWS Secrets Manager: 961-MEDIA-BACKEND
   +--> Wasabi: the961-media / media.the961.com
```

Use a 2 GB / 2 vCPU Lightsail Linux instance as the starting size. Do not expose PostgreSQL to the internet. Keep media in Wasabi.

## AWS region

Lightsail is not currently listed as available in Milan (`eu-south-1`). Use the nearest supported European Lightsail region available to the account, such as Paris, Frankfurt, or Spain, while keeping Wasabi in Milan. See the current AWS Lightsail region list before creating the instance.

## 1. Create the Lightsail instance

Create an Ubuntu Linux instance with:

- Plan: 2 GB RAM / 2 vCPU
- Region: nearest supported European Lightsail region
- Instance name: `961-media-api`
- Static IPv4: attach one and keep it for the instance

Networking:

- Allow TCP 22 for administration. Restrict the source IP to your office/home IP when practical.
- Allow TCP 80.
- Allow TCP 443.
- Do not open TCP 5432.

## 2. AWS Secrets Manager access

The application already loads the shared `961-MEDIA-BACKEND` secret through the AWS SDK.

Lightsail does not provide the same EC2 instance-profile model for application credentials. For this Lightsail deployment, use a dedicated IAM identity with the minimum permission needed to read this single secret, and place its credentials in the root-owned environment file on the server. Do not commit them to GitHub.

Minimum policy shape:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:<aws-region>:<account-id>:secret:961-MEDIA-BACKEND-*"
    }
  ]
}
```

Use the same AWS region where the `961-MEDIA-BACKEND` secret exists. The application reads `AWS_REGION` from the environment and defaults to `us-east-1` only when it is absent.

## 3. Server bootstrap

On the instance:

```bash
sudo apt-get update
sudo apt-get install -y git nginx postgresql postgresql-contrib awscli
```

Install Node.js 20 LTS using the current NodeSource instructions, then verify:

```bash
node --version
npm --version
psql --version
nginx -v
aws --version
```

Create the service account and application directory:

```bash
sudo useradd --system --create-home --home-dir /opt/961-media-backend --shell /usr/sbin/nologin 961media || true
sudo mkdir -p /opt/961-media-backend
sudo chown -R 961media:961media /opt/961-media-backend
```

Clone the production repository and install dependencies:

```bash
cd /opt/961-media-backend
sudo -u 961media git clone https://github.com/anthonykantara/961-media-backend.git .
sudo -u 961media npm ci --omit=dev
```

## 4. PostgreSQL

Create a database and application user locally:

```bash
sudo -u postgres psql
```

Then create a database/user with a long random password:

```sql
CREATE USER media_app WITH PASSWORD '<strong-random-password>';
CREATE DATABASE media OWNER media_app;
\q
```

Create `/etc/961-media-backend.env` with mode `0600`:

```bash
sudo install -m 0600 /dev/null /etc/961-media-backend.env
sudo nano /etc/961-media-backend.env
```

Recommended contents:

```dotenv
NODE_ENV=production
PORT=5000
AWS_REGION=<secret-region>
MEDIA_BACKEND_SECRET_NAME=961-MEDIA-BACKEND
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=media
PGUSER=media_app
PGPASSWORD=<strong-random-password>
WEBSITE_URL=https://the961.com
DASHBOARD_URL=https://cms.the961.com
MEDIA_CDN_URL=https://media.the961.com
```

For the Lightsail deployment, add the dedicated IAM access key credentials to this file only if the instance cannot use another temporary-credential mechanism:

```dotenv
AWS_ACCESS_KEY_ID=<dedicated-secret-reader-access-key>
AWS_SECRET_ACCESS_KEY=<dedicated-secret-reader-secret-key>
```

These credentials must be scoped only to `secretsmanager:GetSecretValue` on `961-MEDIA-BACKEND`.

## 5. Run migrations

```bash
cd /opt/961-media-backend
sudo -u 961media npm run migrate
```

Migration `009_seed_lebanon_location.sql` ensures a clean database starts with Lebanon as the only default location.

## 6. Install systemd service

Copy the service file from the repository:

```bash
sudo cp /opt/961-media-backend/ops/lightsail/961-media-backend.service /etc/systemd/system/961-media-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now 961-media-backend
sudo systemctl status 961-media-backend
```

Check logs:

```bash
sudo journalctl -u 961-media-backend -n 200 --no-pager
```

The API must bind only to the local application port. Nginx is the public entrypoint.

## 7. Configure Nginx

```bash
sudo cp /opt/961-media-backend/ops/lightsail/nginx.conf /etc/nginx/sites-available/961-media-api
sudo ln -s /etc/nginx/sites-available/961-media-api /etc/nginx/sites-enabled/961-media-api || true
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

The checked-in config uses `api.the961.com` and proxies to `127.0.0.1:5000`.

Before enabling Cloudflare proxying, point `api.the961.com` to the Lightsail static IPv4 address. For production TLS, install a Cloudflare Origin Certificate on the instance and change the Nginx site to listen on `443 ssl`; then use Cloudflare SSL mode `Full (strict)`.

## 8. Configure Cloudflare

Create the DNS record:

```text
Type: A
Name: api
Target: <Lightsail static IPv4>
Proxy: Proxied
```

Cloudflare should be the public edge. Do not use `api.961.co`, which belongs to the main 961 App.

After the API hostname is live, set the Media web and CMS build variable to:

```text
VITE_API_URL=https://api.the961.com
```

Do not put AWS, Wasabi, Gemini, JWT, OTP, or database secrets in Cloudflare frontend environment variables.

## 9. Backups to Wasabi

Create `/etc/961-media-backup.env` with mode `0600`:

```dotenv
PGHOST=127.0.0.1
PGDATABASE=media
PGUSER=media_app
PGPASSWORD=<strong-random-password>
WASABI_BUCKET=the961-media
WASABI_REGION=eu-south-1
WASABI_ENDPOINT=https://s3.eu-south-1.wasabisys.com
WASABI_ACCESS_KEY_ID=<backup-key>
WASABI_SECRET_ACCESS_KEY=<backup-secret>
```

Use a dedicated Wasabi key limited to the `the961-media/backups/postgres/` prefix where practical.

Install the script:

```bash
sudo install -m 0750 -o root -g root /opt/961-media-backend/ops/lightsail/backup-postgres.sh /usr/local/sbin/961-media-backup
```

Test manually:

```bash
sudo /usr/local/sbin/961-media-backup
```

Run it nightly with root cron:

```bash
sudo crontab -e
```

Add:

```cron
17 2 * * * /usr/local/sbin/961-media-backup >> /var/log/961-media-backup.log 2>&1
```

The script uploads a timestamped custom-format PostgreSQL dump to Wasabi and keeps a 7-day local recovery window. Configure a Wasabi lifecycle rule to retain remote backups according to the desired policy: 7 daily, 4 weekly, and 3 monthly recovery points.

## 10. Release procedure

For each backend release:

```bash
cd /opt/961-media-backend
sudo -u 961media git fetch origin
sudo -u 961media git checkout main
sudo -u 961media git reset --hard origin/main
sudo -u 961media npm ci --omit=dev
sudo -u 961media npm run migrate
sudo systemctl restart 961-media-backend
sudo systemctl status 961-media-backend --no-pager
```

Validate the public API through `https://api.the961.com` before changing frontend builds.

## 11. Scale only when needed

Keep the one-instance setup until there is a real bottleneck or availability requirement. First scale vertically within Lightsail. Move PostgreSQL to RDS only when database availability, independent scaling, backups, or operational risk justify the additional cost.

Do not add ECS/Fargate, an ALB, NAT Gateway, Redis, CloudFront, or a separate RDS database at launch.
