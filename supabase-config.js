const SUPABASE_URL = "https://pzkdpfpxcrxxkuiwmnvt.supabase.co";
const SUPABASE_KEY = "sb_publishable_Fvepdo059baQhH-uDt5lVQ_XP3bmRVf";

// 檢查是否已載入 Supabase SDK
if (typeof supabase === 'undefined') {
    console.error("Supabase SDK is not loaded. Please include <script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2\"></script>");
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.supabaseClient = _supabase;
