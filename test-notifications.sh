#!/bin/bash

# ==============================================================================
# 🧪 TEST NOTIFICATIONS (DRY RUN)
# ==============================================================================
# This workflow tests the notification scripts in DRY-RUN or TEST mode.
# It ensures formatting is correct without spamming real users.
# ==============================================================================

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${YELLOW}🧪 STARTING NOTIFICATION TESTS 🧪${NC}\n"

# 1. Matches Notification
echo -e "${YELLOW}Step 1: Notify Matches (Dry Run)${NC}"
echo -e "   Checking logic for sending match notifications..."
node backend/scripts/notify-matches.js --dry-run
if [ $? -ne 0 ]; then echo -e "${RED}❌ Match Notifications Failed${NC}"; exit 1; fi

# 2. Weekend Feedback
echo -e "\n${YELLOW}Step 2: Weekend Feedback (Dry Run)${NC}"
echo -e "   Checking logic for feedback requests..."
node backend/scripts/weekend-feedback.js --dry-run
if [ $? -ne 0 ]; then echo -e "${RED}❌ Feedback Notifications Failed${NC}"; exit 1; fi

# 3. Weekend Invitation
echo -e "\n${YELLOW}Step 3: Weekend Invitation (Dry Run)${NC}"
echo -e "   Checking logic for next week's invitations..."
node backend/scripts/weekend-invitation-all.js --dry-run
if [ $? -ne 0 ]; then echo -e "${RED}❌ Invitation Notifications Failed${NC}"; exit 1; fi

# 4. Midweek Check-in
echo -e "\n${YELLOW}Step 4: Midweek Check-in (Dry Run)${NC}"
echo -e "   Checking logic for midweek status checks..."
node backend/scripts/midweek-checkin.js --dry-run
if [ $? -ne 0 ]; then echo -e "${RED}❌ Midweek Check-in Failed${NC}"; exit 1; fi

echo -e "\n${GREEN}✅ ALL NOTIFICATION SCRIPTS PASSED DRY-RUN.${NC}"
echo -e "Use '--test' flag manually if you want to receive actual messages to Admin Chat."
