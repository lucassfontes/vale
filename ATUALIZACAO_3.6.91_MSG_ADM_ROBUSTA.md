# VALLE 3.6.91 — MSG ADM robusta

- Compatibilidade com estrutura antiga de `admin_messages`.
- Se `admin_message_reads` falhar, a leitura usa fallback local em vez de impedir a mensagem.
- MSG ADM é verificada a cada 5 segundos enquanto a sessão está conectada.
- Incluído SQL completo e idempotente para criar/corrigir toda a estrutura da MSG ADM.
