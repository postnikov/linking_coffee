# Hybrid Telegram Authentication Mechanism

This document describes the two-step registration and authentication flow used in Linked.Coffee. This mechanism allows users to log in using their Telegram username, verifying their identity via a One-Time Password (OTP) sent through a Telegram Bot.

## Overview

The system uses a "Hybrid" approach:
1.  **Web Interface**: Initiates the login and accepts the OTP.
2.  **Telegram Bot**: Acts as the secure delivery channel for the OTP.
3.  **Backend**: Orchestrates the flow, manages OTP state, and updates the database.

## Components

*   **Frontend**: React application with a 2-step form.
*   **Backend**: Node.js/Express server.
*   **Bot**: Telegraf-based Telegram bot running within the backend process.
*   **Database**: Airtable (or any DB) storing User records.

## Detailed Flow

### Step 1: Username Submission

**User Action**: Enters Telegram username (e.g., `@john_doe`) on the web.
**API Call**: `POST /api/register`

**Backend Logic**:
1.  Normalizes username (lowercase, remove `@`).
2.  Checks Database for existing record.
3.  **Scenario A: User has `Tg_ID` (Existing & Linked)**
    *   Backend generates a 6-digit OTP.
    *   Stores OTP in memory (mapped to username, with expiry).
    *   **Proactively** sends OTP to the user via Telegram Bot (using stored `Tg_ID`).
    *   Returns: `{ hasTelegramId: true }`.
4.  **Scenario B: User has NO `Tg_ID` (New or Unlinked)**
    *   Creates a new record in Database (if new).
    *   Returns: `{ hasTelegramId: false }`.

**Frontend Logic**:
*   If `hasTelegramId: true`: Shows "Code sent to your Telegram!".
*   If `hasTelegramId: false`: Shows "Please start @linked_coffee_bot to get your code" with a link to the bot.

### Step 2: OTP Delivery (The "Reactive" Path)

*Only applies to Scenario B (User starts Bot manually).*

**User Action**: Clicks link and starts the bot (`/start`).
**Bot Logic**:
1.  Extracts `telegramId` and `username` from the Telegram event.
2.  Generates a 6-digit OTP.
3.  Stores OTP in memory (mapped to username, with expiry).
4.  Sends OTP to user via Telegram chat.

### Step 3: Verification & Login

**User Action**: Enters 6-digit OTP on the web.
**API Call**: `POST /api/verify`

**Backend Logic**:
1.  Retrieves stored OTP data using the username.
2.  Validates:
    *   OTP exists?
    *   OTP matches input?
    *   OTP not expired?
3.  **Success**:
    *   Updates Database: Saves `Tg_ID` (from the stored OTP data) to the user record. This "links" the account for future Proactive logins.
    *   Clears OTP from memory.
    *   Returns success status.

**Frontend Logic**:
*   On success, saves user session (e.g., to `localStorage`).
*   Redirects to Dashboard.

## Data Model Requirements

The User table must store at least:
*   `Tg_Username` (String, Unique Index): To lookup user by input.
*   `Tg_ID` (Number/String): To send proactive messages.

## Security & Implementation Notes

1.  **OTP Storage**: Currently using in-memory `Map`. For multi-instance scaling, use Redis.
2.  **Expiry**: OTPs should expire (e.g., 10 minutes).
3.  **Magic OTP**: For local development/testing, a "Magic OTP" (e.g., `000000`) can be configured to bypass checks.
4.  **Bot Token**: Ensure the Bot Token is kept secure in environment variables.

## API Specification

### `POST /api/register`
*   **Body**: `{ "telegramUsername": "string" }`
*   **Response**:
    ```json
    {
      "success": true,
      "isNew": boolean,
      "hasTelegramId": boolean, // true if OTP was sent automatically
      "message": "string"
    }
    ```

### `POST /api/verify`
*   **Body**: `{ "telegramUsername": "string", "otp": "string" }`
*   **Response**:
    ```json
    {
      "success": true,
      "message": "string"
    }
    ```
