# INVASÃO.EXE — Validação e Auditoria

Documento vivo. A cada rodada de validação, os bugs encontrados, as correções e as lições aprendidas são
registrados aqui. **Objetivo:** garantir que o jogo esteja 100% apto para o Observatório de Cursos.

---

## 1. Como validar

> A partir da **versão 3** (modernização, 22/10/2026) a validação usa ferramentas padrão de mercado e roda
> sozinha no GitHub Actions a cada push. Os scripts antigos (`tests\validar.ps1`, `tests\mutacao.ps1`,
> `index.html?teste=1`) foram substituídos; o histórico das rodadas R1–R12 abaixo continua valendo.

| O quê | Como |
|---|---|
| **Validação completa** (recomendado antes do evento) | `npm run validar` (lint, formatação, tipos, unidade, E2E) |
| Só os testes de unidade (lógica, conteúdo, ranking...) | `npm test` (~4 s) |
| Testes de ponta a ponta no build real | `npm run test:e2e` |
| **Partidas completas do robô + resistência** | `npm run test:e2e:robo` |
| **Teste de mutação** (os testes pegam bugs de verdade?) | `npm run test:mutation` (relatório em `reports/mutation/mutation.html`) |
| Na nuvem | Aba **Actions** do GitHub: CI a cada push; mutação toda segunda-feira |

O que cada etapa cobre (equivalência com o antigo `validar.ps1`):

1. **Verificação estática** → `tests/unit/arquivos.test.ts`: acentos "soltos" (caracteres invisíveis),
   caracteres corrompidos, atalho `.bat` em ASCII com CRLF apontando para o build. O conteúdo (JSON) é
   validado por schema (`tests/unit/conteudo.test.ts`), inclusive referências cruzadas.
2. **Sem internet** → todo teste E2E **bloqueia a rede** e reprova qualquer acesso externo; o build é um
   único `dist/index.html` aberto via `file://`, como no evento.
3. **Bateria de testes** → 169 testes de unidade (Vitest) + 38 testes E2E (Playwright) com teclado real,
   acentos ABNT2, quiosque, painel, layout no pior caso, segurança e **fuzz de 3000 teclas**.
4. **Desempenho em tempo real** → `tests/e2e/desempenho.spec.ts`: cena mais pesada, sem GPU, em 960×540 e
   1920×1080; orçamento de 16,6 ms por quadro (60 fps).
5. **Partidas do robô** → `tests/e2e/robo.spec.ts`: 4 velocidades (2 por modo), nick de 30 caracteres.
6. **Screenshots** → agora é **regressão visual automática**: 15 telas comparadas pixel a pixel com as
   referências em `tests/e2e/__screenshots__/` (antes era só inspeção manual).
7. **Resistência** → 20 min simulados de quiosque, ciclo fim → ranking → título → nova partida.

Qualquer erro no console do navegador em qualquer teste E2E também reprova a validação.

---

## 2. Checklist de cobertura

| Área | O que é verificado | Como |
|---|---|---|
| Dados | 9 andares completos; palavras/frases em NFC, minúsculas, sem espaço sobrando; só caracteres do ABNT2; andares "sem acento" sem acento; sem repetição; letras iniciais variadas | testes |
| Pixel art | Todo sprite existe; toda cor usada está na paleta | testes |
| Nick | Até 30 caracteres; aceita nomes reais; bloqueia palavrões sem falso positivo | testes |
| Ranking | Ordenação, posição, dados corrompidos, partidas de teste não salvas | testes |
| Batalha | Acerto, erro, espaço, maiúsculas, acento leniente/estrito, backspace, combo (fórmula), crítico, ataque, escudo, bloqueio, morte única, backup | testes |
| Progressão | Os 9 andares do início ao fim (ondas → alerta → chefão → vitória) | testes + robô |
| Chefões | Invocar capangas sem letra conflitante; acelerar; fúria a 50% | testes |
| Itens / loja / cartas | Efeito de cada item e de cada carta; limites; créditos | testes |
| Teclado real | Campo escondido, tecla morta (´ + a), texto NFD, colar bloqueado | testes |
| Telas | Título → nick → tutorial → batalha → pausa → concluído → cartas → loja → fim → ranking → título | testes + robô |
| Quiosque | Menu abandonado volta sozinho; ESC/ENTER fora de hora não quebram nada | testes |
| Layout | HUD e ranking com nick de 30 caracteres; telas sem sobreposição | testes + screenshots |
| Robustez | Nenhum erro no console em nenhuma etapa | validar.ps1 |

### Checagem manual (só uma pessoa consegue fazer)

