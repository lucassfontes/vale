# VALLE — Versão 3.6.111

- Painel do administrador: os blocos **Configuração financeira individual** e **Permissões do usuário de serviço** ficam totalmente ocultos ao criar/editar usuário de sessão.
- Painel do usuário de sessão: juros e permissões continuam disponíveis somente ao criar/editar usuário de serviço.
- Campo de senha ganhou botão de olho para mostrar/ocultar o valor digitado.
- Ao editar usuário de sessão ou usuário de serviço, aparece **Nova senha (opcional)**.
- Se preenchida, a nova senha é alterada com segurança pelo Supabase Auth.
- A senha atual não é armazenada nem recuperada em texto puro.
- É necessário republicar/deployar a Edge Function `manage-user` desta versão para habilitar a troca de senha em edição.
