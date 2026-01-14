# PRD: Login and Registration Flow Redefinition

**Date**: 2026-01-13
**Status**: DRAFT
**Author**: Antigravity

## 1. Overview
Redefine the login and registration system to prioritize Gmail as the primary entry point while ensuring Telegram connectivity is mandatory for participation in matching. Implement a robust account merging strategy for existing Telegram users who register via Gmail.

## 2. Core Principles
1.  **Dual Login**: Support both Gmail (OAuth) and Telegram (Username/OTP) login methods.
2.  **Gmail Priority**: Encourage Gmail registration for new users.
3.  **Mandatory Telegram**: Users cannot participate in matching until a Telegram account is connected (needed for bot notifications).
4.  **Smart Merging**: Automatically merge accounts when an existing Telegram user connects via Gmail.

---

## 3. User Flows

### Flow A: New User (Gmail First)
This user has never used the service before.

1.  **Registration**:
    -   User clicks "Sign in with Google" on the login page.
    -   **System**: Creates a new Member record in Airtable.
        -   `Email`: <user_email>
        -   `Status`: 'New' (or 'Pending_Telegram')
        -   `Tg_ID`: Empty
    -   **System**: Redirects to Dashboard.

2.  **Dashboard Experience (Restricted)**:
    -   User sees a persistent warning/modal: "Connect Telegram to start matching".
    -   Matching participation toggle is **disabled/locked**.
    -   User clicks "Connect Telegram".

3.  **Connecting Telegram**:
    -   **Option 1 (Deep Link)**: User clicks button -> Opens Telegram Bot `https://t.me/LinkingCoffeeBot?start=LINK_<JWT_OR_HASH>`.
    -   **Option 2 (OTP)**: User interacts with Bot (`/start`) -> Bot gives OTP "123456" -> User enters OTP on Dashboard.
    -   **System Action**:
        -   Verifies Telegram ID.
        -   Updates the *current* User record with `Tg_ID` and `Tg_Username`.
        -   Updates `Status` to 'active' (or allows user to activate).
    -   **Result**: User is now fully registered and can participate.

### Flow B: Existing Member (Telegram Only)
This user exists, has `Tg_ID`, but no `Email`.

1.  **Login**:
    -   User logs in via Telegram (Username + OTP) as usual.
    -   **System**: Authenticates user.

2.  **Dashboard**:
    -   User sees "Connect Google Account" (Optional but recommended).
    -   If user clicks "Link Google":
        -   Triggers Google OAuth.
        -   **System**: Updates existing record with `Email`.

### Flow C: Existing Member Registers via Gmail (The Merge Case)
This is the complex scenario. User has a Telegram account (record A) but decides to "Sign Up" via Gmail, creating a temporary record (record B), then tries to connect their Telegram.

1.  **Step 1: Gmail Registration**:
    -   User clicks "Sign in with Google".
    -   **System checks**: Does `Email` exist? -> No.
    -   **System**: Creates **New Record B** (`Email`: user@gmail.com, `Tg_ID`: null).
    -   Logs user in as Record B.

2.  **Step 2: Connect Telegram**:
    -   User sees "Connect Telegram" prompt.
    -   User performs Telegram Connection (via OTP or Deep Link) using their existing Telegram account (`Tg_ID`: 12345, Username: @olduser).

3.  **Step 3: Verification & Merge Logic**:
    -   **System Checks**:
        -   Does `Tg_ID: 12345` exist in DB? -> **YES** (Record A).
        -   Is `Record A` same as Current Session (`Record B`)? -> **NO**.
    -   **Merge Action**:
        1.  **Target**: Record A (The consolidated profile).
        2.  **Source**: Record B (The temporary email profile).
        3.  **Operation**:
            -   Update Record A: Set `Email` = `user@gmail.com`.
            -   (Optional) Update Record A: Update `Name`/`Avatar` if missing, using data from Record B.
            -   **Delete/Archive Record B** to prevent duplicates.
        4.  **Session Update**:
            -   Invalidate session for Record B.
            -   Issue new session token for Record A.
            -   Frontend automatically updates to show Record A's data (historic matches, etc.).
    -   **User Feedback**: "Account merged! We found your existing profile."

---

## 4. Technical Implementation Steps

### Phase 1: Database & Schema
-   Ensure `Email` field exists in `Members` table (Unique constraint conceptually).
-   Ensure `Tg_ID` is the definitive key for Telegram identity.

### Phase 2: Backend Endpoints
1.  **Refactor `POST /api/auth/google`**:
    -   Currently creates a record if Email not found.
    -   Keep this as is (creates the "temporary" record B in Flow C).
    -   Ensure it returns a flag `isPendingTelegram: true` if `Tg_ID` is missing.

2.  **New Endpoint `POST /api/connect-telegram`** (Replacing/Augmenting `/api/verify`):
    -   **Input**: `session_token` (from headers), `otp` (from user).
    -   **Logic**:
        -   Identify `telegram_id` from OTP.
        -   Check if `telegram_id` belongs to *another* existing record.
        -   **If No**: Update current record (Normal Flow).
        -   **If Yes**: Execute **Merge Strategy** (Flow C).
            -   Update Existing Record (Add Email).
            -   Delete Current Record.
            -   Return `new_session_token` for the Existing Record.

### Phase 3: Frontend
1.  **Login Page**:
    -   Prominent "Continue with Google" button.
    -   Secondary "Login with Telegram" option.
2.  **Dashboard**:
    -   **State 1: No Telegram**:
        -   Blur/Disable Matching controls.
        -   Show "Action Required: Connect Telegram".
        -   Input field for OTP (or instructions to get it).
    -   **State 2: Merged**:
        -   Handle session refresh if ID changes.
        -   Show "Successfully connected" toast.

---

## 5. Open Questions / Edge Cases for User
1.  **Data Conflicts**: If Record A (Telegram) has `Name="Bob"` and Record B (Gmail) has `Name="Robert"`, which one wins during merge?
    -   *Proposal*: Keep Record A (Existing) as source of truth. valid only if Record A is empty.
2.  **Email Conflicts**: If Record A already has an email (different one)?
    -   *Proposal*: Error out. "This Telegram account is already linked to another email." User must login via Telegram and unlink first.

## 6. Next Steps
1. Approve this logic.
2. Create/Update Backend API for Merge.
3. Update Frontend to handle "Pending Telegram" state.
