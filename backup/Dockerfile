FROM postgres:16-alpine3.24 AS postgres-client

# Backups need PostgreSQL clients, not the database server and its extensions.
# Keep both stages on the same Alpine release for musl/library compatibility.
FROM alpine:3.24 AS runner

# Refresh security fixes independently of the upstream PostgreSQL image rebuild.
RUN apk upgrade --no-cache

RUN apk add --no-cache ca-certificates krb5-libs libldap libedit flock \
  zstd-libs lz4-libs libssl3 libcrypto3 zlib
COPY --from=postgres-client /usr/local/bin/pg_dump /usr/local/bin/pg_restore /usr/local/bin/pg_isready /usr/local/bin/psql /usr/local/bin/
COPY --from=postgres-client /usr/local/lib/libpq.so.5* /usr/local/lib/

COPY backup/container-backup.sh /usr/local/bin/stato-container-backup
COPY backup/scheduler.sh /usr/local/bin/stato-backup-scheduler
RUN chmod 0555 /usr/local/bin/stato-backup-scheduler
RUN chmod 0555 /usr/local/bin/stato-container-backup \
  && pg_dump --version && pg_restore --version && pg_isready --version && psql --version

ENTRYPOINT ["/bin/sh", "-lc"]
CMD ["/usr/local/bin/stato-backup-scheduler"]
