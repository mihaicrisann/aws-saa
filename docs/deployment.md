# Deployment and operations

Production is `https://saa.mihais-vps.xyz`, served by Dokploy on the `hetzner` host.

## What runs there

| Piece | Identifier |
| --- | --- |
| Dokploy project / environment | `aws-saa` / `production` |
| Web application | `m3zQOEcuaRgSZE0ci3542`, Swarm service `aws-saa-web-t88rjg` |
| PostgreSQL | `b6kil19pyHqOcZMsmbVg9`, Swarm service `aws-saa-db-9a4o3k`, image `postgres:17-alpine` |
| Volume | `aws-saa-db-9a4o3k-data` at `/var/lib/postgresql/data` |

Both services sit on the shared Dokploy overlay network. The database publishes no external port, so it is reachable only from inside that network under the host name `aws-saa-db-9a4o3k`.

Resource limits are set both in Dokploy and on the live services, because the host has 3.8 GB of memory and other workloads:

| Service | Memory | CPU |
| --- | --- | --- |
| PostgreSQL | 512 MB limit, 128 MB reservation | 1 |
| Web | 700 MB limit | 1 |

## Deploying

Dokploy builds from `git@github.com:mihaicrisann/aws-saa.git` on branch `main` with autodeploy on, using the root `Dockerfile`. Production only picks up work that has been merged to `main`.

The image is a two-stage build. The build stage runs the lecture build, `next build`, and `tools:build`. The runtime stage is a Node 24 standalone Next.js server on port 80 with a health check against `/api/health`.

## Environment

Runtime secrets live on the server at `/root/aws-saa/production.env`, mode 600. Never print them and never commit them.

The application needs exactly three variables, which are stored in Dokploy and applied on deploy:

```
BETTER_AUTH_SECRET
BETTER_AUTH_URL
DATABASE_URL
```

`OWNER_EMAIL`, `OWNER_PASSWORD` and `OWNER_NAME` are deliberately **not** in the application environment. They are only passed to the one-off provisioning job, so the long-running container never holds them.

## Migration and owner provisioning

The runtime image is a standalone bundle with no TypeScript toolchain and no dev dependencies. The two operational scripts are therefore bundled at build time into `/src/app/tools/` and shipped with the image, alongside the SQL in `/src/app/drizzle/`.

Run them as one-off commands against the running container:

```bash
CID=$(docker ps -qf name=aws-saa-web | head -1)
docker exec -e DATABASE_URL=... "$CID" node tools/migrate.mjs
docker exec -e DATABASE_URL=... -e BETTER_AUTH_SECRET=... -e BETTER_AUTH_URL=... \
  -e OWNER_EMAIL=... -e OWNER_PASSWORD=... "$CID" node tools/provision-owner.mjs
```

Both are idempotent. `migrate.mjs` takes an advisory lock, tracks applied files in `study_migrations` and skips what it already ran. `provision-owner.mjs` creates the owner if missing, otherwise resets the password and revokes existing sessions. Public sign-up stays disabled either way.

## Backups

`/usr/local/bin/aws-saa-backup.sh` runs daily at 03:17 UTC from root's crontab and writes a compressed `pg_dump` to `/root/aws-saa/backups/`, mode 600. Every dump is verified with `pg_restore -l` before it is kept. Sunday dumps are also copied to `backups/weekly/`. Retention is 14 daily and 8 weekly.

**These backups live on the same disk as the database.** They protect against a bad migration, an accidental delete or table corruption. They do not protect against losing the server or the disk. There is no off-server copy and no Dokploy S3 destination.

Restore into a scratch database first, check it, then swap:

```bash
CID=$(docker ps -qf name=aws-saa-db-9a4o3k | head -1)
docker exec "$CID" psql -U aws_saa -d postgres -c "create database restore_check owner aws_saa;"
docker exec -i "$CID" pg_restore -U aws_saa -d restore_check --no-owner < /root/aws-saa/backups/<dump>
docker exec "$CID" psql -U aws_saa -d restore_check -c "select count(*) from progress;"
```

Take a manual dump before anything destructive by running the backup script by hand.
