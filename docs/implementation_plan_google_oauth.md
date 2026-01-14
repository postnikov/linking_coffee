# Google OAuth Implementation Plan

This document outlines the step-by-step implementation for adding Google OAuth (Login with Gmail) to the Linked Coffee platform.
Phase 1 (Preparation) is assumed to be completed.

## Phase 2: Frontend Implementation (React)

### 1. Install Dependencies
Run the following command in the `frontend` directory. Note the use of `--legacy-peer-deps` to resolve React 18 / react-scripts conflicts.

```bash
cd frontend
npm install @react-oauth/google --legacy-peer-deps
```

### 2. Configure OAuth Provider
Modify `frontend/src/index.js` to wrap the application with `GoogleOAuthProvider`.

**File:** `frontend/src/index.js`

```javascript
import { GoogleOAuthProvider } from '@react-oauth/google';

// ... other imports

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID; // Add to .env

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <React.StrictMode>
            <App />
        </React.StrictMode>
    </GoogleOAuthProvider>
);
```

### 3. Add Login Button
Update `frontend/src/pages/LoginPage.js` to include the Google Login button and handle the response.

**File:** `frontend/src/pages/LoginPage.js`

```javascript
import { GoogleLogin } from '@react-oauth/google';

// ... inside LoginPage component

const handleGoogleLogin = async (credentialResponse) => {
    setIsLoading(true);
    try {
        const response = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: credentialResponse.credential }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Handle successful login (same as OTP flow)
             const finalizeLogin = (u) => {
                onLogin(u);
                navigate(from, { replace: true });
            };

            if (data.user.consentGdpr) {
                finalizeLogin(data.user);
            } else {
                setPendingUser(data.user);
                setShowGdprModal(true);
            }
        } else {
            alert(data.message || 'Google Login Failed');
        }
    } catch (error) {
        console.error('Google Login Error:', error);
        alert('An error occurred during Google Login');
    } finally {
        setIsLoading(false);
    }
};

// ... In the JSX, add the button (e.g., below the existing form or step 1)

<div className="google-login-wrapper" style={{ margin: '20px 0', textAlign: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0' }}>
       <span style={{ height: '1px', background: '#e5e7eb', flex: 1 }}></span>
       <span style={{ padding: '0 10px', color: '#6b7280', fontSize: '0.9rem' }}>OR</span>
       <span style={{ height: '1px', background: '#e5e7eb', flex: 1 }}></span>
    </div>
    
    <GoogleLogin
        onSuccess={handleGoogleLogin}
        onError={() => {
            console.log('Login Failed');
            alert('Google Login Failed');
        }}
        useOneTap
    />
</div>
```

---

## Phase 3: Backend Implementation (Express)

### 1. Install Dependencies
Run in the `backend` directory:

```bash
cd backend
npm install google-auth-library
```

### 2. Update Configuration
Ensure `.env` in `backend` has `GOOGLE_CLIENT_ID`.

### 3. Add Auth Route
Modify `backend/server.js` to handle the Google token verification.

**File:** `backend/server.js`

Add imports:
```javascript
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
```

Add the route (place near other `/api` routes):

```javascript
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ success: false, message: 'No token provided' });
    }

    try {
        // 1. Verify Token
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        const { email, name, picture, family_name, given_name } = payload;
        
        console.log(`Google Auth: Verified user ${email}`);

        // 2. Check/Update Airtable
        // We match by Email OR by Tg_Username if (hypothetically) we tracked it, but Email is safest for Google.
        // NOTE: You must add an 'Email' field to your Airtable 'Members' table first!

        const records = await base(process.env.AIRTABLE_MEMBERS_TABLE)
            .select({
                filterByFormula: `{Email} = '${email}'`,
                maxRecords: 1
            })
            .firstPage();

        let record;
        let isNew = false;

        if (records.length > 0) {
            record = records[0];
            // Update Avatar if missing
            if (!record.fields.Avatar && picture) {
                 await base(process.env.AIRTABLE_MEMBERS_TABLE).update([{
                    id: record.id,
                    fields: { Avatar: [{ url: picture }] }
                 }]);
            }
        } else {
            // Create New User
            isNew = true;
            const newFields = {
                Email: email,
                Name: given_name || name,
                Family: family_name || '',
                Status: 'EarlyBird',
                Created_At: new Date().toISOString().split('T')[0],
                // Avatar: [{ url: picture }] // Airtable sometimes tricky with direct URL upload on create, usually works
            };
            
            // Note: We don't have a Telegram Username yet. 
            // You might need a way to link it later or mark as 'Web Only'.
            // For now, we'll create the record.
            
            const createRes = await base(process.env.AIRTABLE_MEMBERS_TABLE).create([{
                fields: newFields
            }]);
            record = createRes[0];
        }

        // 3. Return Session Data
        res.json({
            success: true,
            user: {
                username: record.fields.Tg_Username || email, // Fallback to email if no TG username
                email: email,
                status: record.fields.Status,
                consentGdpr: record.fields.Consent_GDPR,
                firstName: record.fields.Name || given_name,
                lastName: record.fields.Family || family_name
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ success: false, message: 'Invalid Token' });
    }
});
```

---

## Phase 4: Verification & Database Updates

1.  **Airtable Schema**:
    *   Add `Email` field (Type: Email) to **Members** table.
    *   (Optional) Update `Name` and `Family` fields if strictly importing from Google.

2.  **Environment Variables**:
    *   `frontend/.env`: Add `REACT_APP_GOOGLE_CLIENT_ID=your_client_id`
    *   `backend/.env`: Add `GOOGLE_CLIENT_ID=your_client_id`

3.  **Testing**:
    *   Start backend: `cd backend && npm start` (or `npm run dev`)
    *   Start frontend: `cd frontend && npm start`
    *   Click "Sign in with Google".
    *   Verify a new record appears in Airtable with the email address.
    *   Reload page to verify persistence.
