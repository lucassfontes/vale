# Versionamento do VALLE

Versão atual exibida no sistema: **Versão-3.6.10**.

A versão foi centralizada em `js/version.js`.
A partir desta versão, cada atualização do projeto deve incrementar a versão do sistema nesse arquivo.

Padrão adotado:

- correção/ajuste pequeno: `3.6.10` -> `3.6.11`
- conjunto maior de funcionalidades: pode incrementar o número intermediário, por exemplo `3.6.x` -> `3.7.0`
- mudança principal incompatível: incrementar o primeiro número.

O número centralizado também é usado pelo cache do Service Worker, ajudando PC, Android e iPhone a reconhecerem a nova publicação.
