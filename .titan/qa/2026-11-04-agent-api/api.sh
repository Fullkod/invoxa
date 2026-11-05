#!/usr/bin/env bash
# QA for agent-api (PRP-002). Usage: qa_agent_api.sh <step>
S="$(dirname "$0")"  # key file: qa_key.txt (temporary, deleted after QA)
API="https://prabpfidllznbtthmkxz.supabase.co/functions/v1/agent-api"
KEY="$(cat "$S/qa_key.txt")"
AUTH="Authorization: Bearer $KEY"
req() { # method path [json]
  local m="$1" p="$2" b="${3:-}"
  if [ -n "$b" ]; then
    curl -s -w '  [HTTP %{http_code}]\n' -X "$m" "$API$p" -H "$AUTH" -H 'Content-Type: application/json' --data-binary "$b"
  else
    curl -s -w '  [HTTP %{http_code}]\n' -X "$m" "$API$p" -H "$AUTH"
  fi
}
case "$1" in
  auth)
    echo "-- sin key";  curl -s -w '  [HTTP %{http_code}]\n' "$API/"
    echo "-- key falsa"; curl -s -w '  [HTTP %{http_code}]\n' "$API/" -H 'Authorization: Bearer ivx_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    echo "-- GET /"; req GET /
    echo "-- GET /projects"; req GET /projects ;;
  create)
    echo "-- POST Microscope 1.5h"; req POST /tasks '{"project":"Microscope","task_date":"2026-11-04","hours":1.5,"name":"QA PRP-002: prueba de la Agent API","description":"Tarea de prueba creada por Claude Code, se borra al terminar"}'
    echo "-- POST microscope (minúsculas) '2,5'"; req POST /tasks '{"project":"microscope","task_date":"2026-11-04","hours":"2,5","name":"QA PRP-002: segunda tarea"}' ;;
  invalid)
    echo "-- horas 30"; req POST /tasks '{"project":"Microscope","hours":30,"name":"QA x"}'
    echo "-- proyecto inexistente"; req POST /tasks '{"project":"Nope","hours":1,"name":"QA x"}'
    echo "-- campo extra"; req POST /tasks '{"project":"Microscope","hours":1,"name":"QA x","user_id":"968552f1-1d76-4e6c-b2a1-698383bcfb53"}'
    echo "-- tarea de otro usuario"; req PATCH /tasks/968552f1-1d76-4e6c-b2a1-698383bcfb53 '{"hours":9}'
    echo "-- borrar tarea de otro usuario"; req DELETE /tasks/968552f1-1d76-4e6c-b2a1-698383bcfb53
    echo "-- ruta desconocida"; req GET /nope
    echo "-- mes inválido"; req GET '/summary?month=2026-13' ;;
  patch) echo "-- PATCH $2"; req PATCH "/tasks/$2" '{"hours":2,"observations":"editada por QA"}' ;;
  billed) echo "-- PATCH facturada"; req PATCH "/tasks/$2" '{"hours":3}'; echo "-- DELETE facturada"; req DELETE "/tasks/$2" ;;
  read)
    echo "-- tasks Microscope sin facturar"; req GET '/tasks?project=Microscope&billed=false&from=2026-11-01'
    echo "-- summary"; req GET '/summary?month=2026-11'
    echo "-- invoices"; req GET /invoices ;;
  delete) echo "-- DELETE $2"; req DELETE "/tasks/$2" ;;
  revoked) echo "-- tras revocar"; req GET / ;;
esac
