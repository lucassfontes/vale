# Deploy necessário — Versão 3.6.111

Para que a alteração de senha de usuários existentes funcione, publique novamente a Edge Function `manage-user` que está nesta versão.

No terminal, dentro da pasta do projeto Supabase:

```bash
supabase functions deploy manage-user
```

Não há SQL novo nesta versão.

A função continua respeitando a hierarquia:
- administrador pode alterar senha somente de usuário de sessão;
- usuário de sessão pode alterar senha somente de usuário de serviço pertencente à própria sessão.

A senha atual nunca é retornada ou armazenada em texto puro.
