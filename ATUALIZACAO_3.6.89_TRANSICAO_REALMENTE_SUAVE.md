# VALLE 3.6.89 — Transição móvel realmente suave

- A troca de aba no celular agora anima primeiro e só depois executa renderizações pesadas.
- Reduzido o deslocamento da animação para 9px e o tempo para 180ms.
- Removidas camadas antigas de View Transition da navegação comum para reduzir trabalho do compositor.
- O mesmo comportamento vale para clique e swipe.
