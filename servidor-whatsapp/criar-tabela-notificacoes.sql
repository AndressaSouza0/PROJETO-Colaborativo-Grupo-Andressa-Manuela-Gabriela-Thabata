-- Execute este SQL no painel do Supabase:
-- https://supabase.com/dashboard → seu projeto → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS notificacoes_enviadas (
    id            BIGSERIAL PRIMARY KEY,
    emprestimo_id UUID NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL,
    status        TEXT DEFAULT 'enviado',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para evitar duplicatas e acelerar consultas
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_emprestimo_tipo
    ON notificacoes_enviadas (emprestimo_id, tipo);

-- Permitir acesso via chave anon (mesmo padrão das outras tabelas)
ALTER TABLE notificacoes_enviadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo para anon" ON notificacoes_enviadas
    FOR ALL USING (true) WITH CHECK (true);
