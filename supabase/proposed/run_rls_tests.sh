#!/usr/bin/env bash
# Starts a throwaway local Postgres 17 (embedded-postgres binaries), loads mock auth + policies, runs test_rls.py.
set -euo pipefail; D=$(dirname "$(readlink -f "$0")"); T=${PGTOOLS:-$D/../tools}
if [ ! -d "$T/pg/node_modules/@embedded-postgres/linux-x64" ]; then mkdir -p $T/pg && (cd $T/pg && npm init -y >/dev/null && npm i --silent @embedded-postgres/linux-x64@17.5.0-beta.15); fi
[ -x "$T/pgv/bin/python" ] || { python3 -m venv $T/pgv && $T/pgv/bin/pip install -q "psycopg[binary]"; }
N=$T/pg/node_modules/@embedded-postgres/linux-x64/native; export LD_LIBRARY_PATH=$N/lib; PGD=/tmp/rls_pgdata
$N/bin/pg_ctl -D $PGD status >/dev/null 2>&1 || { rm -rf $PGD; $N/bin/initdb -D $PGD -U postgres -A trust >/dev/null; $N/bin/pg_ctl -D $PGD -o "-p 54329 -k /tmp" -l /tmp/rls_pg.log start >/dev/null; sleep 2; }
$T/pgv/bin/python - "$D" <<'P'
import psycopg,sys;d=sys.argv[1]
c=psycopg.connect('host=/tmp port=54329 user=postgres dbname=postgres',autocommit=True);c.execute('drop database if exists rlstest');c.execute('create database rlstest')
c=psycopg.connect('host=/tmp port=54329 user=postgres dbname=rlstest',autocommit=True)
for f in ['00_mock_supabase.sql','10_rls_policies.sql']: c.execute(open(f'{d}/{f}').read())
P
$T/pgv/bin/python $D/test_rls.py "host=/tmp port=54329 user=postgres dbname=rlstest"