- [ ] **Som**: efeitos e música tocam e o volume está bom no PC do evento.
- [ ] **Teclado ABNT2 físico**: digitar `ação`, `você`, `análise`, `pôr`, `à` no andar 5+ (teclas mortas reais).
- [ ] **Monitor/TV do evento**: abrir em tela cheia (F11) e conferir a legibilidade a 2 metros.
- [ ] **Navegador do PC do evento**: Chrome ou Edge atualizados (versão 111 ou maior).
- [ ] **Atalho do evento**: dar dois cliques no `INICIAR_EVENTO.bat` uma vez no PC do evento e confirmar
      que abre em tela cheia travada (sair com Alt + F4). Os argumentos foram testados no navegador, mas a
      janela de quiosque real não foi aberta, para não tomar a tela do computador.
- [ ] **Antes de abrir o estande**: no jogo aberto pelo atalho, Ctrl + Shift + O → PIN → 5 → 5 (apaga o
      ranking de teste).
- [ ] Desativar suspensão de tela e protetor de tela do Windows; deixar o notebook na tomada.

---

## 3. Registro de bugs

Severidade: **Alta** = estraga o evento ou bloqueia jogadores · **Média** = comportamento errado visível ·
**Baixa** = detalhe, robustez ou risco pequeno.

| ID | Sev. | Área | Problema encontrado | Correção | Coberto por | Status |
|---|---|---|---|---|---|---|
| BUG-01 | Alta | Nick | O filtro de palavrões procurava trechos dentro do nick e bloqueava nomes inocentes: **"Computação"**, "computeiro", "deputado", "Rolando", "controlador", "enviado", "Yoshito" | Filtro em 3 níveis (em qualquer lugar / início da palavra / palavra exata), por palavra | teste *nick: aceita…* | ✅ Corrigido (R1) |
| BUG-02 | Alta | Quiosque | Visitante que saía no nick, tutorial, cartas, loja ou pausa deixava o jogo **preso naquela tela para sempre** | Vigia de inatividade (`CONFIG.ociosoSeg = 60`): no nick/tutorial volta ao título; com partida em andamento, encerra (salva a pontuação) | teste *visitante que abandona…* | ✅ Corrigido (R1) |
| BUG-03 | Média | Ranking | Dado corrompido ou de versão antiga no `localStorage` **quebrava a tela título** | Leitura valida e higieniza cada registro | teste *dados corrompidos…* | ✅ Corrigido (R1) |
| BUG-04 | Média | Batalha | Se vários inimigos atacassem no mesmo quadro em que o jogador morre, a morte era processada várias vezes (som e explosão duplicados) | Etapa conferida a cada inimigo + trava em `atacar()` | teste *3 inimigos atacando…* | ✅ Corrigido (R1) |
| BUG-05 | Média | Som | Pausar durante a explosão do chefão (ou a derrota) e continuar fazia a **música voltar e seguir tocando nos menus** | Pausa bloqueada nessas etapas; música só retoma em combate; música para no fim de andar e no fim de jogo | teste *não dá para pausar…* | ✅ Corrigido (R1) |
| BUG-06 | Média | Upgrade | Com **Autocomplete**, digitar a 1ª letra (que já vem pronta) por hábito contava como erro e zerava o combo | A 1ª letra digitada por hábito apenas escolhe o alvo | teste *Autocomplete…* | ✅ Corrigido (R1) |
| BUG-07 | Média | Som | Depois de a aba ficar em segundo plano, a música tocava todas as notas atrasadas de uma vez | O agendador pula as notas perdidas | revisão de código (áudio não é testável sem fone) | ✅ Corrigido (R1) |
| BUG-08 | Baixa | Código | A regex que remove acentos estava gravada com **caracteres invisíveis** em vez de `\u0300-\u036f`; um editor poderia corrompê-la sem ninguém notar | Regravada com escape; `validar.ps1` agora reprova qualquer caractere combinante solto | verificação estática | ✅ Corrigido (R1) |
| BUG-09 | Baixa | Telas | ENTER apertado enquanto as fontes carregavam abria a tela de nick antes da hora | Estado inicial `carregando` ignora teclas | revisão de código | ✅ Corrigido (R1) |
| BUG-10 | Baixa | Trapaça | Era possível **colar** (Ctrl+V) texto no campo de digitação | `paste` e `drop` bloqueados | teste *digitação pelo campo escondido…* | ✅ Corrigido (R1) |
| BUG-11 | Baixa | Layout | Nome de chefão longo podia sobrepor o número de vida na barra | Vida abaixo da barra; nome com largura máxima | screenshot `05_chefao` | ✅ Corrigido (R1) |
| BUG-12 | Baixa | Layout | A seta ▶ do alvo podia sair da tela pela esquerda | Margem mínima de 34px | revisão de código | ✅ Corrigido (R1) |
| BUG-13 | Baixa | Código | "9 andares" e "9/9" fixos no código (quebrariam se mudar a quantidade de andares) | Usa `ANDARES.length` | revisão de código | ✅ Corrigido (R1) |
| BUG-14 | Baixa | Ranking | Limite de 200 registros: a posição mostrada no fim podia não existir na tabela | Limite de 1000 | revisão de código | ✅ Corrigido (R1) |
| BUG-15 | Baixa | UX | Frase do chefão do andar 3 tinha "?", que em notebooks ABNT2 sem a tecla exige AltGr+W | "?" removido do andar 3 | teste de dados | ✅ Corrigido (R1) |
| BUG-16 | Baixa | Quiosque | O botão direito abria o menu do navegador | Menu de contexto bloqueado | revisão de código | ✅ Corrigido (R1) |
| BUG-17 | Baixa | Nick | Nicks sem nenhuma letra eram aceitos (`..`, `- -`) e poluíam o ranking | Exige ao menos 2 letras ou números | teste *nick: exige 2 letras…* | ✅ Corrigido (R2) |
| BUG-18 | Baixa | Nick | Espaços repetidos no meio do nick eram mantidos ("Ana     Clara") | Espaços repetidos viram um só | teste *nick: exige 2 letras…* | ✅ Corrigido (R2) |
| BUG-19 | Baixa | Texto | Andar 7: "Confie em ninguém" (erro de português) | "**Não** confie em ninguém" | revisão de texto | ✅ Corrigido (R2) |
| BUG-20 | Baixa | Texto | Andar 2 se chamava "primeiro andar" na descrição, mas a tela mostra "ANDAR 2/9" | Descrição reescrita | revisão de texto | ✅ Corrigido (R2) |
| BUG-21 | **Alta** | Offline | O `index.html` ainda carregava fontes do Google por `<link>` externo, que **bloqueia a exibição da página**. Em Wi-Fi com portal de login (comum em faculdades) o jogo podia abrir com **tela preta por vários segundos** | Link removido (as fontes já estão em `fonts/`); `validar.ps1` reprova qualquer `http(s)://` no jogo | verificação estática | ✅ Corrigido (R2) |
| BUG-22 | Baixa | Layout | No ranking, o nick de 30 caracteres encostava na coluna de pontos | Coluna mais larga e com respiro | teste *fim de jogo e ranking cheio…* (nick inteiro, sem reticências) | ✅ Corrigido (R2) |
| BUG-23 | Média | Conquistas | A fila de avisos de conquista não tinha limite e **atravessava partidas**: um chefão perfeito gera até 6 avisos (10,8 s cobrindo o banner do andar seguinte), e avisos de um jogador podiam aparecer na partida do próximo | Fila limpa ao voltar ao título; conquistas simultâneas viram uma rajada; avisos intermediários de 1,2 s (6 avisos ≤ 9 s) | teste *avisos de uma partida não vazam…* | ✅ Corrigido (R5) |
| BAL-01 | Média | Balanceamento | Modo rápido difícil demais: até o robô a 98 ppm perdia no 3º andar (salto do Banco de Dados para a Diretoria com só 2 upgrades) | Inimigos e chefões com 60% da vida no modo rápido (`fatorVida`). Depois: 95 ppm **vence**, 27 ppm chega ao chefão final | robô modo rápido (2 velocidades) + teste da rota | ✅ Corrigido (R5) |
| VIS-01 | Baixa | Layout | No relatório, o nick aparecia todo em maiúsculas e cortado ("@ROBÔ TESTADOR DA COMPUTA…") | Nick em linha própria com a fonte do terminal | screenshot `13_relatorio` | ✅ Corrigido (R5) |
| SND-01 | Baixa | Som | Conquistas simultâneas (chefão perfeito) tocavam até 6 sons ao mesmo tempo | Um som por aviso exibido | revisão de código | ✅ Corrigido (R8) |
| UX-01 | Baixa | Painel | "Melhor pontuação" misturava os dois modos (o vencedor do rápido nunca aparecia) | "Líder do normal" e "líder do rápido" | teste do painel | ✅ Corrigido (R8) |
| SEG-01 | Média | Segurança | **Ponto cego da bateria** revelado pelo teste de mutação: se a proteção contra HTML no nick fosse removida, nenhum teste perceberia (um ranking adulterado direto no navegador viraria código na tela) | Teste de injeção de código no título, painel, ranking e CSV | mutante M15 | ✅ Coberto (R9) |
| BAL-02 | Média | Conteúdo | **Conquista impossível**: o combo zerava a cada andar e o modo rápido não tem palavras para chegar a x20 num andar só | O combo continua entre os andares; teste com "jogador perfeito" nos 2 modos | mutante M23 | ✅ Corrigido (R11) |
| TST-06 | — | Testes | Asserção errada no teste de segurança (o ranking corta nicks em 30) e risco de o M15 ter "morrido" por ela | Asserção corrigida; o relatório de mutação agora mostra o **motivo** de cada morte | — | ✅ Corrigido (R9) |
| TST-07 | — | Testes | Teste de robustez apertou tecla dentro da trava de 600 ms (3ª vez que esse erro aparece: R1, R5, R10) | Espera antes da tecla; registrado como erro recorrente na memória | — | ✅ Corrigido (R10) |
| TST-09 | — | Testes | **Teste instável**: o teste do BACKSPACE usava a palavra sorteada; com "cpu" (3 letras) falhava ~1 em 30 vezes. Descoberto porque o M22 "morreu" no teste errado | Palavra fixa no teste; bateria rodada 3x seguidas: 70/70 nas 3 | mutante M22 | ✅ Corrigido (R12) |
| TST-08 | — | Ferramenta | `mutacao.ps1 -Somente M17,M21,M22` não rodou nada e mostrou "0 de 0" sem reprovar (falsa aprovação) | Lista separada por vírgula; reprova se nenhum mutante rodar | — | ✅ Corrigido (R10) |
| REQ-01 | — | Nick | **Pedido:** nick de até 30 caracteres | `maxlength=30`, validação, mensagens, HUD e ranking com reticências, tabela de largura fixa | testes *nick…* e *título → nick de 30…*; robô usa nick de 30 | ✅ Feito (R1) |
| MEL-01 | — | UX | ESPAÇO também inicia o jogo no título | — | teste *ESPAÇO…* | ✅ Feito (R1) |
| TST-01 | — | Testes | Defeito no próprio teste: o helper pedia o chefão com inimigo comum vivo | Helper limpa a onda antes | — | ✅ Corrigido (R1) |
| TST-02 | — | Testes | O teste "sem internet" passava ao navegador um argumento com espaços sem aspas; o navegador recusava abrir e o teste reprovava o jogo à toa | Argumento entre aspas | — | ✅ Corrigido (R3) |
| TST-03 | — | Testes | O teste de desempenho mostrava **0,00 ms** (sempre passava): no navegador de testes o relógio é virtual e não anda durante código síncrono | Tempo medido de fora, em tempo real, pelo `validar.ps1` (3000 quadros contra 0) | — | ✅ Corrigido (R3) |
| TST-04 | — | Testes | O teste "sem internet" com DNS bloqueado **não pegaria o BUG-21**: o controle negativo (cópia com o link do Google de volta) também passava | Rede "pendurada" (IP que nunca responde) + tempo real. Controle negativo: **43,4 s** com o link contra **1,0 s** sem ele | controle negativo | ✅ Corrigido (R3) |
| TST-05 | — | Testes | O fuzz da R4 só visitava 8 das 12 telas (teclas aleatórias quase nunca vencem um chefão) | O fuzz força vitórias periódicas e exige passar por todas as telas | — | ✅ Corrigido (R4) |

