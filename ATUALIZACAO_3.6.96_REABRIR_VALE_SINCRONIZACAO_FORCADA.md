# VALLE — Versão 3.6.96

Correção da sincronização de reabertura de vale entre aparelhos.

- A consulta periódica passa a buscar o workspace diretamente no Supabase, sem aceitar cache antigo como resposta nova.
- A comparação usa o conteúdo do workspace e timestamps convertidos para instante numérico.
- A mudança PAGO -> ABERTO é aplicada mesmo quando o formato de `updated_at` difere entre navegador e PostgreSQL.
- Evita que um aparelho com estado antigo reverta uma reabertura recebida do banco.
- Reabertura só mostra sucesso depois da confirmação da fila de gravação no banco.
- Sincronização periódica reduzida para 3 segundos.
- Realtime é utilizado quando disponível, mantendo polling como fallback.
- Service Worker passa a usar rede primeiro para os arquivos do aplicativo e a URL de registro foi versionada para 3.6.96, evitando JavaScript antigo preso no PWA.

- O registro de auditoria `REABRIR_VALE` agora é iniciado/aguardado antes de publicar o novo estado do vale no workspace compartilhado.
- A aba Lançamentos, quando estiver aberta, consulta novos registros remotos a cada 4 segundos e também ao voltar para a tela/app.
- Isso elimina a corrida em que o outro aparelho recebia o vale ABERTO antes de o lançamento “VALE REABERTO” existir no servidor.
