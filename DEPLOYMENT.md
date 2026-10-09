# EXCPIX deployment

This project runs locally and on a Linux VPS with the same Next.js commands.
Production uses PostgreSQL. The embedded database is only for local development
or an explicitly configured demo environment.

## Local setup

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
cp .env.example .env.local
openssl rand -hex 32
npm run dev
```

Put the generated 64-character value in `ENCRYPTION_KEY`. For local-only
development, leave `DATABASE_URL` empty and set `DEMO_MODE=true`; data is stored
in `.data/postgres` and is ignored by Git. Open `http://localhost:3000`.

## VPS setup

Upload the project to a private directory such as `/var/www/excpix` and run:

```bash
cd /var/www/excpix
npm ci
cp .env.example .env
openssl rand -hex 32
nano .env
npm run build
npm install --global pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Set these production values in `.env` before building:

```env
NODE_ENV=production
APP_URL=https://example.com
DATABASE_URL=postgresql://excpix:strong-password@127.0.0.1:5432/excpix
ENCRYPTION_KEY=64-character-hex-value
OWNER_EMAIL=admin@example.com
OWNER_PASSWORD=strong-admin-password
DEMO_MODE=false
```

Create the PostgreSQL database and user before the first start. The application
creates its tables and initial catalog data on the first database connection.
Never commit `.env`, database credentials, or uploaded assets.

## Nginx and HTTPS

Copy `deploy/nginx/excpix.conf.example` to `/etc/nginx/sites-available/excpix`,
replace `example.com`, then enable and validate it:

```bash
sudo ln -s /etc/nginx/sites-available/excpix /etc/nginx/sites-enabled/excpix
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d example.com -d www.example.com
```

The app listens on port 3000 and Nginx serves the public domain. Localhost
continues to work because Next.js listens on `0.0.0.0`.

## Updates

```bash
cd /var/www/excpix
git pull
npm ci
npm run build
pm2 restart excpix --update-env
```

Verify `/`, `/tools/3d-text`, sign-in, project save, and export after an update.
