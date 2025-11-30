# Product Requirements Document: Registration & Authorization Flow

## 1. Objective
To implement a secure and user-friendly registration process that links a user's Telegram account to their member record in Airtable. This ensures that we have a verified `Tg_ID` for every registered user, enabling future bot interactions.

## 2. Actors
*   **User**: The person registering.
*   **Website**: The frontend interface (`/register`).
*   **Telegram Bot**: The `@linked_coffee_bot` for production (or @kisadrakon_helper_bot for testing locally).
*   **Backend**: The Node.js server managing logic and Airtable connections.
*   **Airtable**: The database storing member records (`Tg_Username`, `Tg_ID`, `Status`).

## 3. Core Workflow (Hybrid Flow)

### Step 1: Initiation (Website)
1.  **User Action**: User visits `/register`, enters their Telegram username (e.g., `@username`), and clicks "Get Code".
2.  **Frontend**: Sends `POST /api/register` with `{ telegramUsername }`.
3.  **Backend**:
    *   Normalizes username (lowercase, trim, remove `@`).
    *   Checks Airtable for existing record.
    *   **If exists**: Returns success (User exists, proceed to verify).
    *   **If new**: Creates a new record in Airtable with `Status: 'EarlyBird'` and `Tg_Username`.
    *   Returns success to Frontend.
4.  **Frontend**: Transitions to **Step 2** (OTP Input Form).

### Step 2: Verification (Telegram Bot)
1.  **User Action**: User opens the Telegram bot (via link provided on web) and sends `/start`.
2.  **Bot**:
    *   Receives `/start` command.
    *   Extracts `Tg_Username` and `Tg_ID` from the message context.
    *   Generates a 6-digit **OTP** (e.g., `123456`).
    *   Stores `{ username, otp, telegramId, expiresAt }` in in-memory `otpStore` (valid for 10 mins).
    *   Replies to user with the OTP.

### Step 3: Confirmation (Website)
1.  **User Action**: User enters the OTP on the website and clicks "Verify".
2.  **Frontend**: Sends `POST /api/verify` with `{ telegramUsername, otp }`.
3.  **Backend**:
    *   Normalizes username and OTP.
    *   **Magic OTP Check**: If OTP is `000000`, bypass verification (for local testing).
    *   **Verification**: Checks `otpStore` for the username.
        *   If not found or expired -> Error.
        *   If OTP mismatch -> Error.
    *   **Update Record**:
        *   Finds the Airtable record by `Tg_Username`.
        *   Updates the record's `Tg_ID` field with the `telegramId` stored in `otpStore` (or dummy ID for magic OTP).
    *   Clears OTP from store.
    *   Returns success.
4.  **Frontend**: Shows "Registration Successful" message.

## 4. Technical Specifications

### Endpoints
*   `POST /api/register`
    *   Input: `{ telegramUsername: string }`
    *   Output: `{ success: true, isNew: boolean }`
*   `POST /api/verify`
    *   Input: `{ telegramUsername: string, otp: string }`
    *   Output: `{ success: true }`

### Data Storage
*   **Airtable**:
    *   Table: `Members`
    *   Fields: `Tg_Username` (Text), `Tg_ID` (Number), `Status` (Single Select), `Created_At` (Date).
*   **In-Memory (Backend)**:
    *   `otpStore`: `Map<username, { code, telegramId, expiresAt }>`

## 5. Local Development & Testing
*   **Bot Token**: Uses `ADMIN_BOT_TOKEN` when `NODE_ENV != production`.
*   **Magic OTP**: `000000` allows bypassing the bot interaction for UI testing.
