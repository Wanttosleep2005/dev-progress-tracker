# DevTrack Account Deletion Function

This Edge Function deletes the current authenticated Supabase Auth user after
cleaning DevTrack cloud business records.

The frontend must never contain the service role key. Set it only as a
Supabase Edge Function secret. Supabase CLI rejects custom secrets beginning
with `SUPABASE_`, so DevTrack uses its own `DEVTRACK_SUPABASE_*` names:

```bash
supabase secrets set DEVTRACK_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase deploy devtrack-delete-account
```

Optional frontend configuration:

```env
VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL=https://your-project.supabase.co/functions/v1/devtrack-delete-account
```

If the URL is not set, the app calls the default function URL derived from
`VITE_SUPABASE_URL`.

Windows helper:

```powershell
.\scripts\deploy-supabase-edge-function.ps1
```

The helper prompts for secrets instead of saving them in the repository.
