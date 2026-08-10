# VALLE — Versão-3.6.12

## Backup revisado
- Botões do Backup reorganizados e com tamanho uniforme no celular.
- Download JSON revisado, com data e versão no arquivo.
- Restauração JSON valida o arquivo, mostra resumo e pede confirmação.
- Restauração automática mostra data, clientes e vales antes de substituir os dados.
- Em sessão compartilhada, restauração e limpeza confirmam a gravação no Supabase antes de informar sucesso.
- Se a sincronização falhar, o banco anterior é restaurado para evitar inconsistência entre aparelho e servidor.
- APAGAR TUDO exige conexão quando os dados pertencem a uma sessão compartilhada.
- O backup automático continua local ao navegador/aparelho e não é apagado pelo botão APAGAR TUDO.
