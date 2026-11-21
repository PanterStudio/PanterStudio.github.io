ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS web_uid text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS discord_id text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'usuario';
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS beta_tester_status text DEFAULT '';
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS web_data jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_perfiles_web_uid ON public.perfiles (web_uid);
CREATE INDEX IF NOT EXISTS idx_perfiles_discord_id ON public.perfiles (discord_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_correo ON public.perfiles (correo);
CREATE INDEX IF NOT EXISTS idx_perfiles_discord_usuario ON public.perfiles (discord_usuario);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS perfiles_lectura_web ON public.perfiles;
CREATE POLICY perfiles_lectura_web ON public.perfiles FOR SELECT USING (true);
DROP POLICY IF EXISTS perfiles_actualizacion_web ON public.perfiles;
CREATE POLICY perfiles_actualizacion_web ON public.perfiles FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.web_colecciones (coleccion text NOT NULL, id text NOT NULL, datos jsonb NOT NULL DEFAULT '{}'::jsonb, creado_en timestamptz NOT NULL DEFAULT now(), actualizado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (coleccion, id));
CREATE INDEX IF NOT EXISTS idx_web_colecciones_coleccion ON public.web_colecciones (coleccion);
CREATE INDEX IF NOT EXISTS idx_web_colecciones_datos ON public.web_colecciones USING gin (datos);

ALTER TABLE public.web_colecciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS web_colecciones_all ON public.web_colecciones;
CREATE POLICY web_colecciones_all ON public.web_colecciones FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.web_colecciones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.perfiles;
