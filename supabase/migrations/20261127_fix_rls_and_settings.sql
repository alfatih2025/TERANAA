-- =====================================================================
-- PERBAIKAN RLS (ROW LEVEL SECURITY) & DEFAULT ROW UNTUK NEXAGROW / TERANOVA
-- =====================================================================
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Skrip ini menyelesaikan error 500 / 42501 (RLS violation) saat menyimpan settings.
-- =====================================================================

-- 1. Nonaktifkan Row Level Security (RLS) pada tabel operasional agar API Vercel dapat membaca & menulis data
ALTER TABLE IF EXISTS public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_daily_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.control_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sensor_data DISABLE ROW LEVEL SECURITY;

-- 2. Berikan izin akses penuh ke role anon, authenticated, dan service_role
GRANT ALL ON TABLE public.settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.alerts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.chat_messages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.chat_daily_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.activity_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.control_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.devices TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sensor_data TO anon, authenticated, service_role;

-- 3. Berikan izin akses sequence (untuk auto-increment ID)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Pastikan baris default settings (id = 1) sudah ada di database
INSERT INTO public.settings (
    id,
    plant_phase,
    crop_mode,
    location,
    temp_threshold_low,
    temp_threshold_high,
    soil_threshold_low,
    soil_threshold_high,
    soil_threshold_critical,
    humidity_threshold_low,
    humidity_threshold_high,
    auto_report,
    report_time,
    watering_time,
    watering_duration,
    watering_enabled,
    user_name,
    user_email,
    ai_mode,
    ai_primary_provider,
    ai_primary_model,
    ai_fallback_1_provider,
    ai_fallback_1_model,
    ai_fallback_2_provider,
    ai_fallback_2_model,
    ai_strategy,
    ai_temperature,
    ai_max_tokens
)
VALUES (
    1,
    'vegetatif',
    'vegetatif',
    '33.74.07.1010',
    22.0,
    34.0,
    45.0,
    75.0,
    35.0,
    60.0,
    85.0,
    TRUE,
    '08:00',
    '06:00',
    10,
    TRUE,
    'Petani Cerdas',
    'petani@sprout.id',
    'default',
    'gemini',
    'gemini-3.5-flash-lite',
    'openrouter',
    'qwen/qwen-2.5-72b-instruct',
    'groq',
    'openai/gpt-oss-120b',
    'priority',
    0.40,
    600
)
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();
