# INVASÃO.EXE — RPG de digitação hacker

Jogo feito para o **Observatório de Cursos**, apresentando o curso de **Sistemas de Informação**.

O jogador é um estagiário de SI que precisa limpar os **9 andares** de uma empresa invadida por vírus.
Cada andar representa uma área do curso e tem um **chefão**. Para atacar, basta **digitar** as palavras
que aparecem sobre os inimigos. Quanto mais alto o andar, mais difíceis ficam as palavras e mais
**acentos** aparecem.

## Como rodar

**No dia do evento:** dê dois cliques em **`INICIAR_EVENTO.bat`**. O jogo abre em tela cheia travada
(modo quiosque): sem barra de endereço, sem abas e sem como fechar sem querer. Para sair: **Alt + F4**.
O ranking do evento fica num perfil próprio do navegador, separado do seu navegador do dia a dia.

**Para testar em casa:** abra o `index.html` no **Chrome** ou no **Edge** (F11 = tela cheia).

Não precisa de internet nem de instalação: as fontes estão na pasta `fonts/` e os sons e a pixel art
são gerados pelo próprio código.

> Atenção: o ranking do atalho (`INICIAR_EVENTO.bat`) e o ranking de quando você abre o `index.html`
> direto são **separados**. No evento, use sempre o atalho.

> O som só começa depois da primeira tecla apertada (regra dos navegadores).

## Como jogar

| Tecla | Ação |
|---|---|
| Letras | Atacar: digite a palavra sobre um inimigo |
| BACKSPACE | Trocar de alvo |
| 1, 2, 3, 4 | Usar itens (Café, Patch, Antivírus, Firewall) |
| ESC | Pausar (permite desligar o som ou desistir) |
| ENTER | Avançar nos menus |

- Depois do nick, o jogador escolhe o **modo**: **NORMAL** (9 andares, ~10 min) ou **RÁPIDO**
  (3 andares: Suporte, Banco de Dados e Diretoria, ~3 min). Cada modo tem o seu ranking.
- Acertar palavras **sem errar** aumenta o **combo**, que aumenta o dano.
- **12 conquistas** (+300 pontos cada), avisadas na tela na hora em que são desbloqueadas.
- No fim, um **relatório de desempenho**: velocidade e precisão por andar, as teclas que mais
  derrubaram o jogador, precisão nos acentos, conquistas e uma "análise dos seus dados".
- Quando a **barra vermelha** de um inimigo enche, ele ataca.
- Após cada chefão: escolha **1 de 3 cartas de upgrade** e depois compre itens na **loja** (Dark Market).
- Andares 1-2: sem acentos. Andares 3-4: acentos aparecem, mas dá para digitar sem eles.
  Andares 5-9: **os acentos contam!**

## Os 9 andares

| # | Andar | Chefão |
|---|---|---|
| 1 | Suporte Técnico | A Impressora Possuída |
| 2 | Sistemas Operacionais | Tela Azul da Morte |
| 3 | Programação | O Bug de Produção |
| 4 | Banco de Dados | DROP TABLE |
| 5 | Redes | O Wi-Fi da Faculdade |
| 6 | Computação em Nuvem | Black Friday |
| 7 | Segurança da Informação | Ransomware |
| 8 | Dados & Inteligência Artificial | I.A. Rebelde |
| 9 | Diretoria | O Prazo de Entrega |

## Personalizar

Quase tudo fica em **`js/data.js`**:

- `CONFIG`: nome do evento, do curso, tempo para voltar ao título e `ociosoSeg` (se um visitante abandonar
  o jogo num menu por 60 s, a partida é encerrada e o jogo volta ao título sozinho).
- `ANDARES`: palavras, frases dos chefões, falas, curiosidades ("Você sabia?") e dificuldade
  (`hp`, `dano`, `atkBase`, `porLetra` = segundos extras de tempo por letra antes do ataque).
