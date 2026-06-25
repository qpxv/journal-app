# iOS Shortcut + Mac Keyboard Shortcut

## iOS Shortcut

1. Open the **Shortcuts** app on your iPhone or iPad.
2. Tap the **+** button to create a new shortcut.
3. Add action: **Ask for Input**
   - Keyboard type: Text
   - Prompt: "Journal entry"
4. Add action: **Get Contents of URL**
   - URL: `https://journal-app-xi-beryl.vercel.app/api/entries/create`
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
  curl -s -X POST https://journal-app-xi-beryl.vercel.app/api/entries/create \
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
  do shell script "curl -s -X POST https://journal-app-xi-beryl.vercel.app/api/entries/create -H 'Content-Type: application/json' -d '{\"body\": \"" & entry & "\", \"token\": \"YOUR_JOURNAL_SECRET\", \"createdAt\": \"'$(date -u +%Y-%m-%dT%H:%M:%S)'\"} '"
end if
```
3. Save it, then assign a keyboard shortcut in **System Settings → Keyboard → Keyboard Shortcuts → Services**.

---

## Linux / Kali

Pressing a hotkey pops up a GTK dialog (via `zenity`). You type, hit Enter or OK, entry is saved. No terminal window needed.

### 1. Install dependencies

```bash
sudo apt install zenity curl   # zenity is usually pre-installed on Kali
```

### 2. Create config file

```bash
mkdir -p ~/.config/journal
cat > ~/.config/journal/config << 'EOF'
JOURNAL_URL=https://journal-app-xi-beryl.vercel.app
JOURNAL_SECRET=your_journal_secret_here
EOF
chmod 600 ~/.config/journal/config
```

Replace the values with your actual Vercel URL and `JOURNAL_SECRET` from `.env.local`.

### 3. Install the script

From the project root:

```bash
mkdir -p ~/.local/bin
cp scripts/journal.sh ~/.local/bin/journal
chmod +x ~/.local/bin/journal
```

Make sure `~/.local/bin` is in your `PATH` (add `export PATH="$HOME/.local/bin:$PATH"` to `~/.bashrc` / `~/.zshrc` if needed).

### 4. Bind to a keyboard shortcut

**Xfce (default Kali desktop):**
1. Settings Manager → Keyboard → Application Shortcuts tab
2. Click **+**, enter command: `journal`, click OK
3. Press your desired key combo (e.g. `Super+J`)

**i3 / Sway** — add to `~/.config/i3/config` or `~/.config/sway/config`:
```
bindsym $mod+j exec journal
```

**GNOME** — Settings → Keyboard → View and Customize Shortcuts → Custom Shortcuts → `+`
- Name: Journal
- Command: `journal`
- Shortcut: `Super+J`

### Usage

```bash
journal              # opens dialog (or prompts in terminal if zenity not available)
journal "quick note" # saves immediately without dialog (good for scripting)
```
