# Weekly Check-in Script Guide

This script sends a Telegram message to users with `Next_Week_Status = "Passive"`, asking if they want to participate next week.

## 🎯 Purpose
- **Target Audience:** Users who are marked as "Passive" (not participating).
- **Goal:** Re-engage them for the upcoming week.
- **Action:** Sends a message with "Yes! I'm in!" and "No, I'll skip" buttons.
  - **"Yes"**: Updates status to **Active** in Airtable and confirms.
  - **"No"**: Acknowledges and leaves status as Passive.

## 📋 Filters
The script selects users who meet **ALL** of the following criteria:
1.  **Have a Telegram ID** (`Tg_ID` is not empty).
2.  **Status is Passive** (`Next_Week_Status` = "Passive").
3.  **No Spam is Unchecked** (`No_Spam` is NOT checked).

---

## 🚀 How to Run

### Option 1: Run Locally (Recommended for Development)
Ensure you have the `.env` file in the project root.

```bash
# From the project root
node backend/scripts/weekly-checkin.js --dry-run
```

### Option 2: Run on Server (Recommended for Production)
This runs the script inside the running backend container, ensuring the correct production environment.

1.  SSH into the server:
    ```bash
    ssh root@91.98.235.147
    ```

2.  Run the script command:
    ```bash
    docker exec linking-coffee-backend node scripts/weekly-checkin.js --dry-run
    ```

---

## ⚙️ Modes & Flags

### 1. Dry Run (Safe Mode)
**Flag:** `--dry-run`
- Fetches all eligible users.
- Logs who *would* receive a message.
- **Does NOT** send any messages.

```bash
node backend/scripts/weekly-checkin.js --dry-run
```

### 2. Test Mode
**Flag:** `--test`
- Fetches all eligible users.
- Sends a real message **ONLY** to the test Telegram ID (`379053`).
- Use this to verify the message appearance and button functionality on a real device.

```bash
node backend/scripts/weekly-checkin.js --test
```

### 3. Live Mode (Production)
**Flag:** (No flag)
- **WARNING:** This will send messages to **ALL** eligible users immediately.

```bash
node backend/scripts/weekly-checkin.js
```
