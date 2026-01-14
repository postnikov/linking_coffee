# Account Linking Implementation Plan

## Overview
Implement a "Connected Accounts" section in the user profile that allows users to link their Google account to an existing Telegram-based profile, enabling authentication via either method.

## Goals
1. Allow existing Telegram users to add Google OAuth as an alternative login method
2. Prevent duplicate account creation when using Google OAuth
3. Provide clear UI for managing connected authentication methods
4. (Optional) Allow Google users to link Telegram accounts

## Current State Analysis

### Authentication Flows
- **Telegram Auth**: Uses `Tg_Username` + `Tg_ID` fields
- **Google OAuth**: Uses `Email` field
- **Problem**: No cross-reference between these fields → duplicate accounts

### Database Schema (Members Table)
- `Tg_Username` - Telegram username
- `Tg_ID` - Telegram user ID
- `Email` - Email address (for Google OAuth users)

## Implementation Plan

### Phase 1: Backend API Endpoints

#### 1.1 Create Link Google Account Endpoint

**Location**: `backend/server.js`

**Endpoint**: `POST /api/link-google-account`

**Purpose**: Link a Google account to existing Telegram user

**Request Body**:
```json
{
  "token": "google_id_token",
  "username": "telegram_username"
}
```

**Logic**:
1. Verify username matches authenticated session
2. Verify Google token with `googleClient.verifyIdToken()`
3. Extract email from Google payload
4. Check if email is already used by another account
   - If yes: Return error "Email already linked to another account"
   - If no: Continue
5. Update current user's record with Email field
6. Return success with updated user data

**Response**:
```json
{
  "success": true,
  "message": "Google account linked successfully",
  "user": {
    "username": "...",
    "email": "user@gmail.com",
    "linkedAccounts": ["telegram", "google"]
  }
}
```

#### 1.2 Modify Google OAuth Endpoint

**Location**: `backend/server.js` - `/api/auth/google`

**Changes Needed**:

Current logic:
```javascript
filterByFormula: `{Email} = '${email}'`
```

New logic:
```javascript
// Check BOTH Email field AND secondary indicators
filterByFormula: `OR({Email} = '${email}', {Tg_Username} = '${emailAsUsername}')`
```

**Purpose**: When logging in with Google, check if that email is already linked to a Telegram account

#### 1.3 Create Unlink Account Endpoint (Optional)

**Endpoint**: `POST /api/unlink-google-account`

**Purpose**: Remove Google email from profile (keep Telegram auth)

**Logic**:
1. Verify user has Telegram auth (don't allow unlinking if it's their only method)
2. Clear Email field from Airtable record
3. Return success

---

### Phase 2: Frontend UI Components

#### 2.1 Add Connected Accounts Section to Dashboard

**Location**: `frontend/src/pages/Dashboard.js`

**New Section** (after existing profile fields):

```jsx
<div className="profile-section">
  <h3>Connected Accounts</h3>

  {/* Show linked accounts */}
  <div className="connected-accounts-list">
    {user.Tg_Username && (
      <div className="account-item">
        <span className="account-icon">📱</span>
        <span>Telegram: @{user.Tg_Username}</span>
        <span className="badge-primary">Primary</span>
      </div>
    )}

    {user.email ? (
      <div className="account-item">
        <span className="account-icon">📧</span>
        <span>Google: {user.email}</span>
        <button onClick={handleUnlinkGoogle} className="btn-secondary">Unlink</button>
      </div>
    ) : (
      <div className="account-item">
        <span className="account-icon">📧</span>
        <span>Google Account</span>
        <button onClick={handleLinkGoogle} className="btn-primary">Link Google Account</button>
      </div>
    )}
  </div>
</div>
```

#### 2.2 Implement Link Google Account Handler

**Location**: `frontend/src/pages/Dashboard.js`

**Function**: `handleLinkGoogle()`

**Implementation Options**:

