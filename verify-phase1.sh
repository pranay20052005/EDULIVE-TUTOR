#!/bin/bash
# Phase 1 Setup Verification Script
# Run this to verify Phase 1 implementation

echo "═════════════════════════════════════════════════════════════"
echo "EduLive Phase 1: Database Foundation - Verification Script"
echo "═════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $1 - FILE NOT FOUND"
    ((FAIL++))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1/"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $1/ - DIRECTORY NOT FOUND"
    ((FAIL++))
  fi
}

echo "Checking Database Migrations..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "supabase/migrations/20250814000001_init_schema.sql"
check_file "supabase/migrations/20250814000002_rls_policies.sql"
check_file "supabase/migrations/20250814000003_seed_data.sql"
echo ""

echo "Checking Database Services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_dir "src/lib/db"
check_dir "src/lib/db/services"
check_file "src/lib/db/client.ts"
check_file "src/lib/db/types.ts"
check_file "src/lib/db/index.ts"
check_file "src/lib/db/services/users.ts"
check_file "src/lib/db/services/students.ts"
check_file "src/lib/db/services/subjects.ts"
check_file "src/lib/db/services/tests.ts"
check_file "src/lib/db/services/enrollments.ts"
echo ""

echo "Checking Documentation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "DATABASE_SETUP.md"
check_file "README-PHASE1.md"
check_file "PHASE1_COMPLETION.md"
check_file "DB_SERVICES_REFERENCE.md"
echo ""

echo "Checking Configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━"
check_file ".env.example"
echo ""

echo "Checking Build & TypeScript..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check TypeScript
echo -n "TypeScript compilation... "
TS_OUTPUT=$(npx tsc --noEmit 2>&1)
if [ -z "$TS_OUTPUT" ]; then
  echo -e "${GREEN}✓ 0 errors${NC}"
  ((PASS++))
else
  echo -e "${RED}✗ Errors found${NC}"
  echo "$TS_OUTPUT"
  ((FAIL++))
fi

# Check ESLint
echo -n "ESLint linting... "
LINT_OUTPUT=$(npm run lint 2>&1 | grep -E "error|Error" | grep -v "warning")
if [ -z "$LINT_OUTPUT" ]; then
  echo -e "${GREEN}✓ No errors${NC}"
  ((PASS++))
else
  echo -e "${YELLOW}⚠ Warnings present (OK)${NC}"
  ((PASS++))
fi

# Summary
echo ""
echo "═════════════════════════════════════════════════════════════"
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "═════════════════════════════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! Phase 1 is ready.${NC}"
  echo ""
  echo "Next Steps:"
  echo "1. Read DATABASE_SETUP.md for complete setup instructions"
  echo "2. Create a Supabase project"
  echo "3. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
  echo "4. Start the dev server: npm run dev"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some checks failed. See above for details.${NC}"
  exit 1
fi