### Funcionalidades da versão 2 (pedidas após a R4)

| ID | Funcionalidade | Coberto por |
|---|---|---|
| FEAT-01 | **12 conquistas** (+300 pontos cada) com aviso na tela, salvas no ranking | 6 testes (definições, desbloqueio único, condições de cada conquista, velocidade real da frase, rajada/vazamento) |
| FEAT-02 | **Modo rápido** (3 andares: Suporte → Banco de Dados → Diretoria, 60% dos inimigos), com ranking separado | 2 testes (rota e partida completa pela interface) + robô em 2 velocidades |
| FEAT-03 | **Relatório de desempenho**: velocidade/precisão por andar, teclas mais erradas, precisão nos acentos, conquistas e análise | teste de conteúdo + pior caso de layout (9 andares, todas as conquistas) |
| FEAT-04 | **Painel do organizador** (Ctrl+Shift+O + PIN): estatísticas do dia, modo fixo, som, volume, exportar CSV, apagar ranking com confirmação; ajustes persistentes | 3 testes (acesso, ajustes, CSV/apagar) + screenshot |
| FEAT-05 | **Atalho `INICIAR_EVENTO.bat`**: tela cheia travada (quiosque), perfil próprio do navegador | verificação estática (ASCII, CRLF, `--testar`) + argumentos testados no navegador |

