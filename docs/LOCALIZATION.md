# Localization (i18n)

This document outlines the localization strategy and rules for the Linking Coffee project. The system currently supports **English (En)** and **Russian (Ru)**, with English being the default.

## 1. Overview

Localization in this project is handled through a combination of:
1.  **Database Storage**: User language preferences are stored in Airtable.
2.  **Message Maps**: Keyed dictionaries in code containing localized strings.
3.  **Context Passing**: Explicitly passing language data in callbacks to ensure consistency in stateless interactions (like Telegram bots).

## 2. Architecture

### Backend (Airtable)
*   **Table**: `Members`
*   **Field**: `Notifications_Language`
*   **Type**: Single Select
*   **Options**: `En`, `Ru`
*   **Default**: `En` (if the field is empty)

### Codebase Patterns

#### A. Message Map Pattern
For scripts sending notifications (`match-users.js`, `weekend-invitation-all.js`, `notify-matches.js`), we use a nested object structure.

```javascript
const MESSAGES = {
    En: {
        greeting: (name) => `Hello, ${name}!`,
        btn_yes: "Yes, I'm in ✅"
    },
    Ru: {
        greeting: (name) => `Привет, ${name}!`,
        btn_yes: "Да, участвую ✅"
    }
};

// Usage
const lang = user.fields.Notifications_Language === 'Ru' ? 'Ru' : 'En';
const t = MESSAGES[lang];
const text = t.greeting(user.fields.Name);
```

#### B. Callback Consistency Pattern (Bot)
When a user interacts with a button (e.g., in `server.js`), the bot needs to know which language to reply in. Since Telegram callbacks are stateless, we use two methods:

1.  **Implicit Context Preservation**: Embed the language code directly in the callback data.
    *   *Format*: `action:id:status:lang` (e.g., `fb_stat:rec123:Met:Ru`)
    *   *Benefit*: No need to query database again just to find the language.
    
    **Example (Generating the Button):**
    ```javascript
    const lang = user.fields.Notifications_Language || 'En';
    Markup.inlineKeyboard([
        Markup.button.callback(t.btn_yes, `participate_yes:${lang}`)
    ]);
    ```

    **Example (Handling the Action):**
    ```javascript
    bot.action(/^participate_yes:([A-Za-z]{2})$/, async (ctx) => {
        const lang = ctx.match[1] || 'En';
        const t = PARTICIPATION_MESSAGES[lang];
        await ctx.editMessageText(t.yes_response);
    });
    ```

2.  **Database Lookup (Fallback)**: If the language isn't in the callback (legacy buttons), query Airtable using the Telegram ID.
    ```javascript
    const record = await findUserByTgId(ctx.from.id);
    const lang = record.fields.Notifications_Language === 'Ru' ? 'Ru' : 'En';
    ```

## 3. Rules for New Features

When implementing new features involving user communication:

1.  **Mandatory Bilingual Support**: All user-facing text must have `En` and `Ru` variants.
2.  **English Default**: Always fallback to `En` if the language is undefined or unsupported.
3.  **No Hardcoded Strings**: Never hardcode text inside logic functions. Extract them to a `MESSAGES` or `CONSTANTS` object at the top of the file.
4.  **Preserve Context**: If you create a workflow with multiple steps (e.g., Button Click -> Question -> Answer), ensure the language context is passed through each step so the user doesn't experience a sudden language switch.
5.  **Airtable Schema**: If you add new tables that send notifications, ensure they link back to `Members` so `Notifications_Language` can be accessed.

## 4. Implementation Checklist

- [ ] Defined `MESSAGES` object with `En` and `Ru` keys.
- [ ] Fetched `Notifications_Language` from Airtable.
- [ ] Logic defaults to `En` if explicit language is missing.
- [ ] If using interactive buttons, `lang` code is embedded in callback data.
- [ ] Tested both English and Russian flows.
