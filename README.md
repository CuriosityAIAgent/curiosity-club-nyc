# The Curiosity AI Club — New York City

The NYC instance of The Curiosity AI Club: a marketing site, an application form,
and an admin panel to review and export applications. Runs as its own deployment,
separate from the London club.

## Stack

- Node.js + Express (`server.js`)
- Static front end in `public/` (`index.html`, `apply.html`, `admin.html`)
- Applications stored as JSON on disk; uploads saved to the data directory
- No build step — `npm start` runs the server

## Local development

```bash
npm install
npm start           # http://localhost:3000
```

## Pages

| Path          | What it is                                            |
|---------------|-------------------------------------------------------|
| `/`           | Landing page                                          |
| `/apply`      | Application form                                       |
| `/admin`      | Admin dashboard — review applications, export to CSV  |

## Environment variables

| Variable        | Default                | Notes                                              |
|-----------------|------------------------|----------------------------------------------------|
| `PORT`          | `3000`                 | Set automatically by Railway                       |
| `DATA_DIR`      | `./data`               | Point at a mounted volume in production (`/data`)   |
| `NODE_ENV`      | —                      | Set to `production` so admin cookies are secure     |
| `ADMIN_USER`    | `admin`                | Admin login user                                    |
| `ADMIN_PASS`    | `curiosity2026`        | **Change this in production**                        |
| `COOKIE_SECRET` | (built-in default)     | Set a random secret in production                   |
| `NOTIFY_EMAILS` | —                      | Comma-separated list to email on new applications   |
| `SMTP_*`        | —                      | SMTP settings for notification emails               |

## Deployment (Railway)

Deployed on Railway with a persistent volume mounted at `/data` (holds
`applications.json` and uploaded files). Once this repo is connected as the
service source, every push to `main` triggers an automatic deploy.
