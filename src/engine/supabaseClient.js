import { createClient } from '@supabase/supabase-js';

const DEFAULT_PUBLIC_URL = 'https://ieysfpbkkuacrsqoosly.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_9zYmTJrgIia-8D0QlYG0Pw_RNgKupVR';

export const SUPABASE_URL = (
  import.meta.env?.VITE_SUPABASE_URL || DEFAULT_PUBLIC_URL
).trim();
export const SUPABASE_PUBLISHABLE_KEY = (
  import.meta.env?.VITE_SUPABASE_ANON_KEY || DEFAULT_PUBLISHABLE_KEY
).trim();

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_PUBLISHABLE_KEY;

const isSecretKeyMistake = supabaseAnonKey.startsWith('sb_secret_');

if (isSecretKeyMistake) {
  console.error(
    '[Supabase] sb_secret_ 키는 브라우저/프론트엔드에서 사용할 수 없습니다. Publishable(anon) 키를 사용하세요.',
  );
}

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey) && !isSecretKeyMistake;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