**Option A: Popup with GoogleLogin Component**
```jsx
const [showLinkModal, setShowLinkModal] = useState(false);

const handleLinkGoogle = () => {
  setShowLinkModal(true);
};

// In modal:
<GoogleLogin
  onSuccess={handleGoogleLinkSuccess}
  onError={() => alert('Google linking failed')}
  useOneTap={false}
/>
```

**Option B: Direct OAuth Flow**
- Open Google OAuth popup directly
- Handle callback with token
- Send to backend

#### 2.3 Process Link Response

**Function**: `handleGoogleLinkSuccess(credentialResponse)`

```javascript
const handleGoogleLinkSuccess = async (credentialResponse) => {
  try {
    const response = await fetch(`${API_URL}/api/link-google-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: credentialResponse.credential,
        username: user.username
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Update local user state
      setUser({ ...user, email: data.user.email });
      alert('Google account linked successfully!');
      setShowLinkModal(false);
    } else {
      alert(data.message || 'Failed to link Google account');
    }
  } catch (error) {
    console.error('Link error:', error);
    alert('An error occurred while linking');
  }
};
```

---

### Phase 3: User Experience Flow

#### 3.1 New User with Google OAuth (No Change)
1. Click "Sign in with Google" on login page
2. Select Google account
3. Backend checks: No existing email match → Create new user
4. Show GDPR modal if needed
5. Redirect to dashboard

#### 3.2 Existing Telegram User Links Google
1. Log in with Telegram (existing flow)
2. Go to Dashboard/Profile
3. See "Connected Accounts" section
4. Click "Link Google Account" button
5. Google OAuth popup appears
6. User selects Google account
7. Backend validates and updates Email field
8. Success message shown
9. User can now log in with either method

#### 3.3 Google User Logs In (After Linking)
1. Click "Sign in with Google" on login page
2. Select Google account
3. Backend checks: Email exists → Load that user profile
4. Redirect to dashboard
5. User sees both Telegram and Google connected

#### 3.4 Unlinking Google Account (Optional)
1. User clicks "Unlink" next to Google account
2. Confirmation dialog: "Are you sure? You'll only be able to log in with Telegram."
3. Backend clears Email field
4. Success message shown

---

### Phase 4: Edge Cases & Validation

#### 4.1 Email Already Used
**Scenario**: User tries to link a Google account that's already used by another profile

**Handling**:
- Backend checks if email exists on different user
- Return error: "This email is already linked to another account"
- Frontend shows error message
- User cannot complete linking

#### 4.2 Multiple Link Attempts
**Scenario**: User already has Google linked, tries to link a different one

**Handling**:
- Show "Unlink" option instead of "Link" button
- User must unlink first before linking a different account
- Or: Show confirmation "Replace existing Google account?"

#### 4.3 Prevent Orphaned Accounts
**Scenario**: User tries to unlink their only authentication method

**Handling**:
- Backend checks: Does user have Tg_ID?
- If no Telegram auth: Block unlinking, return error
- Error message: "Cannot unlink your only authentication method"

#### 4.4 Session Management
**Scenario**: User links Google while logged in with Telegram

**Handling**:
- Update session data to include email
- Update localStorage user object
- No need to re-login

---

### Phase 5: Testing Checklist

#### 5.1 Backend Tests
- [ ] Link Google to existing Telegram user succeeds
- [ ] Link fails if email already used by another user
- [ ] Google OAuth login works after linking
- [ ] Telegram login still works after linking
- [ ] Unlink removes email from profile
- [ ] Cannot unlink if no Telegram auth exists

#### 5.2 Frontend Tests
- [ ] "Link Google Account" button appears for Telegram users
- [ ] Google OAuth popup opens correctly
- [ ] Success message appears after linking
- [ ] Email displays in Connected Accounts section
- [ ] "Unlink" button appears after linking
- [ ] User state updates without page reload

#### 5.3 Integration Tests
- [ ] Full flow: Telegram user → Link Google → Log out → Log in with Google
- [ ] Error handling: Try to link already-used email
- [ ] UI updates correctly after linking/unlinking

---

### Phase 6: UI/UX Enhancements (Optional)

#### 6.1 Visual Improvements
- Add icons for Telegram (📱) and Google (📧)
- Use badges to show "Primary" authentication method
- Add tooltips explaining what linking does
- Use color coding: Green = connected, Gray = not connected

#### 6.2 Security Indicators
- Show "Last used" timestamp for each auth method
- Show "Linked on [date]" for connected accounts
- Add email verification status (if implemented)

#### 6.3 Notifications
- Send email confirmation when Google account is linked
- Send Telegram message confirmation when Google is linked
- Notify on unlink attempts

---

## File Changes Summary

### Backend Files
1. **`backend/server.js`**
   - Add `POST /api/link-google-account` endpoint
   - Modify `POST /api/auth/google` to check both Email and Tg_Username
   - Add `POST /api/unlink-google-account` (optional)

### Frontend Files
2. **`frontend/src/pages/Dashboard.js`**
   - Add Connected Accounts section
   - Add state for link modal
   - Add `handleLinkGoogle()` function
   - Add `handleGoogleLinkSuccess()` function
   - Add `handleUnlinkGoogle()` function (optional)

3. **`frontend/src/pages/Dashboard.css`** (or create new file)
   - Style `.connected-accounts-list`
   - Style `.account-item`
   - Style badges and buttons

4. **`frontend/src/components/LinkAccountModal.js`** (optional new component)
   - Modal wrapper for Google OAuth
   - Better separation of concerns

### Database
5. **Airtable Members Table**
   - Ensure `Email` field exists (Type: Email)
   - No new fields required

---

## Implementation Order

1. **Phase 1.2**: Modify `/api/auth/google` to check both fields (prevents future duplicates)
2. **Phase 1.1**: Add `/api/link-google-account` endpoint
3. **Phase 2.1-2.3**: Add UI and handlers to Dashboard
4. **Phase 4**: Test all edge cases
5. **Phase 1.3 & 3.4**: Add unlink functionality (optional)
6. **Phase 6**: Polish UI/UX (optional)

---

## Alternative: Reverse Flow (Google → Telegram Linking)

**Scenario**: User created account via Google OAuth, wants to add Telegram

**Implementation** (if needed):
1. Add `POST /api/link-telegram-account` endpoint
2. Endpoint generates OTP and sends to Telegram
3. User verifies OTP
4. Backend updates `Tg_Username` and `Tg_ID` on Google user's profile
5. UI shows "Link Telegram Account" button for Google users

**Note**: This is lower priority since most users start with Telegram.

---

## Security Considerations

1. **Token Validation**: Always verify Google tokens server-side
2. **Session Verification**: Ensure user can only link to their own account
3. **Email Uniqueness**: Strictly enforce one email per account
4. **Audit Logging**: Log all account linking/unlinking events
5. **Rate Limiting**: Prevent abuse of linking endpoints

---

## Rollout Strategy

### Step 1: Soft Launch
- Deploy backend changes first
- Test manually with test accounts
- No frontend UI yet

### Step 2: Limited UI Release
- Add UI to Dashboard
- Monitor for errors
- Collect user feedback

### Step 3: Full Release
- Announce feature to users
- Update documentation
- Monitor adoption metrics

---

## Success Metrics

- **Primary**: Number of users who link Google to Telegram accounts
- **Secondary**: Reduction in duplicate account creation
- **Tertiary**: Increase in Google OAuth login usage

---

## Future Enhancements

1. **Multiple OAuth Providers**: Facebook, Apple, Microsoft
2. **Account Recovery**: "Forgot which method I used?"
3. **2FA**: Add two-factor authentication
4. **Login History**: Show recent login attempts
5. **Device Management**: "Log out from all devices"
