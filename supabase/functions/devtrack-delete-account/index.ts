import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('DEVTRACK_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('DEVTRACK_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('DEVTRACK_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') || '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Missing DevTrack Supabase function environment variables' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData.user) {
    return json({ error: userError?.message || 'Missing authenticated user' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const userId = userData.user.id;
  const email = userData.user.email?.toLowerCase() || '';

  const ownedProjectsResult = await adminClient
    .from('devtrack_projects')
    .delete()
    .eq('owner_id', userId)
    .select('id');
  if (ownedProjectsResult.error) {
    return json({ error: ownedProjectsResult.error.message }, 400);
  }

  const membershipFilters = [`user_id.eq.${userId}`];
  if (email) {
    membershipFilters.push(`user_id.eq.email:${email}`);
    membershipFilters.push(`email.ilike.${email}`);
  }
  const membershipsResult = await adminClient
    .from('devtrack_project_members')
    .delete()
    .or(membershipFilters.join(','))
    .select('project_id,user_id');
  if (membershipsResult.error) {
    return json({ error: membershipsResult.error.message }, 400);
  }

  const recordsResult = await adminClient
    .from('devtrack_sync_records')
    .update({ user_id: `deleted:${userId.slice(0, 8)}` })
    .eq('user_id', userId)
    .select('id');
  if (recordsResult.error) {
    return json({ error: recordsResult.error.message }, 400);
  }

  const deleteResult = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteResult.error) {
    return json({ error: deleteResult.error.message }, 400);
  }

  return json({
    ok: true,
    deletedUserId: userId,
    cleanup: {
      deletedOwnedProjects: ownedProjectsResult.data?.length ?? 0,
      removedMemberships: membershipsResult.data?.length ?? 0,
      anonymizedRecords: recordsResult.data?.length ?? 0,
    },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
