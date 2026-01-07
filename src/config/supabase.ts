import { createClient } from '@supabase/supabase-js'   
import config from './env.js'

if (!config.supabase.url || !config.supabase.Anonkey || !config.supabase.serviceRoleKey) {
    throw new Error('Supabase configuration is missing')
}

    export const supabaseAdmin = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
        }
    );

    export const supabaseClient = createClient(
        config.supabase.url,
        config.supabase.Anonkey,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
            }
        }
    );
    
  


