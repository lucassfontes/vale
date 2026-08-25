# VALLE 3.6.106 — Carrossel mobile realmente fixo

- Corrigido erro de cache: `index.html` ainda carregava `css/app.css?v=103`, impedindo celulares/PWA de receberem os CSS das versões 3.6.104/3.6.105.
- `app.css` agora é carregado com `?v=3.6.106`.
- O app mantém uma altura móvel estável e uma reserva vertical mesmo quando a aba está vazia.
- Crediário vazio e Notificações com poucos itens não reduzem mais a geometria da página.
- O dock do carrossel permanece fora do fluxo e sem transição/transform vertical.
- Login continua sem exibir o carrossel.
- Nenhuma alteração de banco/SQL foi necessária.
