// =====================================================================
//  INVASÃO.EXE — dados do jogo
//  Edite este arquivo para mudar textos, palavras, chefões e balanceamento.
// =====================================================================

const CONFIG = {
  evento: 'OBSERVATÓRIO DE CURSOS',
  curso: 'SISTEMAS DE INFORMAÇÃO',
  rankingTela: 10,          // quantos aparecem na tela de ranking
  voltarTituloSeg: 25,      // volta sozinho para o título após o fim de jogo
  ociosoSeg: 60,            // menu abandonado por esse tempo -> encerra a partida e volta ao título
  modoFixo: null,           // null = o jogador escolhe; 'normal' ou 'rapido' = sempre esse (painel do organizador)
  pinOrganizador: '2026',   // PIN do painel do organizador (Ctrl+Shift+O na tela título)
  bonusConquista: 300,      // pontos extras por conquista desbloqueada
};

// Modos de jogo: a "rota" é a lista de andares (índices de ANDARES) que o jogador percorre
const MODOS = {
  // fatorInimigos = quantos inimigos por andar; fatorVida = vida de inimigos e chefões
  normal: { nome: 'NORMAL', rota: [0, 1, 2, 3, 4, 5, 6, 7, 8], fatorInimigos: 1, fatorVida: 1,
    desc: '9 andares · todas as áreas do curso · ~10 min' },
  rapido: { nome: 'RÁPIDO', rota: [0, 3, 8], fatorInimigos: 0.6, fatorVida: 0.6,
    desc: '3 andares (Suporte, Banco de Dados e Diretoria) · ~3 min' },
};

// Conquistas: cada uma vale CONFIG.bonusConquista pontos
const CONQUISTAS = [
  { id: 'primeiro', nome: 'Primeiro Commit', icone: '>_', desc: 'Remova o primeiro inimigo.' },
  { id: 'combo10', nome: 'Em Ritmo', icone: 'x10', desc: 'Chegue a um combo x10.' },
  { id: 'combo20', nome: 'Multithread Humano', icone: 'x20', desc: 'Chegue a um combo x20.' },
  { id: 'chefe', nome: 'Suporte Nível 1', icone: '[!]', desc: 'Derrote um chefão.' },
  { id: 'limpo', nome: 'Código Limpo', icone: '{ }', desc: 'Conclua um andar sem errar nenhuma letra.' },
  { id: 'intocavel', nome: 'Firewall Humano', icone: '[#]', desc: 'Conclua um andar sem levar dano.' },
  { id: 'raiz', nome: 'Raiz', icone: '/.', desc: 'Derrote um chefão sem usar itens no andar.' },
  { id: 'porumfio', nome: 'Por um Fio', icone: '1hp', desc: 'Derrote um chefão com menos de 10% de integridade.' },
  { id: 'acentos', nome: 'Mestre dos Acentos', icone: 'áç', desc: 'Conclua um andar onde os acentos contam.' },
  { id: 'veloz', nome: 'Fibra Óptica', icone: '>>>', desc: 'Digite uma frase de chefão a 60 ppm ou mais.' },
  { id: 'investidor', nome: 'Investidor', icone: '$$$', desc: 'Acumule 200 ₿ de uma vez.' },
  { id: 'zerou', nome: 'Sistema Restaurado', icone: '9/9', desc: 'Vença o jogo.' },
];

// Atributos iniciais do jogador
const JOGADOR_BASE = {
  hp: 100,
  atk: 10,
  crit: 0.08,
  critMult: 2,
  bloqueio: 0,
  vidaPorAbate: 0,
  multCreditos: 1,
  velInimigos: 1,       // multiplicador da velocidade de ataque inimiga
  ganhoCombo: 1,
  perdoaErro: false,
  autocomplete: false,
  reviver: 0,
  danoChefe: 1,
  escudoInicial: 0,
  creditos: 0,
};

const COMBO_PASSO = 0.05;   // +5% de dano por combo
const COMBO_MAX = 20;       // até +100%
const CURA_ENTRE_ANDARES = 0.25;

