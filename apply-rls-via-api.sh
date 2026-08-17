#!/bin/bash

# Get credentials from .env.local
source .env.local

PROJECT_ID=$(echo $VITE_SUPABASE_URL | grep -oE '[^/]+\.supabase\.co' | cut -d. -f1)

# Read the SQL file
SQL_COMMANDS="
DROP POLICY IF EXISTS \"users_insert_own\" ON public.users;
DROP POLICY IF EXISTS \"students_insert_own\" ON public.students;

CREATE POLICY \"users_insert_own\" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY \"students_insert_own\" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
"

echo "Attempting to apply RLS policies via REST API..."
echo "Project ID: $PROJECT_ID"
echo "URL: $VITE_SUPABASE_URL"

# Try to execute via PostgREST or admin API
curl -X POST "${VITE_SUPABASE_URL}/rest/v1/rpc/sql" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": \"$SQL_COMMANDS\"}" \
  2>&1 || echo "REST API call failed (may not exist)"
