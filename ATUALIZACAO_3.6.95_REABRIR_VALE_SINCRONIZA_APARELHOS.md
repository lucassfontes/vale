# VALLE — Versão 3.6.95

## Correção: reabrir vale sincroniza entre aparelhos

- Corrigido o caso em que dois aparelhos usam o mesmo login.
- O segundo aparelho não ignora mais alterações cujo `updated_by` é o mesmo usuário.
- A sincronização agora usa `updated_at` para identificar uma versão nova do workspace.
- A verificação do banco compartilhado ocorre a cada 5 segundos.
- Ao voltar para a aba/app ou recuperar a conexão, a sincronização é feita imediatamente.
- A sincronização contínua também é instalada no usuário de sessão.
- Depois de receber a nova versão do workspace, o sistema atualiza a tela e os Lançamentos.
