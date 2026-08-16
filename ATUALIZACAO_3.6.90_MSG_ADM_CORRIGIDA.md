# VALLE 3.6.90 — MSG ADM corrigida

- A MSG ADM agora é verificada automaticamente enquanto o usuário de sessão está conectado.
- Também verifica ao voltar para o app, recuperar internet ou colocar a página em primeiro plano.
- A mensagem só é marcada como lida quando o usuário fecha o aviso.
- Corrigida a leitura por usuário para uma sessão não bloquear a mensagem de outra sessão.
- Mensagens direcionadas são filtradas para a sessão correta.
- Modal da MSG ADM fica acima da interface.
- Incluído `supabase/MENSAGENS_ADMIN_CORRECAO_3.6.90.sql` para corrigir/atualizar as políticas do Supabase.
