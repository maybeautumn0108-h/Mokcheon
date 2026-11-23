import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY || '').trim();

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