### Versão 3 — modernização (22/10/2026)

Migração para Vite + TypeScript, lógica separada da apresentação, conteúdo em JSON validado, app de
desktop (Tauri) e testes com Vitest/Playwright/Stryker na CI. Veja [ARQUITETURA.md](ARQUITETURA.md).

| ID | Sev. | Área | Problema encontrado | Correção | Coberto por | Status |
|---|---|---|---|---|---|---|
| MOD-01 | Média | Ranking | O limite de 1000 registros valia para os **dois modos juntos**: um dia com muitas partidas rápidas apagaria o ranking do modo normal | Limite **por modo** | teste *o limite é POR MODO* | ✅ Corrigido (v3) |
| MOD-02 | Média | Desempenho | A primeira versão da tela nítida desenhava o quadro inteiro na resolução real: em 1920×1080 sem GPU, **~40 ms por quadro** (o original: ~15 ms). Pego pelo teste de desempenho novo, antes de chegar ao evento | Duas camadas: pixel art em 960×540 (ampliada por CSS, como antes) + só os **textos** na resolução real. Voltou ao custo do original (~17 ms contra ~16 ms, mediana de 5 rodadas) | teste *cena pesada a 1920x1080* | ✅ Corrigido (v3) |
| MOD-03 | Baixa | Código | A lição 1 se repetiu: a ferramenta de escrita gravou `\u0300-\u036f` e `\uFEFF` como **caracteres invisíveis** em 3 arquivos | Regravados com escape | `tests/unit/arquivos.test.ts` (pegou na primeira execução) | ✅ Corrigido (v3) |
| MOD-04 | Baixa | Painel | O PIN ficava fixo no código-fonte, visível para quem abrisse o arquivo | PIN trocável pelo painel [7], salvo como hash | teste *o PIN pode ser trocado* | ✅ Feito (v3) |
| MOD-05 | — | Acessibilidade | Tremor de tela e piscar do CRT sem opção de desligar (fotossensibilidade) | Painel [6] "efeitos reduzidos"; liga sozinho se o Windows estiver com "reduzir animações" | testes do painel + `FX` | ✅ Feito (v3) |
| MOD-06 | — | Quiosque | Conteúdo com erro de edição deixava a tela preta | O motivo aparece **na tela**, com o campo exato | teste *conteúdo inválido mostra o motivo* (build corrompido de verdade) | ✅ Feito (v3) |
| TST-10 | — | Testes | O relógio falso do Playwright continua andando em tempo real depois de instalado: o jogo "andava sozinho" entre os comandos do teste (falsas falhas de pausa e de ENTER duplo) | Relógio pausado logo após instalar; o tempo só anda quando o teste manda | — | ✅ Corrigido (v3) |
| TST-11 | — | Testes | O fuzz novo só forçava vitória num passo exato e às vezes nunca passava por cartas/loja (lição 15) | Vitória forçada a cada ~100 passos em batalha; o teste exige visitar as telas | — | ✅ Corrigido (v3) |

