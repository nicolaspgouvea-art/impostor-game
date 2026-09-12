# Impostor Game

Jogo social de dedução multiplayer para navegador, com frontend mobile-first no GitHub e backend no Supabase.

## Como funciona

1. Um jogador cria uma sala e recebe um código de 6 dígitos.
2. De 3 a 10 jogadores entram usando o código.
3. O host inicia a partida.
4. O servidor escolhe aleatoriamente uma palavra, uma pista inicial, a ordem dos turnos e um impostor.
5. Jogadores normais recebem a palavra secreta; o impostor recebe apenas **IMPOSTOR**.
6. O jogo publica uma pista inicial neutra e cada jogador envia uma pista na sua vez.
7. Depois de duas rodadas completas, qualquer jogador pode iniciar uma votação.
8. Se o grupo votar no impostor, o grupo vence. Em empate ou voto errado, o jogo continua.
9. O impostor pode tentar adivinhar a palavra no máximo duas vezes. Se acertar, vence imediatamente.

## Estrutura do frontend

- `index.html` — telas e estrutura da interface.
- `styles.css` — design mobile-first escuro.
- `app.js` — conexão com Supabase, estado, salas, turnos, votação e sincronização.
- `themes/themes.json` — catálogo versionado com 100 temas e pistas iniciais.

## Backend

O estado autoritativo da partida fica no Supabase. As tabelas de salas, jogadores, mensagens, votos, palpites e temas têm RLS habilitado e não possuem leitura direta pelo cliente.

O frontend chama RPCs específicas para criar/entrar em sala, obter estado, iniciar partida, enviar pista, iniciar votação, votar, tentar adivinhar, sair do lobby e encerrar a sala.

Cada jogador recebe um token aleatório. Apenas o hash SHA-256 desse token é armazenado no banco. A palavra secreta e a identidade do impostor não são expostas por consultas diretas.

## Sincronização

O cliente usa Supabase Realtime Broadcast para avisar os outros jogadores de mudanças e então busca novamente o estado autoritativo. Existe também polling periódico como fallback de reconexão.

## Salas temporárias

- Lobby: expira após inatividade.
- Partida: prazo maior enquanto está em andamento.
- Resultado: permanece por poucos minutos para todos verem o final.
- Relações usam exclusão em cascata para remover os dados associados quando a sala é apagada.

## Regras atuais

- Mínimo: 3 jogadores.
- Máximo: 10 jogadores.
- Votação disponível após 2 rodadas completas.
- Uma nova votação só fica disponível após avançar para uma rodada posterior.
- Empate ou acusação errada não elimina ninguém.
- Impostor: 2 tentativas para descobrir a palavra.
