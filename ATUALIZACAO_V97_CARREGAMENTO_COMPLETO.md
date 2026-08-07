# VALLE v97 — carregamento completo

Esta versão altera a inicialização para que a tela de loading permaneça visível até a preparação dos dados da sessão.

## O que mudou
- O workspace remoto/local da sessão é restaurado antes de liberar a interface.
- Permissões e dados administrativos são carregados antes do `valle-app-ready`.
- Dashboard, clientes, histórico, relatórios, calendário, cobrança, notificações e busca são pré-renderizados.
- A aba Lançamentos aguarda a leitura da auditoria antes de concluir o carregamento.
- O Dashboard é renderizado novamente após a auditoria para evitar números temporariamente incompletos.
- Service Worker e cache foram atualizados para v97.
- O PWA continua com atualização automática em PC, Android e iPhone quando aberto por HTTPS/servidor web.
- Corrigido o aviso de foco `aria-hidden` dos modais Bootstrap.

## Importante
O sistema deve ser publicado em `https://` (ou executado por servidor local), nunca aberto com `file://`.