Os 23 mutantes manuais (`mutacoes.json`) foram substituídos assim: os de **lógica** (M02, M05, M06, M09,
M11, M12...) agora são gerados automaticamente pelo Stryker sobre `src/game` e `src/storage`; os de
**interface** (M01, M03, M04, M07, M08, M10, M13, M14...) são cobertos pelos testes E2E equivalentes
(conquistas que não vazam, PIN, CSV, colar bloqueado, inatividade, confirmação de apagar, tecla morta,
pausa na vitória).

### Auditoria de bugs da versão 3 (22/10/2026)

Revisão manual de todo o código + teste de mutação (Stryker) para achar o que os testes não vigiavam.
Cada bug ganhou um teste que reprova o código antigo (controle negativo feito para todos).

| ID | Sev. | Área | Problema encontrado | Correção | Coberto por | Status |
|---|---|---|---|---|---|---|
| AUD-05 | **Alta** | Painel / teclado | **Segurar a tecla 5 no painel apagava o ranking inteiro**: o teclado repete a tecla segurada (~0,5 s depois), e a repetição contava como a "2ª vez" da confirmação. Na batalha, segurar 1 gastava todos os cafés e segurar ESC ficava alternando pausa/continuar. **Já existia na versão original** | Teclas repetidas (`repeat`) não disparam ações de menu, item ou pausa; letras seguradas continuam digitando | E2E *SEGURAR uma tecla não repete a ação* | ✅ Corrigido |
| AUD-01 | Média | Batalha | A frase nova do chefão (a cada golpe) não era conferida contra os capangas: "funciona na minha máquina" × capanga "função" (andar 3). Digitar "f" podia mirar no capanga, e a 5ª letra virava erro e zerava o combo | Ao trocar de frase, o capanga em conflito (ainda não começado) recebe outra palavra | teste *frase nova do chefão nunca começa com a mesma letra de um capanga* | ✅ Corrigido |
| AUD-02 | Média | Ranking / CSV | O CSV usava horário UTC: exportado às 21:30 em Brasília, o arquivo saía com a data do **dia seguinte** e as partidas com 00:30 | Nome do arquivo e coluna `data` em horário local (`dd/mm/aaaa hh:mm`); o armazenamento continua em ISO | 3 testes *datas do CSV no horário local* | ✅ Corrigido |
| AUD-03 | Média | Segurança | **Injeção de fórmula no Excel**: um nick adulterado como `=HIPERLINK(...)` (ou `-A1`, `@SOMA`) virava fórmula ativa ao abrir o CSV | Texto que começa com `= + - @` ganha um apóstrofo (padrão OWASP) | teste *nick que começa com = + - @ não vira fórmula* | ✅ Corrigido |
| AUD-04 | Média | Testes | Pontos cegos revelados pela mutação: **fórmula de pontuação** (decide o ranking), contagem de acertos/erros (PPM e precisão), dano por tamanho de palavra, limiar das conquistas, efeito real do café/SSD/VPN, Mineração, Garbage Collector, limite de inimigos na tela | 28 testes novos (`tests/unit/regras.test.ts` + batalha/conquistas) | mutação: 60% → **69,9%** | ✅ Coberto |
| AUD-06 | Média | Ferramenta | **O teste de mutação não testava nada**: com o Vitest 5, o Stryker 10 não ativava os mutantes (todos "sobreviviam" com 0 testes rodados; `battle.ts` dava 0,6%). Sem a auditoria, a CI semanal reprovaria sempre ou, pior, alguém baixaria o limite. Também mutava os sprites (dados) e copiava pastas de relatório | Vitest fixado na 4.x (Dependabot não sobe a versão maior); sprites fora da mutação; `ignorePatterns` | controle: bug injetado à mão foi pego pelos testes mas não pelo Stryker | ✅ Corrigido |

