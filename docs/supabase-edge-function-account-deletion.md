# Supabase Edge Function Account Deletion Guide

This guide explains the beta account deletion flow used by DevTrack.

## Status

Account deletion is currently **beta**. Do not use it casually on production
team projects. Test it with a spare account first.

## What It Does

When a logged-in user clicks account deletion in DevTrack, the app calls the
`devtrack-delete-account` Supabase Edge Function. The function:

1. Verifies the current user from the Supabase JWT.
2. Deletes cloud projects owned by that user.
3. Removes the user from shared project member records.
4. Anonymizes sync records authored by that user.
5. Deletes the Supabase Auth user through the Admin API.

Local browser data is not wiped automatically. The app clears the cloud login
session and detaches local projects from cloud sync.

## Why An Edge Function Is Required

Deleting a Supabase Auth user requires a service-role key. That key must never
be placed in frontend code or any `VITE_` environment variable, because Vite
bundles those variables into browser JavaScript.

The service-role key is stored only as a Supabase Edge Function secret:

```powershell
.\scripts\deploy-supabase-edge-function.ps1 -SupabaseCliPath "G:\supabase-cli\supabase.exe"
```

The script prompts for:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
```

It stores them as:

```text
DEVTRACK_SUPABASE_SERVICE_ROLE_KEY
DEVTRACK_SUPABASE_ANON_KEY
DEVTRACK_SUPABASE_URL
```

Supabase reserves the `SUPABASE_` prefix for some secrets, so DevTrack uses the
`DEVTRACK_SUPABASE_` prefix.

By default the script reads `VITE_SUPABASE_URL` from `.env` and derives the
project ref from that URL. You can also pass values explicitly:

```powershell
.\scripts\deploy-supabase-edge-function.ps1 `
  -ProjectRef "your-project-ref" `
  -SupabaseUrl "https://your-project-ref.supabase.co" `
  -SupabaseCliPath "G:\supabase-cli\supabase.exe"
```

## Required Frontend Env

The frontend only needs the public function URL:

```env
VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL=https://your-project-ref.supabase.co/functions/v1/devtrack-delete-account
```

This is not a secret.

## Verify Deployment

```powershell
G:\supabase-cli\supabase.exe functions list --project-ref your-project-ref
```

You should see:

```text
devtrack-delete-account
```

Then restart Vite:

```powershell
npm run dev -- --host
```

## Security Note

If a service-role key was pasted into chat, logs, screenshots, or a shared file,
rotate it in Supabase after deployment:

```text
Project Settings -> API -> service_role -> Regenerate
```

After rotating, run the deployment script again so the Edge Function receives
the new secret.