- `UPGRADES` e `ITENS`: cartas e loja.
- `JOGADOR_BASE`: vida, dano e atributos iniciais.

A pixel art fica em `js/sprites.js`: cada letra do desenho é uma cor da paleta e `.` é transparente.

## Painel do organizador

Na **tela título**, aperte **Ctrl + Shift + O** e digite o PIN (**2026**, mude em `CONFIG.pinOrganizador`
no `js/data.js`). O painel mostra as estatísticas do dia (partidas, vitórias, velocidade e precisão médias,
melhor pontuação, conquistas mais comuns) e permite:

| Tecla | Ação |
|---|---|
| 1 | Modo de jogo: o jogador escolhe / sempre NORMAL / sempre RÁPIDO (útil com fila grande) |
| 2 | Liga/desliga o som |
| 3 | Volume: 25% / 50% / 75% / 100% |
| 4 | Exporta o ranking para planilha (CSV, abre no Excel) na pasta Downloads |
| 5 | Apaga o ranking (precisa apertar 2 vezes) |
| ESC | Volta ao jogo |

Os ajustes ficam salvos mesmo fechando o navegador.

## Ranking

O ranking fica salvo **no navegador do computador** (localStorage), separado por modo (normal e
rápido). Também dá para administrar pelo console (**F12** → aba *Console*):

```js
INVASAO.exportarRanking()   // mostra todos os resultados em tabela
INVASAO.limparRanking()     // apaga o ranking
```

O nick aceita até **30 caracteres** (letras, números, espaço, `_ - .`). Nicks com palavrões são bloqueados
(lista em `js/ranking.js`), sem barrar nomes inocentes como "Computação" ou "Rolando".

## Validação antes do evento

```
powershell -ExecutionPolicy Bypass -File tests\validar.ps1
```

Para conferir se os testes realmente pegam bugs, o `tests\mutacao.ps1` injeta 23 bugs conhecidos em
cópias do jogo e exige que todos sejam detectados.

O `validar.ps1` roda verificação estática, 70 testes automatizados, partidas completas do robô, screenshots e um teste de
resistência. Também dá para ver só os testes abrindo `index.html?teste=1`. O histórico de bugs, correções e
rodadas fica em [docs/VALIDACAO_E_AUDITORIA.md](docs/VALIDACAO_E_AUDITORIA.md).

## Modo de teste (para desenvolvimento)

| URL | O que faz |
|---|---|
| `index.html?andar=5` | Começa direto no andar 5 (não salva no ranking) |
| `index.html?andar=5&chefe=1` | Começa direto no chefão do andar 5 |
| `index.html?bot=1` | Um robô joga sozinho (`?bot=300` = 1 letra a cada 300 ms) |

## Estrutura

```
index.html        telas e HUD
css/style.css     visual neon / CRT / glitch
js/data.js        conteúdo e balanceamento  <- edite aqui
js/sprites.js     pixel art
js/sound.js       efeitos sonoros e música 8-bit (Web Audio)
js/ranking.js     ranking + filtro de nick
js/fx.js          chuva Matrix, partículas, lasers, tremor
js/battle.js      regras da batalha
js/ui.js          fluxo de telas, cartas, loja, ranking
js/main.js        loop principal e teclado
tests/testes.js   bateria de testes (index.html?teste=1)
tests/validar.ps1 validação completa
docs/             documento de validação e auditoria
```

## Dicas para o dia do evento

- Abra pelo `INICIAR_EVENTO.bat` e apague o ranking de teste no painel (Ctrl + Shift + O → 5 → 5).
- Fila grande? No painel, aperte 1 até ficar "SEMPRE RÁPIDO".
- No fim do dia, exporte o ranking (painel → 4) para anunciar os vencedores.
- Use um **teclado ABNT2** (com Ç) e, se possível, uma TV ou monitor grande.
- Se alguém sair no meio da partida, o jogo volta sozinho para o título depois do fim de jogo.
- Um prêmio simbólico para o top 3 do dia ajuda a formar fila.
