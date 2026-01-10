#!/bin/bash

# ==============================================================================
# 🧪 TEST MATCHING WORKFLOW (DRY RUN)
# ==============================================================================
# This script runs the FULL matching pipeline but in DRY-RUN mode.
# It checks:
# 1. System Health (Pre-Flight)
# 2. MATCHING Logic (Gemini) -> Prints proposed matches
# 3. Does NOT save to Airtable, NO Notifications.
# ==============================================================================

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${YELLOW}🧪 STARTING TEST RUN (DRY-RUN) 🧪${NC}\n"

# 1. Pre-Flight Check
echo -e "${YELLOW}Step 1: System Health Check...${NC}"
if node backend/scripts/pre-flight-check.js; then
    echo -e "${GREEN}✅ System Healthy.${NC}\n"
else
    echo -e "${RED}❌ System Check Failed. Fix issues before testing.${NC}"
    exit 1
fi

# 2. Run Matcher in Dry Run
echo -e "${YELLOW}Step 2: Testing AI Matching Logic (DRY RUN)...${NC}"
echo -e "   (This uses real AI credits but won't save data)"

node backend/scripts/match-users-ai.js --dry-run

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Test Completed Successfully.${NC}"
    echo -e "Check the output above to see proposed matches."
else
    echo -e "\n${RED}❌ Test Failed (Script Crashed).${NC}"
    exit 1
fi
