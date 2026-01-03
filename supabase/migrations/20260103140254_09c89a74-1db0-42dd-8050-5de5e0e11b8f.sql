-- Adicionar coluna para razão do bloqueio
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS block_reason text;

-- Comentário explicativo
COMMENT ON COLUMN agendamentos.block_reason IS 'Motivo do bloqueio (para status blocked ou early_leave)';