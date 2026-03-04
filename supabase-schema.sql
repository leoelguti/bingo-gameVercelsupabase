-- Supabase Schema for Bingo Pro Max (Serverless Migration)
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.

-- 1. Tabla de Usuarios
CREATE TABLE public.bingo_users (
    username text PRIMARY KEY,
    password text NOT NULL,
    display_name text NOT NULL,
    role text DEFAULT 'player'
);

-- 2. Tabla del Estado del Juego (Singleton)
CREATE TABLE public.bingo_game_state (
    id int PRIMARY KEY CHECK (id = 1),
    state jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Insertar estado inicial
INSERT INTO public.bingo_game_state (id, state) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING;

-- 3. Tabla de Cartones
CREATE TABLE public.bingo_cards (
    serial text PRIMARY KEY,
    numbers jsonb NOT NULL,
    status text NOT NULL DEFAULT 'available', -- 'available', 'reserved', 'payment_sent', 'confirmed'
    buyer_name text REFERENCES public.bingo_users(username),
    price numeric NOT NULL DEFAULT 0
);

-- 4. Tabla de Pagos
CREATE TABLE public.bingo_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_name text REFERENCES public.bingo_users(username),
    payment_method text,
    reference_number text,
    amount numeric,
    status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    cards jsonb NOT NULL, -- Array de seriales: ["1000", "1001"]
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Tabla de Ganadores
CREATE TABLE public.bingo_winners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_index text NOT NULL,
    prize_type text NOT NULL,
    player_name text NOT NULL,
    game_id text,
    payment_status text DEFAULT 'pending',
    winner_payment_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 6. Configuración de Pagos (Singleton)
CREATE TABLE public.bingo_payment_config (
    id int PRIMARY KEY CHECK (id = 1),
    methods jsonb NOT NULL DEFAULT '[]'::jsonb
);
INSERT INTO public.bingo_payment_config (id, methods) VALUES (1, '[]'::jsonb) ON CONFLICT (id) DO NOTHING;

-- Configurar Políticas de Seguridad (RLS)
-- Como es un juego local entre amigos y queremos una migración rápida P2P, permitimos acceso público.
-- (Para un entorno de producción real, se debe usar Supabase Auth y RLS restrictivo).

ALTER TABLE public.bingo_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_payment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write for all" ON public.bingo_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.bingo_game_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.bingo_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.bingo_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.bingo_winners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON public.bingo_payment_config FOR ALL USING (true) WITH CHECK (true);
