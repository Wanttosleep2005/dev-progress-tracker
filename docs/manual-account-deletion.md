# Manual Account Deletion Guide

This guide is for users who do not want to deploy the DevTrack Edge Function.

## Status

Manual account deletion is safer to audit, but it is not one-click. It is the
recommended fallback while the automated deletion flow is still beta.

## What You Can Do In The App

In DevTrack:

1. Open `Settings`.
2. Use `注销云端账户身份`.
3. Confirm the email prompt.

If the Edge Function is not deployed, DevTrack can still clean local cloud
session state and, when the database RPC exists, clean DevTrack business records.
It cannot delete the Supabase Auth user by itself.

## Delete The Supabase Auth User Manually

In Supabase Dashboard:

1. Open the project.
2. Go to `Authentication -> Users`.
3. Search the email address.
4. Delete the user.

After deletion, that email can register again as a fresh Supabase Auth account.

## Optional SQL Cleanup

For an existing database, you can run:

```text
supabase/sql/migrations/account-deletion.sql
```

This creates the `devtrack_forget_current_user` RPC used as a frontend fallback.
It does not delete Supabase Auth users.

## When To Use Manual Mode

Use manual deletion when:

1. You do not want to trust any account-deletion function code.
2. You are testing with real team data.
3. You want to inspect each cloud table before removing records.
4. You have not rotated a previously exposed service-role key yet.

## Warning

Deleting a Supabase Auth user is irreversible from the app's point of view.
Create a DevTrack backup before testing account deletion.