Observado e **não alterado** (risco baixo, decisão de design): com o upgrade Autocomplete, digitar a 1ª letra
"por hábito" escolhe o primeiro inimigo cuja palavra começa com ela, mesmo que dois comecem igual.

---

## 4. Rodadas de validação

| Rodada | Data | Estática | Testes | Robô (99 / 45 / 29 / 13 ppm) | Console | Visual | Resultado |
|---|---|---|---|---|---|---|---|
| R1 | 17/10/2026 | OK | 39/40 → **40/40** após corrigir TST-01 | andar **9 / 6 / 3 / 2** | sem erros | OK | ✅ Aprovada (16 bugs + 1 requisito resolvidos) |
| R2 | 17/10/2026 | OK | **47/47** (+7 novos: casos-limite de nick e layout no pior caso) | andar **8 / 6 / 3 / 2** | sem erros | 1366x768, 4:3 e Full HD OK; 1 ajuste no ranking | ✅ Aprovada; **resistência: 14 partidas seguidas em 40 min simulados**; revisão achou BUG-17 a BUG-22 |
| R3 | 17/10/2026 | OK + **rede pendurada: abre em 1,1 s** | **48/48** + **desempenho real: 1,35 ms/quadro** (sem GPU) | andar **9 / 6 / 3 / 2** | sem erros | ranking corrigido OK | ✅ Aprovada. **Nenhum bug novo no jogo**; 3 defeitos nos testes (TST-02 a TST-04) corrigidos; BUG-21 comprovado por medição (43 s contra 1 s) |
| R4 | 17/10/2026 | OK + rede pendurada 1,1 s | **49/49** (+ fuzz de 3000 teclas nas 12 telas) + desempenho 1,03 ms/quadro | andar **9 / 6 / 3 / 2** | sem erros | título e cartas OK | ✅ **Aprovada. Nenhum bug novo no jogo**; 1 defeito de cobertura no fuzz (TST-05) corrigido; resistência: 14 partidas seguidas |

**Versão 2** (conquistas, modo rápido, relatório, painel e atalho). Robô: normal 99 / 45 / 29 / 13 ppm e
modo rápido 98 / 28 ppm.

| Rodada | Data | Estática + atalho + rede | Testes | Robô normal | Robô rápido | Resistência | Resultado |
|---|---|---|---|---|---|---|---|
| R5 | 17/10/2026 | OK · rede pendurada 1,1 s | 60/61 → 61/62 → **62/62** | 8 / 6 / 3 / 2 | 3/3 (perdeu) / 2/3 | 12 partidas | ✅ Aprovada após corrigir **BUG-23**; revisão visual e de balanceamento acharam **BAL-01** e **VIS-01** |
| R6 | 17/10/2026 | OK · 1,1 s | **62/62** · 1,36 ms/quadro | 8 / 6 / 3 / 2 | **3/3 ✓ venceu** / 3/3 | 13 partidas | ✅ Aprovada; BAL-01 e VIS-01 confirmados |
| R7 | 17/10/2026 | OK · 2,1 s | **62/62** · 1,37 ms/quadro | **9/9 ✓** / 6 / 3 / 2 | 3/3 ✓ / 3/3 | 13 partidas | ✅ **Aprovada sem nenhuma falha** (código idêntico ao da R6: resultados reproduzidos) |

