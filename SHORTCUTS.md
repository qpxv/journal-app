# iOS Shortcut + Mac Keyboard Shortcut

## iOS Shortcut

1. Open the **Shortcuts** app on your iPhone or iPad.
2. Tap the **+** button to create a new shortcut.
3. Add action: **Ask for Input**
   - Keyboard type: Text
   - Prompt: "Journal entry"
4. Add action: **Get Contents of URL**
   - URL: `https://yourapp.vercel.app/api/entries/create`
   - Method: POST
   - Headers: `Content-Type: application/json`
   - Body: Select **JSON** and add:
     ```json
     {
       "body": "[Shortcut Input]",
       "token": "YOUR_JOURNAL_SECRET",
       "createdAt": "[Current Date]"
     }
     ```
   - For `createdAt`: tap the field, choose **Variable → Current Date**, then format it as **ISO 8601** (or use the format `yyyy-MM-dd'T'HH:mm:ss`).
5. (Optional) Add the shortcut to your home screen via the shortcut's settings.
6. (Optional) Add to Back Tap: Settings → Accessibility → Touch → Back Tap → Double Tap → your shortcut.

**Tip:** Replace `YOUR_JOURNAL_SECRET` with your actual `JOURNAL_SECRET` value from `.env.local`.

---

## Mac Keyboard Shortcut

### Option A — Raycast Script Command

1. Install [Raycast](https://raycast.com).
2. In Raycast Settings → Extensions, add a new **Script Command**.
3. Use this script (replace the URL and token):

```bash
#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title New Journal Entry
# @raycast.mode silent
# @raycast.packageName Journal

entry=$(osascript -e 'text returned of (display dialog "Journal entry" default answer "" with title "journal." buttons {"Cancel", "Save"} default button "Save")')

if [ -n "$entry" ]; then
  curl -s -X POST https://yourapp.vercel.app/api/entries/create \
    -H "Content-Type: application/json" \
    -d "{\"body\": \"$entry\", \"token\": \"YOUR_JOURNAL_SECRET\", \"createdAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S)\"}"
fi
```

4. Assign a hotkey (e.g., `⌘⌥J`) in the script command settings.

### Option B — BetterTouchTool

1. Install [BetterTouchTool](https://folivora.ai).
2. Create a new keyboard shortcut: `⌘⌥J` (or whatever you prefer).
3. Set the action to **Run Terminal Command** with the same script above (without the Raycast comment headers).

### Option C — Automator Quick Action

1. Open **Automator** → New → Quick Action.
2. Add a **Run AppleScript** action:
```applescript
set entry to text returned of (display dialog "Journal entry" default answer "" with title "journal." buttons {"Cancel", "Save"} default button "Save")
if entry is not "" then
  do shell script "curl -s -X POST https://yourapp.vercel.app/api/entries/create -H 'Content-Type: application/json' -d '{\"body\": \"" & entry & "\", \"token\": \"YOUR_JOURNAL_SECRET\", \"createdAt\": \"'$(date -u +%Y-%m-%dT%H:%M:%S)'\"} '"
end if
```
3. Save it, then assign a keyboard shortcut in **System Settings → Keyboard → Keyboard Shortcuts → Services**.
