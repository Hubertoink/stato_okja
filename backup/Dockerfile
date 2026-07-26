FROM postgres:16-alpine

COPY backup/container-backup.sh /usr/local/bin/stato-container-backup
# The official postgres entrypoint (and its gosu helper) is intentionally not
# used below: this image only runs pg_dump and the StatO backup command.
# Remove the unused Go binary from the final image to avoid carrying its
# unrelated runtime vulnerabilities.
RUN chmod 0555 /usr/local/bin/stato-container-backup \
  && rm -f /usr/local/bin/gosu

ENTRYPOINT ["/bin/sh", "-lc"]
CMD ["sleep infinity"]
