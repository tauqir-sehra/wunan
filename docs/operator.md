# Running wunan: operator guide

This guide is for the person who hosts wunan for a community. It assumes you are comfortable
with a Linux server, a terminal, and Docker.

wunan runs as four containers, started together with Docker Compose:

| Service | What it does | Reachable from |
|---------|--------------|----------------|
| `caddy` | HTTPS (certificates from Let's Encrypt, renewed automatically); sends `/api/*` to the API and everything else to the web app | The internet (ports 80 and 443) |
| `web` | The website members use | Caddy only |
| `api` | All data and rules; the API other apps (e.g. a future Android app) use | Caddy and the web app only |
| `postgres` | The database | The API only |

Data lives in Docker volumes: `database` (PostgreSQL), `photos` (listing photos), and
`caddy-data` (certificates).

## Requirements

- A Linux server with Docker Engine and the Docker Compose plugin. 1 CPU and 1 GB of memory is
  enough for a few hundred members; 2 GB is more comfortable.
- A domain name (for example `share.example.org`) whose DNS points to the server, with ports 80
  and 443 open.
- An email account wunan can send from over SMTP (your email provider, or a sending service).
- **Encrypted storage.** The disk holding the Docker volumes must be encrypted (for example LUKS
  full-disk encryption, or your provider's encrypted volumes), and so must every backup. The
  database contains members' emails, messages and contact details.

## First start

1. Get the code and create your settings file:

   ```bash
   git clone <repository URL> wunan && cd wunan
   cp .env.example .env
   chmod 600 .env
   ```

2. Fill in `.env`. Every setting is described in the file; these are the ones you must change:

   | Setting | What to put |
   |---------|-------------|
   | `SITE_URL` | Your address with `https://`, e.g. `https://share.example.org`. Caddy gets the certificate for this name. |
   | `POSTGRES_PASSWORD` | A new random password: `openssl rand -hex 24` |
   | `BETTER_AUTH_SECRET` | A new random secret: `openssl rand -base64 32`. Changing it later signs everyone out. |
   | `DATA_ENCRYPTION_KEY` | A new random key: `openssl rand -base64 32`. **See "The encryption key" below before you go on.** |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Your email provider's SMTP details (port 587 with STARTTLS is typical). |
   | `MAIL_FROM` | The sender members see, e.g. `wunan <no-reply@share.example.org>` |
   | `TZ` | Your community's time zone, e.g. `Europe/London`. Return reminders go out the day after something was due, in this time zone. |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional, for notifications on phones and computers. Leave empty to offer email notifications only. See below. |

   `DATABASE_URL`, `API_INTERNAL_URL`, `API_PORT` and `PHOTOS_DIR` are for development only;
   `compose.yaml` sets them for you.

3. Start wunan:

   ```bash
   docker compose up -d --build
   ```

   The first build takes a few minutes. The API sets up the database by itself. Check that
   everything is running (all four services should be `running`, the API `healthy`):

   ```bash
   docker compose ps
   ```

   Then open your `SITE_URL`. You should see the sign-in page.

4. Create the founding members. wunan is invite-only; founding members are the start of every
   invite chain, and they are the last people asked for help when a problem can't be settled
   (see the help pages). Run this once per founding member; it asks for their email, name and
   password:

   ```bash
   docker compose exec api node scripts/create-founder.ts
   ```

   Founding members sign in and invite everyone else from the Invitations page.

### Device notifications (optional)

Members can get quiet notifications on their phones and computers, without an app store, if you
create a key pair once:

```bash
docker run --rm node:24-slim npx -y web-push@3.6.7 generate-vapid-keys
```

Put the two keys in `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, set `VAPID_SUBJECT` to
`mailto:` and an address where browser makers can reach you, and restart
(`docker compose up -d`). Keep the same keys from then on: new keys make every member turn
device notifications on again.

## The encryption key

`DATA_ENCRYPTION_KEY` encrypts members' private contact details (phone numbers and emails they
can choose to share) inside the database. **If the key is lost, those details can never be read
again**, even from a backup. A leaked key, together with a copy of the database, exposes them.

- Store a copy of the whole `.env` file in a password manager or another safe place, **separate
  from your backups**. A backup and its key should never sit in the same place.
- Never change the key on a running community: details saved with the old key become unreadable.

## Backups

Back up two things: the database and the photos volume. Do it daily (for example from cron),
encrypt every backup, and keep copies off the server.

Backups are encrypted with [age](https://age-encryption.org). Create a key pair once, on a
machine other than the server:

```bash
age-keygen -o wunan-backup.key      # keep this private key safe and offline
```

The command prints a public key (`age1…`). Only that public key goes on the server; the server
can then make backups but can't read them.

**Make a backup** (from the `wunan` folder on the server):

```bash
RECIPIENT=age1...   # your public key
STAMP=$(date +%F)
docker compose exec -T postgres pg_dump -U wunan --format=custom wunan \
  | age -r "$RECIPIENT" > "wunan-db-$STAMP.dump.age"
docker run --rm -v wunan_photos:/photos:ro alpine tar -C /photos -czf - . \
  | age -r "$RECIPIENT" > "wunan-photos-$STAMP.tar.gz.age"
```

Copy both files somewhere off the server, then delete old backups you no longer need. Test a
restore now and then; a backup that has never been restored is only a hope.

**Restore** (on a fresh install, after "First start" steps 1–3 with the **same `.env`**):

```bash
docker compose stop api web
age -d -i wunan-backup.key wunan-db-2026-06-04.dump.age \
  | docker compose exec -T postgres pg_restore -U wunan -d wunan --clean --if-exists
age -d -i wunan-backup.key wunan-photos-2026-06-04.tar.gz.age \
  | docker run --rm -i -v wunan_photos:/photos alpine sh -c 'tar -C /photos -xzf - && chown -R 1000:1000 /photos'
docker compose start api web
```

(`age -d` needs the private key, so decrypt on a trusted machine and copy the result over a
secure connection if the server shouldn't hold it.)

## Updates

```bash
git pull
docker compose up -d --build
```

The API applies any database changes when it starts. Back up before updating. Read the release
notes for anything that needs doing by hand.

For maintainers, the routine for checking and updating dependencies is in
[CONTRIBUTING.md](../CONTRIBUTING.md#dependencies).

## Logs

```bash
docker compose logs -f api      # or web, caddy, postgres
```

The API writes one line of JSON per request and event. By design, logs never contain emails,
tokens, passwords, messages or contact details, so they are safe to keep and share when asking
for help.

## Good to know

- **Return reminders** and the clean-up of unconfirmed sign-ups run inside the API once an hour.
  There is nothing to schedule.
- **The API on its own**: other apps can use the API at `https://<your address>/api/v1/`; its
  description is at `/api/v1/openapi.json`.
- **Members leaving**: members delete their own accounts in Settings → Leave wunan. Only their
  display name is kept. There is no way for an operator to remove, suspend or penalise a member;
  wunan is built that way on purpose.
- **Stopping**: `docker compose down` stops wunan and keeps all data. `docker compose down -v`
  **deletes all data**, including the database and photos.
