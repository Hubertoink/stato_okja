FROM postgres:16-alpine

COPY backup/container-backup.sh /usr/local/bin/stato-container-backup
RUN chmod 0555 /usr/local/bin/stato-container-backup

ENTRYPOINT ["/bin/sh", "-lc"]
CMD ["sleep infinity"]
