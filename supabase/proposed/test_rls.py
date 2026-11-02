"""Proves the policy set: tenant isolation, anon denial, role-escalation denial, invite rules, retention.
usage: python test_rls.py "host=/tmp port=54329 user=postgres dbname=rlstest" """
import sys, json, uuid, psycopg
DSN = sys.argv[1]; results = []
def check(name, ok, detail=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
A, B, C, D = (str(uuid.uuid4()) for _ in range(4))   # A admin ch1, B staff ch2, C pending member ch1, D staff ch1
con = psycopg.connect(DSN, autocommit=True)
con.execute("insert into auth.users values (%s,'a@x'),(%s,'b@x'),(%s,'c@x'),(%s,'d@x')", (A, B, C, D))
ch1 = con.execute("insert into churches(name) values ('Church One') returning id").fetchone()[0]
ch2 = con.execute("insert into churches(name) values ('Church Two') returning id").fetchone()[0]
con.execute("insert into memberships values (%s,%s,'admin','approved'),(%s,%s,'staff','approved'),(%s,%s,'member','pending'),(%s,%s,'staff','approved')",
            (ch1, A, ch2, B, ch1, C, ch1, D))
con.execute("insert into attendees(church_id,id,name,s) values (%s,'EXPO-001','Alice One','{\"bp\":140}'),(%s,'EXPO-001','Bob Two','{\"bp\":150}')", (ch1, ch2))
def as_user(uid, sql, params=(), claims_extra=None):
    claims = {"sub": uid, "role": "authenticated"} if uid else {}
    if claims_extra: claims.update(claims_extra)
    with psycopg.connect(DSN) as c:
        c.execute("set role " + ("authenticated" if uid else "anon"))
        c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps(claims),))
        try:
            cur = c.execute(sql, params); rows = cur.fetchall() if cur.description else cur.rowcount; c.commit(); return ("ok", rows)
        except Exception as e: c.rollback(); return ("err", type(e).__name__ + ": " + str(e).splitlines()[0])
r = as_user(None, "select * from attendees"); check("anon cannot read attendees", r[0] == "err", r[1])
r = as_user(None, "insert into attendees(church_id,id) values (%s,'X')", (ch1,)); check("anon cannot insert", r[0] == "err", r[1])
r = as_user(A, "select name from attendees"); check("A (ch1 admin) sees only ch1 rows", r == ("ok", [("Alice One",)]), r)
r = as_user(B, "select name from attendees"); check("B (ch2 staff) sees only ch2 rows", r == ("ok", [("Bob Two",)]), r)
r = as_user(B, "select name from attendees where church_id=%s", (ch1,)); check("B cannot read ch1 by filtering church_id", r == ("ok", []), r)
r = as_user(B, "insert into attendees(church_id,id,name) values (%s,'EXPO-999','evil')", (ch1,)); check("B cannot insert into ch1 (forged church_id)", r[0] == "err", r[1])
r = as_user(B, "update attendees set name='pwned' where church_id=%s and id='EXPO-001'", (ch1,)); check("B cannot update ch1 row (IDOR on sequential id)", r == ("ok", 0), r)
r = as_user(B, "update attendees set church_id=%s where id='EXPO-001'", (ch1,)); check("B cannot move own row into ch1", r[0] == "err", r[1])
r = as_user(B, "delete from attendees where church_id=%s", (ch1,)); check("B cannot delete ch1 rows", r == ("ok", 0), r)
r = as_user(B, "insert into attendees(church_id,id,name) values (%s,'EXPO-001','dup') on conflict (church_id,id) do update set name='overwritten'", (ch1,)); check("B upsert cannot overwrite ch1 EXPO-001", r[0] == "err", r[1])
r = as_user(B, "insert into attendees(id,name) values ('EXPO-002','viaclaim')", claims_extra={"app_metadata": {"church_id": str(ch2)}}); check("church_id defaults from JWT claim when omitted", r == ("ok", 1), r)
r = as_user(B, "insert into attendees(id,name) values ('EXPO-003','forgedclaim')", claims_extra={"app_metadata": {"church_id": str(ch1)}}); check("forged JWT claim for foreign church still rejected", r[0] == "err", r[1])
r = as_user(B, "insert into attendees(church_id,id,name) values (%s,'x\"><b id=xss3>','x')", (ch2,)); check("markup in id rejected by CHECK (F-03 server side)", r[0] == "err", r[1])
r = as_user(C, "select * from attendees"); check("C (pending member) sees no visitors", r == ("ok", []), r)
r = as_user(C, "update memberships set role='admin', status='approved' where user_id=auth.uid()"); check("C cannot self-escalate via table update", r[0] == "err", r[1])
r = as_user(C, "insert into memberships values (%s,%s,'admin','approved')", (ch2, C)); check("C cannot insert admin membership", r[0] == "err", r[1])
r = as_user(C, "select staff_approve(%s,%s,'admin')", (ch1, C)); check("C cannot call staff_approve", r[0] == "err", r[1])
r = as_user(D, "select staff_approve(%s,%s,'admin')", (ch1, C)); check("D (staff, not admin) cannot approve", r[0] == "err", r[1])
r = as_user(A, "select staff_approve(%s,%s,'admin')", (ch1, A)); check("A cannot change own role", r[0] == "err", r[1])
r = as_user(A, "select staff_approve(%s,%s,'staff')", (ch2, B)); check("A (ch1 admin) cannot change ch2 roles", r[0] == "err" or r == ("ok", [("",)]) , r)
b_role = con.execute("select role from memberships where user_id=%s", (B,)).fetchone()[0]; check("B's ch2 role unchanged after A's attempt", b_role == "staff", b_role)
r = as_user(A, "select staff_approve(%s,%s,'staff')", (ch1, C)); check("A approves C as staff in ch1 (positive)", r[0] == "ok", r)
r = as_user(C, "select count(*) from attendees"); check("C now sees ch1 rows only", r == ("ok", [(1,)]), r)
code = con.execute("insert into private.invites(church_id) values (%s) returning code", (ch2,)).fetchone()[0]
check("invite code is 128-bit random hex", len(code) == 32, code[:6] + "...")
r = as_user(C, "select join_with_invite(%s)", (code,)); check("C joins ch2 with invite", r[0] == "ok", r)
role = con.execute("select role,status from memberships where user_id=%s and church_id=%s", (C, ch2)).fetchone(); check("joining lands as pending member", role == ("member", "pending"), role)
r = as_user(D, "select join_with_invite(%s)", (code,)); check("invite is single-use", r[0] == "err", r[1])
r = as_user(C, "select count(*) from attendees where church_id=%s", (ch2,)); check("pending member of ch2 still sees 0 ch2 rows", r == ("ok", [(0,)]), r)
con.execute("update attendees set created_at = now() - interval '8 days' where church_id=%s", (ch1,)); con.execute("select private.apply_retention()")
s = con.execute("select s from attendees where church_id=%s", (ch1,)).fetchone()[0]; check("retention wipes readings after 7 days", s == {}, s)
r = as_user(A, "select private.apply_retention()"); check("users cannot call retention job", r[0] == "err", r[1])
con.execute("update churches set status='suspended' where id=%s", (ch1,)); r = as_user(A, "select count(*) from attendees"); check("suspended church: staff lose access", r == ("ok", [(0,)]), r)
n = sum(ok for _, ok in results); print(f"\n{n}/{len(results)} passed"); sys.exit(0 if n == len(results) else 1)
