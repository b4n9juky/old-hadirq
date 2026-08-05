#!/bin/sh

# Wait for MySQL to be ready
until mysqladmin ping -h127.0.0.1 -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent; do
    echo 'Waiting for MySQL to be ready...' >&2
    sleep 2
done

# Check if database exists, if not create it
if ! mysql -h127.0.0.1 -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "SHOW DATABASES LIKE '${MYSQL_DATABASE}'" | grep -q "${MYSQL_DATABASE}"; then
    echo 'Creating database ${MYSQL_DATABASE}...' >&2
    mysql -h127.0.0.1 -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

# Check if there are any SQL files to execute (for initial setup)
for f in /docker-entrypoint-initdb.d/*.sql; do
    if [ -f "$f" ]; then
        echo "Running $(basename $f)..." >&2
        mysql -h127.0.0.1 -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" < "$f"
    fi
done