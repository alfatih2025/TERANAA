ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS ai_mode VARCHAR(20) DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS ai_primary_provider VARCHAR(20) DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS ai_primary_model VARCHAR(100) DEFAULT 'gemini-3.5-flash-lite',
  ADD COLUMN IF NOT EXISTS ai_fallback_1_provider VARCHAR(20) DEFAULT 'openrouter',
  ADD COLUMN IF NOT EXISTS ai_fallback_1_model VARCHAR(100) DEFAULT 'qwen/qwen-2.5-72b-instruct',
  ADD COLUMN IF NOT EXISTS ai_fallback_2_provider VARCHAR(20) DEFAULT 'groq',
  ADD COLUMN IF NOT EXISTS ai_fallback_2_model VARCHAR(100) DEFAULT 'openai/gpt-oss-120b',
  ADD COLUMN IF NOT EXISTS ai_strategy VARCHAR(20) DEFAULT 'priority',
  ADD COLUMN IF NOT EXISTS ai_temperature NUMERIC(3, 2) DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS ai_max_tokens INT DEFAULT 600;
