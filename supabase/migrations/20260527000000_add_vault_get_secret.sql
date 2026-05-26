-- Adds vault_get_secret wrapper so the backend pipeline can read a Gemini API key
-- stored in Supabase Vault without exposing the decrypted_secrets view to the app layer.

CREATE OR REPLACE FUNCTION public.vault_get_secret(p_secret_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p_secret_id;
$$;

REVOKE ALL ON FUNCTION public.vault_get_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_get_secret(uuid) TO service_role;
