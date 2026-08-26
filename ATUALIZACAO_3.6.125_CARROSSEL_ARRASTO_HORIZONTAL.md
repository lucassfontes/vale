# VALLE 3.6.125 — Arrasto horizontal do carrossel

- Corrigido o carrossel mobile que deixou de responder ao arrasto lateral na 3.6.124.
- Causa: `overflow: hidden` estava bloqueando o scroll horizontal nativo.
- O eixo horizontal voltou para `overflow-x: auto` com inércia nativa no iOS/Android.
- O eixo vertical continua fechado para não deformar a barra.
- Mantidos o gesto vertical de ocultar, margens laterais e posição elevada da 3.6.124.
- Sem alteração de banco ou SQL.
