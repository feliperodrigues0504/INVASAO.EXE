# INVASÃO.EXE — RPG de digitação hacker

[![CI](https://github.com/feliperodrigues0504/INVASAO.EXE/actions/workflows/ci.yml/badge.svg)](https://github.com/feliperodrigues0504/INVASAO.EXE/actions/workflows/ci.yml)

Jogo feito para o **Observatório de Cursos**, apresentando o curso de **Sistemas de Informação**.

O jogador é um estagiário de SI que precisa limpar os **9 andares** de uma empresa invadida por vírus.
Cada andar representa uma área do curso e tem um **chefão**. Para atacar, basta **digitar** as palavras
que aparecem sobre os inimigos. Quanto mais alto o andar, mais difíceis ficam as palavras e mais
**acentos** aparecem.

Funciona **100% offline**: as fontes estão embutidas, e os sons e a pixel art são gerados pelo código.

---

## No dia do evento

Baixe a versão mais recente na página de
[**Releases**](https://github.com/feliperodrigues0504/INVASAO.EXE/releases) e escolha **uma** das opções:

| Opção | Como usar |
|---|---|
| **App (recomendado)** — `InvasaoExe-portatil.exe` ou o instalador `*-setup.exe` | Dois cliques. Abre em tela cheia, sem depender do navegador, e guarda uma **cópia de segurança do ranking em arquivo**. |
| **Pacote web** — `InvasaoExe-web.zip` | Descompacte e dê dois cliques em **`INICIAR_EVENTO.bat`**. Abre o Edge/Chrome em tela cheia travada (modo quiosque), com um perfil próprio do navegador. |

Nas duas opções, para **sair**: **Alt + F4**.

> O ranking do app, o do atalho `.bat` e o de abrir o `index.html` direto são **separados**.
> No evento, use sempre a mesma opção.

### Checklist do estande

- Abra o jogo e apague o ranking de teste: na tela título, **Ctrl + Shift + O** → PIN → **5** → **5**.
- Fila grande? No painel, aperte **1** até ficar "SEMPRE RÁPIDO".
- No fim do dia, exporte o ranking (painel → **4**): vai para a pasta **Downloads**.
- Use um **teclado ABNT2** (com Ç) e, se possível, uma TV ou monitor grande.
- Desative a suspensão de tela e o protetor de tela do Windows; deixe o notebook na tomada.
- O som só começa depois da primeira tecla apertada (regra dos navegadores).

---

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

### Os 9 andares

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

---

## Painel do organizador

Na **tela título**, aperte **Ctrl + Shift + O** e digite o PIN (padrão **2026**, definido em
`src/content/jogo.json`; dá para trocar pelo próprio painel). O painel mostra as estatísticas do dia
(partidas, vitórias, velocidade e precisão médias, líderes de cada modo, conquistas mais comuns) e permite:

| Tecla | Ação |
|---|---|
| 1 | Modo de jogo: o jogador escolhe / sempre NORMAL / sempre RÁPIDO |
| 2 | Liga/desliga o som |
| 3 | Volume: 25% / 50% / 75% / 100% |
| 4 | Exporta o ranking para planilha (CSV, abre no Excel) na pasta Downloads |
| 5 | Apaga o ranking (precisa apertar 2 vezes) |
| 6 | Efeitos de tela **reduzidos**: sem tremor e sem piscar (pessoas com fotossensibilidade) |
| 7 | Trocar o PIN (fica salvo como hash, não em texto) |
| ESC | Volta ao jogo |

Os ajustes ficam salvos mesmo fechando o jogo. Se o Windows estiver com "reduzir animações" ligado, os
efeitos reduzidos já começam ativados.

No console do navegador (**F12**): `INVASAO.exportarRanking()` mostra o ranking em tabela e
`INVASAO.limparRanking()` apaga o ranking.

---

## Personalizar o conteúdo

Textos, palavras, chefões e balanceamento ficam em **JSON**, sem precisar mexer no código:

- **`src/content/andares.json`**: os 9 andares (palavras, frases e falas dos chefões, curiosidades
  "Você sabia?", dificuldade: `hp`, `dano`, `atkBase`, `porLetra`...).
- **`src/content/jogo.json`**: evento e curso, tempos do quiosque, PIN padrão, modos de jogo, conquistas,
  atributos do jogador, cartas de upgrade (efeitos como `{ "atributo": "atk", "op": "mul", "valor": 1.25 }`)
  e itens da loja.
- **`src/content/sprites.ts`**: a pixel art (cada letra é uma cor da paleta e `.` é transparente).

O conteúdo é **validado** ao abrir o jogo ([`src/content/schema.ts`](src/content/schema.ts)). Um erro
de edição (campo faltando, número inválido, sprite inexistente...) aparece **na tela, com o local exato**,
em vez de uma tela preta, e também reprova os testes (`npm test`).

---

## Desenvolvimento

Requisitos: **Node.js 20+** (recomendado 24). Para o app de desktop, também o
[Rust](https://www.rust-lang.org/tools/install) (a CI já compila o app, então não é obrigatório).

```bash
npm install          # instala as dependências
npm run dev          # servidor de desenvolvimento com recarga automática (http://localhost:5173)
npm run build        # gera dist/index.html: UM arquivo, abre com dois cliques, offline
npm run app:build    # gera o executável do Windows (precisa do Rust)
```

| Comando | O que faz |
|---|---|
| `npm test` | Testes de unidade (Vitest): regras da batalha, conteúdo, ranking, nick, máquina de estados, render. ~4 s |
| `npm run test:e2e` | Testes de ponta a ponta (Playwright) no **build real**, aberto via `file://` como no evento: fluxo completo com teclado, acentos ABNT2, quiosque, painel, layout no pior caso, segurança, fuzz de 3000 teclas, desempenho e **regressão visual** (screenshots) |
| `npm run test:e2e:robo` | Partidas completas jogadas por um robô em 4 velocidades + teste de resistência (lento) |
| `npm run test:e2e:update` | Atualiza as screenshots de referência depois de uma mudança visual **intencional** |
| `npm run test:mutation` | Teste de mutação (Stryker): injeta bugs na lógica e confere se os testes pegam cada um |
| `npm run validar` | Lint + formatação + tipos + unidade + E2E: tudo o que a CI roda |
| `npm run lint` / `npm run format` | ESLint / Prettier |

Atalhos de desenvolvimento pela URL:

| URL | O que faz |
|---|---|
| `?andar=5` | Começa direto no andar 5 (não salva no ranking) |
| `?andar=5&chefe=1` | Começa direto no chefão do andar 5 |
| `?bot=1` | Um robô joga sozinho (`?bot=300` = 1 letra a cada 300 ms; `&modo=2` = modo rápido) |
| `?semente=42` | Fixa a aleatoriedade: mesma semente = mesma partida (para reproduzir um bug) |

A arquitetura do código está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md), e o histórico de bugs,
correções e rodadas de validação em [docs/VALIDACAO_E_AUDITORIA.md](docs/VALIDACAO_E_AUDITORIA.md).

### Integração contínua

A cada push e pull request, o GitHub Actions roda lint, tipos, testes de unidade com cobertura, os testes
E2E no Windows, as partidas do robô e **compila o app de desktop**. Para publicar uma versão:

```bash
git tag v3.0.0 && git push origin v3.0.0
```

O workflow de Release gera o instalador, o `.exe` portátil e o pacote web e publica na página de
Releases. O teste de mutação roda toda segunda-feira (ou sob demanda, na aba Actions).
