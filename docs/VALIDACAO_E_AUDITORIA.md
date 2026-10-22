# INVASÃO.EXE — Validação e Auditoria

Documento vivo. A cada rodada de validação, os bugs encontrados, as correções e as lições aprendidas são
registrados aqui. **Objetivo:** garantir que o jogo esteja 100% apto para o Observatório de Cursos.

---

## 1. Como validar

| O quê | Como |
|---|---|
| **Validação completa** (recomendado antes do evento) | Na pasta do jogo: `powershell -ExecutionPolicy Bypass -File tests\validar.ps1` |
| Só os testes automatizados, no navegador | Abrir `index.html?teste=1` (o resultado aparece na tela) |
| **Teste de mutação** (os testes pegam bugs de verdade?) | `powershell -ExecutionPolicy Bypass -File tests\mutacao.ps1` (ou `-Somente M15,M22`) |
| Validação rápida (sem robô e sem screenshots) | `tests\validar.ps1 -SemRobo -SemTelas` |

O `validar.ps1` executa 5 etapas:

1. **Verificação estática**: acentos "soltos" (caracteres invisíveis), caracteres corrompidos, arquivos e
   fontes referenciados que não existem, **nenhum endereço da internet**. Também abre o jogo com a **rede
   "pendurada"** e exige que ele apareça em menos de 10 s reais.
2. **Bateria de testes automatizados** (`tests/testes.js`): 49 testes de dados, nick, ranking, regras da
   batalha, chefões, itens, upgrades, renderização, layout no pior caso, fluxo real das telas com teclado
   simulado e **fuzz de 3000 teclas aleatórias**. O ranking real é salvo antes e restaurado depois. Em
   seguida mede o **desempenho em tempo real** (ms por quadro na cena mais pesada).
3. **Partidas completas do robô**: título → nick (30 caracteres) → andares → fim, em 4 velocidades de
   digitação. Serve para balanceamento e para garantir que nenhum fluxo trava.
4. **Screenshots** de todas as telas e de 3 resoluções (1366x768, 1280x1024, 1920x1080), para inspeção
   visual (salvas em `%TEMP%\invasao_validacao`).
5. **Resistência**: o robô joga sem parar por 40 min simulados, como o quiosque no evento.

Qualquer erro no console do navegador em qualquer etapa também reprova a validação.

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
3. **Testes headless**: `requestAnimationFrame` não avança em tempo virtual. Usar `?tick=1` com
   `--virtual-time-budget`.
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
19. **Teste de mutação** (`tests\mutacao.ps1`): injetar bugs conhecidos e exigir que a bateria reprove cada
    um. Mutante sobrevivente = ponto cego (achou SEG-01). Todo bug corrigido ganha um mutante no
    `tests\mutacoes.json`.
20. **Mutante só conta como morto se morreu pelo motivo certo**: ler a mensagem da falha (TST-06).
21. **Ferramenta de validação que roda zero casos tem que reprovar**, nunca dizer "ok" (TST-08).
22. **Conteúdo também tem bug**: simular um "jogador perfeito" prova que toda conquista é possível (BAL-02).
23. **Teste com dado sorteado é instável**: fixar o que a asserção depende e rodar a bateria várias vezes
    seguidas depois de mudanças (TST-09).