**Auditorias R8–R12** (pedidas: "mais 5 vezes, aprendendo com os erros"). Cada rodada = validação completa +
uma frente nova.

| Rodada | Frente nova | Testes | Achados |
|---|---|---|---|
| R8 | Revisão de código da versão 2 | 62/62 | SND-01, UX-01 |
| R9 | **Teste de mutação** (`tests\mutacao.ps1`, 20 bugs injetados) | 63/63 | **19/20 mortos** → M15 sobreviveu → SEG-01; TST-06 |
| R10 | Robustez: sem armazenamento, 1000 jogadores, atalho do navegador, tecla dupla | 67/67 | TST-07, TST-08; mutantes M17, M21, M22 mortos pelo motivo certo |
| R11 | Conteúdo: toda conquista é alcançável? | 70/70 | **BAL-02** (combo x20 impossível no rápido); M23 morto |
| R12 | Final: **23 mutantes** + validação completa + motivo de cada morte + 3 execuções seguidas | 70/70 (×3) | **23/23 mortos**; TST-09 (teste instável) |

### Parecer final da versão 3 (modernização + auditoria, 22/10/2026)

**Apto para o Observatório.** Validação da versão 3, com a CI do GitHub verde em todos os jobs:

| Verificação | Resultado |
|---|---|
| Testes de unidade (Vitest) | **169/169**, cobertura de ~98% das linhas da lógica do jogo |
| Testes E2E no build real via `file://`, rede bloqueada (Playwright) | **36/36** + 2 de desempenho, incluindo a regressão visual de 15 telas |
| Partidas completas do robô (4 velocidades) + resistência | **5/5**: robô a 100 ppm chega ao andar 8/9; ciclo de quiosque sem travar |
| Desempenho, cena mais pesada, sem GPU | 13,8 ms/quadro em 960×540 e 11,5 ms em 1920×1080 (orçamento: 16,6 ms) |
| Teste de mutação (Stryker) | **69,9%** dos bugs injetados detectados (o restante é sobretudo cosmético: logs, duração de efeitos) |
| App de desktop (Tauri) | compila na CI e gera o `.exe` portátil e o instalador |

A auditoria corrigiu 4 bugs no jogo (AUD-01 a AUD-03 e AUD-05, este de severidade **alta** e herdado da
versão 2) e 1 defeito grave na ferramenta de mutação (AUD-06). Tela título simplificada: só o nome do jogo
em destaque, com o ranking ao lado.

**Pendente, e só uma pessoa consegue fazer:** testar o `.exe` no PC do evento e a checagem manual da seção 2
(som, teclado ABNT2 físico, monitor, abrir um CSV exportado no Excel).

### Parecer final após as auditorias R8–R12

**Apto para o Observatório.** 70 testes automatizados, estáveis em 3 execuções seguidas; 23 de 23 bugs
injetados detectados, cada um pelo teste certo; robô vencendo nos dois modos; 14 partidas seguidas no
teste de resistência; abre em 1,1 s com a rede travada; ~1 ms por quadro. Nas 5 auditorias, os achados
no jogo foram de severidade baixa/média (SND-01, UX-01, BAL-02) e um ponto cego de teste (SEG-01), todos
resolvidos. Os demais achados eram defeitos dos próprios testes (TST-06 a TST-09), também corrigidos.

### Parecer final da versão 2 (após R7)

**Apto para o Observatório.** As 5 funcionalidades novas estão cobertas por 14 testes novos (62 no total),
robô nos dois modos e screenshots. As 3 validações seguidas (R5 a R7) passaram em todas as etapas; a R5
achou e corrigiu 1 bug (BUG-23), 1 problema de balanceamento (BAL-01) e 1 ajuste visual (VIS-01). R6 e R7
passaram sem nenhum achado novo.

Continua pendente apenas a checagem manual da seção 2, que inclui agora **abrir o `INICIAR_EVENTO.bat` uma
vez no PC do evento**.

### Parecer final (após R4)

**O jogo está apto para o Observatório** do ponto de vista de software: 22 bugs corrigidos (3 de severidade
alta), 49 testes automatizados passando, zero erros de console em todas as etapas, abre em ~1 s mesmo com
a rede ruim, roda a ~1 ms por quadro e aguenta horas de uso contínuo em modo quiosque. As Rodadas 3 e 4 não
encontraram nenhum bug novo no jogo, só nos próprios testes.

**Pendente, e só uma pessoa consegue fazer:** a checagem manual da seção 2 (som, teclado ABNT2 físico,
monitor do evento, versão do navegador, limpar o ranking antes de abrir o estande).

---

## 5. Lições aprendidas (aplicar sempre)

1. **Escapes `\uXXXX`**: a ferramenta de escrita converte `\u0300` no próprio caractere invisível.
   Sempre conferir os bytes do arquivo; o `validar.ps1` faz isso automaticamente.