// Tipos de inimigos comuns (sprite + nome do "arquivo")
const TIPOS_INIMIGO = {
  bug:    { arquivo: 'bug.exe',     sprite: 'bug' },
  virus:  { arquivo: 'virus.dll',   sprite: 'virus' },
  glitch: { arquivo: 'glitch.sys',  sprite: 'glitch' },
  email:  { arquivo: 'phish.msg',   sprite: 'email' },
  worm:   { arquivo: 'worm.bat',    sprite: 'worm' },
  pacote: { arquivo: 'pacote.tmp',  sprite: 'pacote' },
};

// acentos: 'nenhum'  -> palavras sem acento
//          'leniente'-> aceita a letra sem acento (mas sem bônus de perfeição)
//          'estrito' -> precisa digitar o acento certo
const ANDARES = [
  {
    nome: 'SUPORTE TÉCNICO',
    desc: 'Tudo começa no térreo: cabos soltos e computadores travados.',
    dica: 'Digite a palavra sobre o inimigo para atacar!',
    acentos: 'nenhum',
    inimigos: 5, maxTela: 1, hp: 10, atkBase: 4.5, porLetra: 0.4, dano: 6, recompensa: 6,
    tipos: ['bug', 'glitch'], cores: ['#7CFF4F', '#2E8B2E'],
    palavras: ['cabo', 'mouse', 'tela', 'rede', 'chip', 'porta', 'tecla', 'fonte', 'placa', 'disco',
      'erro', 'reset', 'boot', 'senha', 'login', 'driver', 'cooler', 'monitor', 'teclado', 'suporte',
      'chamado', 'ticket', 'plugue', 'ligar', 'travou', 'pane', 'pixel', 'cpu', 'bios', 'webcam'],
    chefe: {
      nome: 'A IMPRESSORA POSSUÍDA', arquivo: 'impressora.exe', sprite: 'impressora',
      hp: 80, intervalo: 10, dano: 8, recompensa: 40, truque: null,
      frases: ['papel atolado na bandeja', 'sem tinta preta outra vez', 'desliga e liga de novo',
        'imprimir em preto e branco', 'o cabo estava solto o tempo todo'],
      falas: { intro: 'PAPEL ATOLADO... PARA SEMPRE!', metade: 'SEM TINTA? NUNCA!', derrota: 'imprimindo... página... de... teste...' },
    },
    fato: 'Profissionais de Sistemas de Informação entendem de tudo: do hardware até a estratégia da empresa.',
  },
  {
    nome: 'SISTEMAS OPERACIONAIS',
    desc: 'Processos fora de controle tomaram conta dos computadores.',
    dica: 'Agora podem aparecer 2 inimigos. Digite a primeira letra para escolher o alvo.',
    acentos: 'nenhum',
    inimigos: 6, maxTela: 2, hp: 12, atkBase: 4.5, porLetra: 0.38, dano: 7, recompensa: 7,
    tipos: ['glitch', 'virus'], cores: ['#4FD8FF', '#1F6E99'],
    palavras: ['kernel', 'janela', 'pasta', 'arquivo', 'sistema', 'processo', 'linux', 'windows',
      'terminal', 'comando', 'desktop', 'atalho', 'lixeira', 'update', 'reiniciar', 'tarefa',
      'programa', 'instalar', 'backup', 'registro', 'cursor', 'formatar', 'shell', 'script',
      'thread', 'buffer', 'desligar', 'atualizar', 'firmware', 'pendrive'],
    chefe: {
      nome: 'TELA AZUL DA MORTE', arquivo: 'bsod.sys', sprite: 'bsod',
      hp: 110, intervalo: 10, dano: 9, recompensa: 50, truque: 'glitch',
      frases: ['seu computador encontrou um problema', 'coletando dados do erro', 'reinicie o computador agora',
        'salve seus arquivos sempre', 'atualize os drivers da placa'],
      falas: { intro: ':( SEU PC ENCONTROU UM PROBLEMA.', metade: 'COLETANDO DADOS... 50%', derrota: 'reiniciando... 100%' },
    },
    fato: 'O sistema operacional gerencia memória, processos e arquivos — é a base onde todo software roda.',
  },
  {
    nome: 'PROGRAMAÇÃO',
    desc: 'O código-fonte da empresa está cheio de bugs. Os acentos começam a aparecer!',
    dica: 'Acentos aparecem a partir daqui. Neste andar, digitar sem acento ainda vale.',
    acentos: 'leniente',
    inimigos: 6, maxTela: 2, hp: 16, atkBase: 4.2, porLetra: 0.36, dano: 8, recompensa: 8,
    tipos: ['bug', 'worm'], cores: ['#FFD23F', '#B8860B'],
    palavras: ['variável', 'função', 'código', 'laço', 'condição', 'compilar', 'algoritmo', 'python',
      'java', 'classe', 'objeto', 'método', 'lógica', 'vetor', 'string', 'depurar', 'sintaxe',
      'retorno', 'ponteiro', 'recursão', 'herança', 'exceção', 'parâmetro', 'biblioteca', 'commit',
      'repositório', 'programação', 'software'],
    chefe: {
      nome: 'O BUG DE PRODUÇÃO', arquivo: 'bug_rei.exe', sprite: 'bugrei',
      hp: 150, intervalo: 9.5, dano: 10, recompensa: 60, truque: 'invocar',
      frases: ['funciona na minha máquina', 'quem escreveu esse código', 'faltou um ponto e vírgula',
        'nunca faça deploy na sexta', 'todo programa começa com olá mundo'],
      falas: { intro: 'FUNCIONAVA ONTEM, EU JURO!', metade: 'CHAMANDO REFORÇOS...', derrota: 'bug... corrigido...' },
    },
    fato: 'Em SI você aprende lógica e programação em linguagens como Python, Java e JavaScript.',
  },
  {
    nome: 'BANCO DE DADOS',
    desc: 'Alguém está apagando as tabelas da empresa!',
    dica: 'Última chance: ainda dá para digitar sem acento neste andar.',
    acentos: 'leniente',
    inimigos: 7, maxTela: 2, hp: 20, atkBase: 4.2, porLetra: 0.34, dano: 9, recompensa: 9,
    tipos: ['pacote', 'glitch'], cores: ['#FF9F1C', '#A0522D'],
    palavras: ['tabela', 'coluna', 'registro', 'consulta', 'índice', 'relação', 'entidade', 'atributo',
      'select', 'insert', 'delete', 'join', 'modelagem', 'transação', 'integridade', 'esquema',
      'chave primária', 'normalização', 'cardinalidade', 'relatório', 'sql', 'informação', 'dados'],
    chefe: {
      nome: 'DROP TABLE', arquivo: 'droptable.sql', sprite: 'database',
      hp: 200, intervalo: 9.5, dano: 11, recompensa: 70, truque: 'acelerar',
      frases: ['select * from alunos', 'cuidado com o drop table', 'faça backup antes de apagar',
        'a chave primária é única', 'dados organizados viram informação'],
      falas: { intro: 'DROP TABLE EMPRESA; -- HAHAHA', metade: 'DELETE FROM VOCÊ!', derrota: 'rollback... concluído...' },
    },
    fato: 'Bancos de dados guardam as informações mais valiosas de uma empresa. Quem domina SQL é muito disputado no mercado!',
  },
  {
    nome: 'REDES',
    desc: 'Pacotes perdidos vagam pelos cabos. A partir de agora, os ACENTOS CONTAM!',
    dica: 'Use as teclas de acento: ´ + a = á   ~ + a = ã   ^ + e = ê   e a tecla ç',
    acentos: 'estrito',
    inimigos: 7, maxTela: 2, hp: 24, atkBase: 4, porLetra: 0.32, dano: 10, recompensa: 10,
    tipos: ['pacote', 'worm'], cores: ['#00E5FF', '#006D7A'],
    palavras: ['roteador', 'protocolo', 'conexão', 'endereço ip', 'pacote', 'servidor', 'cliente',
      'latência', 'dns', 'internet', 'switch', 'topologia', 'sinal', 'transmissão', 'fibra óptica',
      'largura de banda', 'requisição', 'navegador', 'domínio', 'ping alto', 'cabo de rede'],
    chefe: {
      nome: 'O WI-FI DA FACULDADE', arquivo: 'wifi.cfg', sprite: 'wifi',
      hp: 250, intervalo: 9, dano: 12, recompensa: 80, truque: 'glitch',
      frases: ['a conexão caiu de novo', 'sinal fraco no fundo da sala', 'esqueci a senha do wi-fi',
        'o roteador precisa de um reinício', 'a internet é uma rede de redes.'],
      falas: { intro: 'CONECTANDO... CONECTANDO... CON...', metade: 'SINAL: UMA BARRINHA', derrota: 'conectado. finalmente.' },
    },
    fato: 'Redes conectam tudo: do Wi-Fi da sua casa aos data centers espalhados pelo mundo inteiro.',
  },
  {
    nome: 'COMPUTAÇÃO EM NUVEM',
    desc: 'É Black Friday e os servidores estão pegando fogo!',
    dica: 'Até 3 inimigos ao mesmo tempo. Use itens com as teclas 1 a 4!',
    acentos: 'estrito',
    inimigos: 8, maxTela: 3, hp: 28, atkBase: 4.4, porLetra: 0.3, dano: 11, recompensa: 11,
    tipos: ['pacote', 'virus'], cores: ['#C77DFF', '#5A189A'],
    palavras: ['nuvem', 'contêiner', 'máquina virtual', 'escalabilidade', 'disponibilidade',
      'armazenamento', 'implantação', 'microsserviço', 'redundância', 'docker', 'data center',
      'balanceador', 'alta demanda', 'infraestrutura', 'virtualização', 'monitoramento', 'servidor'],
    chefe: {
      nome: 'BLACK FRIDAY', arquivo: 'servidor_principal.exe', sprite: 'servidor',
      hp: 320, intervalo: 9, dano: 13, recompensa: 90, truque: 'invocar',
      frases: ['o servidor não aguentou o tráfego', 'escale horizontalmente, agora!',
        'a nuvem é o computador de outra pessoa.', 'balanceie a carga entre servidores',
        'oferta relâmpago: noventa por cento off!'],
      falas: { intro: 'UM MILHÃO DE ACESSOS POR SEGUNDO!', metade: 'MAIS REQUISIÇÕES CHEGANDO!', derrota: 'tráfego... normalizado...' },
    },
    fato: 'A computação em nuvem permite que sistemas atendam milhões de pessoas ao mesmo tempo.',
  },
  {
    nome: 'SEGURANÇA DA INFORMAÇÃO',
    desc: 'Hackers invadiram o andar da segurança. Não confie em ninguém.',
    dica: 'Inimigos mais resistentes: mantenha o combo alto!',
    acentos: 'estrito',
    inimigos: 8, maxTela: 3, hp: 32, atkBase: 4.2, porLetra: 0.28, dano: 12, recompensa: 12,
    tipos: ['email', 'virus'], cores: ['#FF3355', '#8B0000'],
    palavras: ['criptografia', 'senha forte', 'autenticação', 'vírus', 'phishing', 'malware', 'firewall',
      'vulnerabilidade', 'ataque hacker', 'invasão', 'proteção de dados', 'permissão', 'antivírus',
      'golpe do pix', 'privacidade', 'lgpd', 'dois fatores', 'engenharia social', 'ameaça', 'espionagem'],
    chefe: {
      nome: 'RANSOMWARE', arquivo: 'ransom.exe', sprite: 'ransomware',
      hp: 400, intervalo: 8.5, dano: 15, recompensa: 100, truque: 'acelerar',
      frases: ['seus arquivos foram criptografados!', 'pague em bitcoins ou perca tudo.',
        'nunca clique em links suspeitos.', 'use autenticação de dois fatores.',
        'backup é a melhor vacina contra sequestro de dados.'],
      falas: { intro: 'SEUS ARQUIVOS AGORA SÃO MEUS.', metade: 'O RESGATE ACABA DE DOBRAR!', derrota: 'chave... de... descriptografia... entregue...' },
    },
    fato: 'Segurança da Informação é uma das áreas que mais contratam em TI — e a LGPD tornou isso ainda mais importante.',
  },
  {
    nome: 'DADOS & INTELIGÊNCIA ARTIFICIAL',
    desc: 'A IA da empresa decidiu que não precisa mais de humanos.',
    dica: 'Frases longas: respire e mantenha o ritmo.',
    acentos: 'estrito',
    inimigos: 8, maxTela: 3, hp: 38, atkBase: 4, porLetra: 0.26, dano: 13, recompensa: 13,
    tipos: ['glitch', 'pacote'], cores: ['#FF2BD6', '#7A0F66'],
    palavras: ['análise de dados', 'inteligência artificial', 'aprendizado de máquina', 'previsão',
      'gráfico', 'estatística', 'padrão', 'dashboard', 'métrica', 'indicador', 'modelo', 'treinamento',
      'neurônio', 'decisão', 'big data', 'mineração de dados', 'visualização', 'correlação',
      'rede neural', 'ciência de dados'],
    chefe: {
      nome: 'I.A. REBELDE', arquivo: 'ia_rebelde.py', sprite: 'robo',
      hp: 480, intervalo: 8.5, dano: 16, recompensa: 110, truque: 'invocar',
      frases: ['eu fui treinada com os seus dados.', 'correlação não é causalidade!',
        'a máquina aprende, mas quem decide é você.', 'dados de qualidade geram previsões confiáveis.',
        'humanos ainda são necessários? talvez...'],
      falas: { intro: 'CALCULEI 14 MILHÕES DE FUTUROS. VOCÊ PERDE EM TODOS.', metade: 'RECALCULANDO ROTA...', derrota: 'humano... superior... recalibrando...' },
    },
    fato: 'Ciência de dados e IA transformam números em decisões. Analista de dados é uma das profissões mais buscadas.',
  },
  {
    nome: 'DIRETORIA',
    desc: 'O último andar. O chefe final está esperando... e ele tem um prazo.',
    dica: 'Andar final! Use tudo o que você tem.',
    acentos: 'estrito',
    inimigos: 9, maxTela: 3, hp: 44, atkBase: 3.8, porLetra: 0.25, dano: 14, recompensa: 14,
    tipos: ['email', 'glitch'], cores: ['#FFD700', '#8B6914'],
    palavras: ['gestão de projetos', 'cronograma', 'requisito', 'reunião', 'orçamento', 'estratégia',
      'negócio', 'inovação', 'liderança', 'prazo final', 'entrega', 'cliente satisfeito', 'equipe ágil',
      'scrum', 'sprint', 'planejamento', 'empreendedorismo', 'transformação digital',
      'tomada de decisão', 'processos de negócio'],
    chefe: {
      nome: 'O PRAZO DE ENTREGA', arquivo: 'prazo_final.exe', sprite: 'prazo',
      hp: 600, intervalo: 8, dano: 18, recompensa: 0, truque: 'acelerar',
      frases: ['o prazo é para ontem!', 'o cliente mudou os requisitos de novo.',
        'reunião de alinhamento às nove da manhã.', 'sistemas de informação unem tecnologia e negócios.',
        'gestão, dados e tecnologia: o profissional do futuro é você!',
        'entregue o projeto antes que o tempo acabe!'],
      falas: { intro: 'TIC... TAC... O PROJETO VENCE HOJE.', metade: 'O CLIENTE PEDIU MAIS UMA FUNCIONALIDADE!', derrota: 'projeto... entregue... no... prazo...' },
    },
    fato: 'SI une tecnologia e gestão: você aprende a criar sistemas E a entender o negócio por trás deles.',
  },
];

