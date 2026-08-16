# VALLE 3.6.37 — Acesso do Cliente responsivo

- Modal de acesso do cliente reorganizado para celular.
- Campos de e-mail e senha agora possuem ícone integrado, mesma altura e foco uniforme.
- E-mail e senha não recebem transformação visual para caixa alta.
- A Edge Function não converte mais o e-mail para minúsculas; o texto informado é preservado após remover apenas espaços nas pontas.
- Adicionados `autocapitalize=none` e `spellcheck=false` para evitar alterações do teclado móvel.
- Botões do rodapé ficam 2 por linha no celular e 1 por linha em telas muito estreitas.
- Rolagem interna e safe-area do celular preservadas.
- Atualizado o versionamento/cache para 3.6.37.

IMPORTANTE: para a preservação do e-mail no servidor, redeploy da Edge Function `manage-user` com o arquivo desta versão.
