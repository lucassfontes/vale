# VALLE 3.6.75 — Backdrop do modal de senha ao cancelar

- Corrigido o fundo escurecido que permanecia na tela após clicar em **Cancelar** no modal de senha.
- Agora o sistema identifica e remove apenas o backdrop criado pelo modal de senha.
- O backdrop do modal **Ver contrato** permanece normalmente quando ele continua aberto atrás.
- Incluído fallback para navegadores/mobile em caso de backdrop órfão após a animação.