2. **PowerShell 5**: scripts `.ps1` com acento precisam de BOM UTF-8. Nunca usar `$args` como variável.
3. **Testes headless**: `requestAnimationFrame` não avança em tempo virtual. Na v3, o relógio falso do
   Playwright (`page.clock`) controla timers e quadros, mas precisa ser **pausado** logo após instalado (TST-10).
4. **Filtros por trecho de texto geram falsos positivos** (o "problema de Scunthorpe"). Testar sempre com
   nomes e palavras reais de quem vai jogar.
5. **Laços que processam vários inimigos** precisam reler o estado a cada iteração: o que um faz muda o
   que o próximo pode fazer.
6. **Quiosque**: toda tela precisa de uma saída automática por inatividade.
7. **Dados persistidos** (`localStorage`) devem ser validados na leitura, nunca confiados.
8. **Testes de interface** precisam respeitar a trava de 600 ms entre telas (proteção contra ENTER duplo).
9. **Helpers de teste devem reproduzir pré-condições reais.** Quando um teste falha, verificar primeiro se o
   defeito é do teste ou do jogo, e registrar qual dos dois foi.
10. **Rodada que só repete o que já passou não acha nada novo.** Cada rodada deve atacar uma frente nova
    (R2: pior caso de layout, resoluções, resistência; R3: desempenho e dependências externas).
11. **Nada externo no jogo**: qualquer `<link>` ou `<script>` para a internet pode bloquear a abertura em
    rede ruim. O jogo precisa abrir idêntico com o cabo de rede desconectado.
12. **Teste verde não substitui olhar a tela**: o nick encostando na coluna de pontos (BUG-22) só apareceu na
    screenshot. Depois de achado visualmente, virou teste automático.
13. **Todo teste novo precisa de um controle negativo**: introduzir o defeito de propósito e confirmar que
    o teste reprova. Sem isso, o teste de "sem internet" (TST-04) e o de desempenho (TST-03) pareciam
    funcionar, mas não detectavam nada.
14. **Tempo virtual mente sobre tempo**: tudo que mede duração (desempenho, espera de rede) tem que ser
    cronometrado de fora, em tempo real.
15. **Fuzz precisa medir a própria cobertura**: "zero erros" só vale se ele passou por todas as telas.
16. **Estado global de interface (filas, avisos, timers) precisa ser zerado entre visitantes.** Em quiosque,
    "a partida anterior" é outra pessoa (BUG-23).
17. **Arquivos `.bat`**: só ASCII e quebras de linha CRLF; nada de blocos `( )` com caminhos que podem ter
    parênteses (ex.: `Program Files (x86)`). Usar `goto`.
18. **Toda funcionalidade nova entra com teste junto**, e os testes antigos de fluxo são atualizados para as
    telas novas antes de rodar a validação.
19. **Teste de mutação** (desde a v3, Stryker: `npm run test:mutation`): injetar bugs e exigir que a
    bateria reprove cada um. Mutante sobrevivente = ponto cego (achou SEG-01). Todo bug corrigido ganha um
    teste que reprova a volta do bug.
20. **Mutante só conta como morto se morreu pelo motivo certo**: ler a mensagem da falha (TST-06).
21. **Ferramenta de validação que roda zero casos tem que reprovar**, nunca dizer "ok" (TST-08).
22. **Conteúdo também tem bug**: simular um "jogador perfeito" prova que toda conquista é possível (BAL-02).
23. **Teste com dado sorteado é instável**: fixar o que a asserção depende e rodar a bateria várias vezes
    seguidas depois de mudanças (TST-09).
24. **Toda melhoria visual precisa de medição de desempenho junto**: a tela nítida custou 3x mais em PC sem
    GPU (MOD-02) e só o teste de desempenho mostrou. Medir sempre contra a versão anterior, na mesma máquina.
25. **Medição em máquina compartilhada oscila muito** (o mesmo teste variou de 6 a 49 ms): usar o melhor de
    vários lotes (o ruído só atrasa, nunca adianta) e rodar o teste de desempenho sozinho, depois dos outros.
26. **Mudou o visual de propósito?** Atualizar as referências (`npm run test:e2e:update`) e **olhar** as
    imagens novas no diff antes de commitar (lição 12).
27. **Teste de mutação também precisa de controle negativo**: um placar ruim pode ser a ferramenta, não os
    testes (AUD-06). Injetar um bug à mão; se os testes pegam e o Stryker não, a configuração está errada.
28. **Teclas seguradas repetem**: toda ação de confirmação ("aperte 2 vezes") precisa ignorar `repeat` (AUD-05).
29. **Datas para pessoas, em horário local**: guardar em ISO/UTC, mas mostrar e nomear arquivos no fuso de
    quem lê (AUD-02).