// ---------------------------------------------------------------------
//  UPGRADES (cartas após cada chefão)
// ---------------------------------------------------------------------
const RARIDADES = {
  comum: { nome: 'COMUM', peso: 60, cor: '#39ff14' },
  raro:  { nome: 'RARO',  peso: 30, cor: '#00e5ff' },
  epico: { nome: 'ÉPICO', peso: 10, cor: '#ff2bd6' },
};

const UPGRADES = [
  { id: 'overclock', nome: 'Overclock', icone: '>>>', raridade: 'comum', max: 5,
    desc: '+25% de dano em todos os ataques.', aplicar: p => { p.atk *= 1.25; } },
  { id: 'firewall', nome: 'Firewall', icone: '[#]', raridade: 'comum', max: 5,
    desc: '+25 de integridade máxima e recupera 25.', aplicar: p => { p.maxHp += 25; p.hp += 25; } },
  { id: 'ssd', nome: 'SSD NVMe', icone: '|=|', raridade: 'comum', max: 4,
    desc: 'Inimigos atacam 12% mais devagar.', aplicar: p => { p.velInimigos *= 0.88; } },
  { id: 'mineracao', nome: 'Mineração', icone: '$$$', raridade: 'comum', max: 3,
    desc: '+50% de créditos ganhos.', aplicar: p => { p.multCreditos += 0.5; } },
  { id: 'cache', nome: 'Cache', icone: '{ }', raridade: 'comum', max: 3,
    desc: 'Começa cada andar com +1 escudo.', aplicar: p => { p.escudoInicial += 1; } },
  { id: 'exploit', nome: 'Exploit', icone: '/!\\', raridade: 'raro', max: 4,
    desc: '+10% de chance de acerto crítico.', aplicar: p => { p.crit += 0.10; } },
  { id: 'criptografia', nome: 'Criptografia', icone: '***', raridade: 'raro', max: 3,
    desc: '15% de chance de bloquear um ataque.', aplicar: p => { p.bloqueio += 0.15; } },
  { id: 'garbage', nome: 'Garbage Collector', icone: '(x)', raridade: 'raro', max: 3,
    desc: 'Recupera 4 de integridade a cada inimigo removido.', aplicar: p => { p.vidaPorAbate += 4; } },
  { id: 'multithread', nome: 'Multithread', icone: '|||', raridade: 'raro', max: 1,
    desc: 'O combo cresce 2x mais rápido.', aplicar: p => { p.ganhoCombo = 2; } },
  { id: 'corretor', nome: 'Corretor Ortográfico', icone: 'abc', raridade: 'raro', max: 1,
    desc: 'O primeiro erro de cada palavra não zera o combo.', aplicar: p => { p.perdoaErro = true; } },
  { id: 'vpn', nome: 'VPN', icone: '<->', raridade: 'raro', max: 1,
    desc: 'Chefões causam 30% menos dano.', aplicar: p => { p.danoChefe = 0.7; } },
  { id: 'autocomplete', nome: 'Autocomplete', icone: 'a__', raridade: 'epico', max: 1,
    desc: 'A primeira letra de cada palavra já vem digitada.', aplicar: p => { p.autocomplete = true; } },
  { id: 'backup', nome: 'Backup na Nuvem', icone: '^^^', raridade: 'epico', max: 1,
    desc: 'Ao ser derrotado, revive uma vez com 50% de integridade.', aplicar: p => { p.reviver += 1; } },
  { id: 'zeroday', nome: 'Zero-Day', icone: '0x0', raridade: 'epico', max: 1,
    desc: 'Críticos causam 3x de dano (em vez de 2x).', aplicar: p => { p.critMult = 3; } },
];

// ---------------------------------------------------------------------
//  ITENS (loja) — usados com as teclas 1 a 4 durante a batalha
// ---------------------------------------------------------------------
const ITENS = [
  { id: 'cafe', nome: 'Café', icone: 'c[_]', preco: 30,
    desc: 'Inimigos ficam 60% mais lentos por 8 segundos.' },
  { id: 'patch', nome: 'Patch de Correção', icone: '+', preco: 25,
    desc: 'Recupera 35 de integridade.' },
  { id: 'antivirus', nome: 'Antivírus', icone: '(!)', preco: 50,
    desc: 'Causa 40 de dano em TODOS os inimigos.' },
  { id: 'escudo', nome: 'Firewall Portátil', icone: '[#]', preco: 40,
    desc: 'Bloqueia os próximos 2 ataques.' },
];
const ITEM_MAX = 3;
