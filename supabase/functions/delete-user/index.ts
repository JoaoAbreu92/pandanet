// @ts-nocheck
import { serve } from "http/server.ts"
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Get the user making the request
    const {
      data: { user: requester },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !requester) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 2. Check if the requester is an admin in the profiles table
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_admin, is_company_admin')
      .eq('id', requester.id)
      .single()

    if (profileError || (!profile?.is_admin && !profile?.is_company_admin)) {
      console.error('Permission denied. Profile data:', profile)
      return new Response(JSON.stringify({ error: 'You do not have permission to delete users.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 3. Get the target user ID from the request body
    const { userId } = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 4. Create an admin client using the service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 5. Delete the user from the auth.users table (this will cascade to profiles if set up, or we delete manually)
    console.log(`Deleting auth user: ${userId}`)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteAuthError) {
       console.error('Error deleting auth user:', deleteAuthError)
       throw deleteAuthError
    }
    
    // 6. Explicitly delete from profiles table just in case there is no cascade
    console.log(`Deleting profile explicitly for user: ${userId}`)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    return new Response(JSON.stringify({ success: true, message: `User ${userId} deleted.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
