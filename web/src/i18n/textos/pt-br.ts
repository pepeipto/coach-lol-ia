// Textos do site em português do Brasil. Mesma estrutura de es.ts (um teste confere as chaves).
import { MIN_PARTIDAS_BUILD, PARTIDAS_DATOS_LIMITADOS } from '../../lib/cifras.ts';
import type { Textos } from './es.ts';

const CORREO = 'support@coachlolia.com';

export const ptBr: Textos = {
  meta: {
    lema: 'Seu coach de League of Legends, em tempo real e no seu idioma.',
    paginas: {
      inicio: {
        titulo: 'Coach LoL IA: coach de LoL com IA, builds e overlay grátis',
        descripcion:
          'Seu coach de League of Legends com IA: analisa suas partidas, te avisa por voz e dá builds Esmeralda+ e runas em um clique. Grátis e com APIs oficiais da Riot.',
      },
      descargar: {
        titulo: 'Baixar o Coach LoL IA grátis para Windows 10 e 11',
        descripcion:
          'Baixe grátis o Coach LoL IA para Windows 10 e 11: builds de LoL, importação de runas e overlay com voz. Instalador oficial com atualizações automáticas.',
      },
      apoyar: {
        titulo: 'Apoie o Coach LoL IA, o app de LoL grátis para todos',
        descripcion:
          'O Coach LoL IA é grátis e não tem anúncios dentro do app. Veja como o projeto se mantém e como você pode apoiá-lo com uma doação voluntária.',
      },
      novedades: {
        titulo: 'Novidades do Coach LoL IA: versões e mudanças do app',
        descripcion:
          'Todas as versões do Coach LoL IA, da mais recente à mais antiga: overlay por widgets, tela de carregamento, tier list, ARAM, Arena e muito mais.',
      },
      tft: {
        titulo: "Tier list de TFT no app: composições e itens | Coach LoL IA",
        descripcion:
          "A aba TFT do Coach LoL IA: composições do patch por tier e os melhores itens de cada unidade, com partidas de Mestre para cima. Grátis e para consultar antes de jogar.",
      },
      builds: {
        titulo: 'Builds de LoL e tier list com dados Esmeralda+ | Coach LoL IA',
        descripcion:
          'Como o Coach LoL IA calcula as builds de League of Legends e a tier list: partidas Esmeralda+ de EUW, LAN e LAS, recalculadas a cada 6 horas.',
      },
      guias: {
        titulo: 'Guias de LoL: overlay seguro, tier list e runas | Coach LoL IA',
        descripcion:
          'Guias práticos de League of Legends: como usar um overlay dentro das regras da Riot, como ler uma tier list e como importar runas automaticamente.',
      },
      guiaOverlay: {
        titulo: 'Como usar um overlay no LoL com segurança | Coach LoL IA',
        descripcion:
          'O que a Riot permite a um overlay de League of Legends, quais sinais mostram que um app passou do limite e como configurá-lo no modo Sem bordas.',
      },
      guiaTierList: {
        titulo: 'O que é uma tier list de LoL e como ler | Coach LoL IA',
        descripcion:
          'O que significa estar no tier S, A, B ou C no League of Legends, como a tier list é calculada com taxa de vitória e de escolha e por que a amostra importa.',
      },
      guiaCoach: {
        titulo: 'Coach de LoL com IA: como usar para melhorar | Coach LoL IA',
        descripcion:
          'O que faz um coach de League of Legends com IA, o que ele pode fazer na partida sem quebrar as regras da Riot e como usar suas análises para melhorar de verdade.',
      },
      guiaRunas: {
        titulo: 'Como importar runas automaticamente no LoL | Coach LoL IA',
        descripcion:
          'Passo a passo para importar runas, feitiços e itens no League of Legends com um clique na seleção de campeões, sem apagar suas páginas de runas.',
      },
      privacidad: {
        titulo: 'Política de privacidade · Coach LoL IA',
        descripcion: 'Quais dados o Coach LoL IA trata, para quê, com qual base legal e quais são os seus direitos sobre eles.',
      },
      terminos: {
        titulo: 'Termos de uso · Coach LoL IA',
        descripcion: 'Termos de uso do Coach LoL IA, um app gratuito para League of Legends que usa somente as APIs oficiais da Riot.',
      },
      cookies: {
        titulo: 'Política de cookies do site · Coach LoL IA',
        descripcion: 'Quais cookies o site do Coach LoL IA usa, quando os anúncios são carregados e como mudar sua escolha a qualquer momento.',
      },
      noEncontrada: {
        titulo: 'Página não encontrada · Coach LoL IA',
        descripcion: 'A página que você procura não existe ou mudou de endereço.',
      },
    },
    ogAlt: 'Coach LoL IA: builds, tier list e coach na partida para League of Legends, de graça.',
  },

  comun: {
    saltar: 'Pular para o conteúdo',
    menuAbrir: 'Abrir o menu',
    menuCerrar: 'Fechar o menu',
    inicioAria: 'Coach LoL IA, início',
    navAria: 'Principal',
    idioma: 'Idioma',
    idiomaAria: 'Mudar de idioma',
    nav: {
      queHace: 'O que faz',
      enAccion: 'Em ação',
      builds: 'Builds e tier list',
      tft: "TFT",
      guias: 'Guias',
      faq: 'FAQ',
      novedades: 'Novidades',
    },
    descargar: 'Baixar',
    apoyar: 'Apoiar',
    descargarWindows: 'Baixar para Windows',
    apoyaProyecto: 'Apoie o projeto',
    capturaReal: 'Captura real',
    publicidad: 'Publicidade',
    migas: 'Trilha de navegação',
    inicio: 'Início',
    ayudaTitulo: 'Precisa de ajuda?',
    ayudaTexto: 'Escreva para nós e responderemos o quanto antes.',
    discord: 'Entre na comunidade do Discord',
    soporteAria: 'Suporte',
    leerGuia: 'Ler o guia',
    actualizado: 'Atualizado em',
  },

  pie: {
    siguenos: 'Siga a gente',
    redAria: 'Coach LoL IA no {red}',
    hechoIA: 'Feito com ajuda de IA.',
    descripcion: 'Coach em tempo real para League of Legends, em 5 idiomas. Versão',
    soporte: 'Suporte',
    producto: 'Produto',
    proyecto: 'Projeto',
    legal: 'Legal',
    recursos: 'Recursos',
    idiomas: 'Idiomas',
    enlaces: {
      descargar: 'Baixar',
      novedades: 'Novidades',
      apoyar: 'Apoie o projeto',
      hojaDeRuta: 'Roadmap',
      arquitectura: 'Arquitetura',
      seguridad: 'Segurança e Vanguard',
      calidad: 'Qualidade',
      github: 'Código no GitHub',
      discord: 'Comunidade no Discord',
      builds: 'Builds e tier list',
      tft: "TFT",
      guias: 'Guias',
      privacidad: 'Privacidade',
      terminos: 'Termos',
      cookies: 'Cookies',
    },
    avisoRiot:
      "O Coach LoL IA não é endossado pela Riot Games e não reflete os pontos de vista nem as opiniões da Riot Games ou de qualquer pessoa oficialmente envolvida na produção ou gestão das propriedades da Riot Games. A Riot Games e todas as propriedades associadas são marcas comerciais ou marcas registradas da Riot Games, Inc.",
    marca:
      'League of Legends é uma marca registrada da Riot Games, Inc. Imagens de League of Legends © Riot Games, Inc.',
  },

  cookies: {
    region: 'Consentimento de cookies',
    titulo: 'Cookies e publicidade',
    texto:
      'Este site exibe anúncios do Google AdSense, que usam cookies de terceiros. Eles só são carregados se você aceitar. Você pode mudar de ideia a qualquer momento na página de',
    enlace: 'cookies',
    rechazar: 'Recusar',
    aceptar: 'Aceitar',
  },

  asistente: {
    boton: 'Assistente IA',
    titulo: 'Assistente IA do Coach LoL IA',
    cerrar: 'Fechar o assistente',
    intro: 'Pergunte como instalar o app, importar builds ou usar o overlay.',
    conversacion: 'Conversa',
    pregunta: 'Sua pergunta',
    placeholder: 'Escreva sua pergunta…',
    enviar: 'Enviar',
    nota: `Respostas geradas por IA; podem conter erros. Se tiver algum problema, escreva para ${CORREO}.`,
    escribiendo: 'Digitando…',
    tu: 'Você: ',
    asistente: 'Assistente: ',
    errores: {
      noDisponible: `O assistente ainda não está disponível. Enquanto isso, escreva para ${CORREO}.`,
      limite: 'Você fez muitas perguntas seguidas. Espere um pouco e tente de novo.',
      fallo: 'O assistente não conseguiu responder agora. Tente de novo em alguns minutos.',
      noValido: 'Não foi possível enviar sua mensagem. Escreva uma pergunta de até 1000 caracteres.',
      sinConexion: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.',
    },
  },

  diagrama: {
    aria: 'Diagrama de arquitetura (role na horizontal em telas estreitas)',
    titulo: 'Arquitetura do Coach LoL IA',
    desc: 'No PC do jogador, o app (Electron) se conecta ao cliente de League of Legends pela LCU API e à partida pela Live Client Data API em 127.0.0.1:2999. Na nuvem, o servidor de builds (Fastify e SQLite) coleta partidas da API da Riot, agrega a cada 6 horas e envia as builds ao app por HTTPS. O app baixa nomes e ícones do Data Dragon. O site (Astro, GitHub Pages) e a tela Ajuda do app consultam o assistente IA do servidor, que gera as respostas com a Anthropic. O app usa somente as APIs oficiais da Riot e não mexe no processo do jogo.',
    pc: 'PC DO JOGADOR · WINDOWS 10/11',
    nube: 'NUVEM',
    cliente: 'Cliente de LoL',
    clienteSub: 'lobby e seleção',
    partida: 'Partida em andamento',
    partidaSub: 'o jogo (sem mexer nele)',
    vanguard1: 'não lê memória nem injeta;',
    vanguard2: 'sem capturas nem teclas',
    procesoPrincipal: 'PROCESSO PRINCIPAL (Node.js)',
    conectorLcu: 'Conector LCU',
    conectorPartida: 'Conector da partida · a cada 1 s',
    motor: 'Motor de dicas (regras)',
    clienteBuilds: 'Cliente de builds + cache',
    asistenteSoporte: 'Assistente de suporte',
    datosEstaticos: 'Dados estáticos',
    ventana: 'Janela principal (React)',
    ventanaSub: 'build, importar, ajustes',
    overlay: 'Overlay (React)',
    overlaySub: 'transparente, cliques passam, voz',
    servidor: 'Servidor · Fastify + SQLite',
    recolector: 'Coletor',
    recolectorSub: 'Solo/Duo, Esmeralda+, EUW · LAN · LAS',
    agregador: 'Agregador · a cada 6 h',
    agregadorSub: `≥ 200 partidas por patch · mínimo ${MIN_PARTIDAS_BUILD}`,
    api: 'API pública',
    asistenteIa: 'Assistente IA',
    asistenteIaSub: 'POST /api/asistente · com limite de uso',
    apiRiot: 'API da Riot',
    modeloIa: 'modelo do assistente IA',
    dataDragonSub: 'nomes e ícones',
    estaWeb: 'Este site',
    claves1: 'RIOT_API_KEY e ANTHROPIC_API_KEY só existem como',
    claves2: 'variáveis de ambiente do servidor.',
    ayuda: 'ajuda',
    parche: 'patch',
    partidas: 'partidas',
    pie: 'Diagrama de arquitetura. As setas azuis são os dados de jogo e de builds; as douradas, as perguntas ao assistente IA.',
    respuestas: 'respostas',
  },

  inicio: {
    etiquetaVersion: 'Nova versão',
    hero: {
      desc: 'As builds mais populares entre jogadores Esmeralda+, com suas estatísticas, na seleção de campeões, importadas para o cliente em um clique, uma tela de carregamento com os dois times e um coach que te avisa durante a partida com um overlay por widgets e voz. Só com as APIs oficiais da Riot.',
      meta: 'Grátis · Windows 10/11 · Só APIs oficiais da Riot · Código no',
      capturaAlt:
        'Captura do Coach LoL IA na tela Campeão: Ahri na rota do Meio com sua taxa de vitória, 33 partidas e dados do patch 16.20, e o botão Importar; runas de Dominação e Feitiçaria, Flash e Incendiar, itens iniciais, núcleo e botas, e a tabela da ordem de habilidades com prioridade Q, W, E.',
      capturaPie: 'Tela Campeão com dados reais do servidor de builds.',
    },
    cifras: [
      ['Regiões', 'EUW · LAN · LAS'],
      ['Partidas analisadas', 'Esmeralda+'],
      ['Atualização das builds', 'a cada 6 h'],
    ],
    cifraPruebas: 'Testes automatizados',

    enAccion: {
      antetitulo: 'Em ação',
      titulo: 'Veja em ação',
      intro:
        'Clipes reais: uma partida de Zed na jungle com o overlay aberto e um tour pelo app. Os vídeos não têm som e só carregam quando você chega até eles.',
      videos: {
        partida: {
          titulo: 'O coach em uma partida real',
          texto:
            'Contagem regressiva dos objetivos, seu CS e KDA ao vivo e a seta que mostra qual habilidade upar. Gravação de uma partida real de Zed na jungle.',
          etiqueta:
            'Vídeo de uma partida real de League of Legends com Zed na jungle: o overlay do Coach LoL IA mostra no topo a contagem dos objetivos, o Dragão em 0:38, o widget de CS e KDA ficando verde e a seta dourada ao subir de nível.',
        },
        tour: {
          titulo: 'Tour pelo Coach LoL IA 3.0',
          texto:
            'Tela de carregamento (com jogadores de exemplo), build Esmeralda+, importação em um clique, avisos, timers da selva, tier list e os modos ARAM e Arena.',
          etiqueta:
            'Vídeo de apresentação do Coach LoL IA 3.0: tela de carregamento com dados de exemplo, build de Ahri no Meio, botão Importar, overlay com objetivos, aviso de compra, CS e KDA, timers sobre um minimapa esquemático e tier list por rota e modo.',
        },
      },
      textosVideo: 'Os textos do vídeo estão em espanhol; as legendas em português aparecem por padrão.',
      reproducir: 'Reproduzir',
      fotos: [
        {
          nombre: 'partida-objetivos',
          alt: 'Captura de uma partida real de League of Legends com Zed na jungle aos 4:22: no topo, a barra de objetivos do Coach LoL IA com o Dragão em 0:38 e, à direita, o widget de CS (20, a 4,6 por minuto) e KDA 0/0/1.',
          pie: 'Barra de objetivos e CS em uma partida real (minuto 4).',
        },
        {
          nombre: 'partida-dragon',
          alt: 'Captura de uma partida real de League of Legends: Zed logo após o aviso de inimigo abatido, com a barra de objetivos do Coach LoL IA no topo (Dragão em 0:20) e o widget de CS, já verde a 6,4 por minuto, no canto superior direito.',
          pie: 'O widget de CS fica verde quando você passa da sua meta.',
        },
      ],
    },

    queHace: {
      antetitulo: 'O que faz',
      titulo: 'Tudo o que você precisa, da seleção à vitória',
      intro:
        'O Coach LoL IA te acompanha nos dois momentos que mais importam: a seleção de campeões, onde mostra as opções mais populares com suas estatísticas para você escolher, e a partida, onde te lembra do que importa sem você precisar sair do jogo.',
      funciones: [
        {
          icono: 'capas',
          titulo: 'Builds por campeão e rota',
          texto:
            'Até 3 opções de itens e 3 páginas de runas entre as mais jogadas, cada uma com sua taxa de escolha e de vitória: quem escolhe é você. Runas, feitiços, itens iniciais, núcleo de 3 itens, botas, itens situacionais e ordem de habilidades, com a taxa de vitória e o número de partidas que sustentam cada uma. São publicadas a partir de 10 partidas; as com poucas partidas levam o selo «Dados limitados».',
        },
        {
          icono: 'grafico',
          titulo: 'Campeões e tier list',
          texto:
            'A seção Campeões ordena todos os campeões por rota nos tiers S, A, B e C de acordo com a taxa de vitória e de escolha, com busca e a build completa de cada um.',
        },
        {
          icono: 'usuario',
          titulo: 'Tela de carregamento',
          texto:
            'Enquanto a partida carrega, o overlay mostra os dez jogadores em tela cheia, com o seu card em destaque: elo oficial, maestria e taxa de vitória do campeão na rota, só com etiquetas positivas ou neutras. Espaço esconde a tela.',
        },
        {
          icono: 'descarga',
          titulo: 'Importação em um clique',
          texto:
            'Cria a página de runas «Coach: <Campeão> <Rota>», escolhe os feitiços e adiciona um conjunto de itens à loja. Só mexe nas páginas com o prefixo «Coach:»; se você não tiver nenhuma livre, substitui uma das suas apenas se você clicar em «Importar» e confirmar.',
        },
        {
          icono: 'brujula',
          titulo: 'Rota automática',
          texto:
            'Usa a rota que o cliente te atribui. Se não houver nenhuma, usa a mais jogada com aquele campeão, e você pode trocar no seletor de rota.',
        },
        {
          icono: 'monitor',
          titulo: 'Overlay por widgets',
          texto:
            'Barra de objetivos no topo (com o tipo do próximo Dragão), uma seta sobre a habilidade a upar, seu CS e KDA, o aviso de compra e os avisos. Cada widget pode ser movido, redimensionado e desligado separadamente.',
        },
        {
          icono: 'voz',
          titulo: 'Muito mais voz',
          texto:
            'Voz natural neural e offline nos 5 idiomas, com 460 frases por idioma e suas variações: objetivos, compras, farm, visão, lutas, fases da partida e selva, uma por vez e a mais urgente primeiro. Você escolhe o nível de detalhe e quais categorias ouvir.',
        },
        {
          icono: 'reloj',
          titulo: 'Timers da selva',
          texto:
            'Opcionais e desligados por padrão: você marca quando limpa um acampamento do seu lado ou um Caranguejo e o app conta o tempo de respawn, inclusive em cima do minimapa.',
        },
        {
          icono: 'diana',
          titulo: 'ARAM, ARAM: Caos e Arena',
          texto:
            'Cada modo com suas builds e sua tier list (com os aumentos mais escolhidos no ARAM: Caos e na Arena), e um overlay que em cada modo mostra só o que faz sentido.',
        },
        {
          icono: 'nube',
          titulo: 'Funciona offline',
          texto:
            'Guarda em cache as últimas builds. Se o servidor não responder, o app usa a cópia salva e avisa: «Dados offline (patch X)».',
        },
        {
          icono: 'refrescar',
          titulo: 'Atualiza sozinho',
          texto:
            'Ao abrir, o app baixa a última versão do GitHub Releases, instala e abre de novo; nunca no meio de uma partida, ele espera terminar. O Data Dragon e as builds acompanham o patch atual.',
        },
        {
          icono: 'idioma',
          titulo: 'Em 5 idiomas',
          texto:
            'O app, o overlay, a voz e o assistente em espanhol, inglês, português (Brasil), francês e alemão. Escolha o idioma em Ajustes; por padrão, o do seu Windows. Este site também, nos cinco.',
        },
      ],
      vitrina: {
        titulo: 'Você decide o que o coach te diz',
        texto:
          'Na tela Overlay você vê uma prévia dos widgets, escolhe quais quer, o tamanho e onde ficam, e decide o que a voz te diz: o nível de detalhe (Básico, Normal ou Completo) e cada categoria separadamente.',
        lista: [
          'Prévia dos widgets exatamente como vão aparecer na partida',
          '«Mover e calibrar» para colocar cada widget onde não atrapalhe',
          'Opacidade geral, mais tamanho e um botão liga/desliga para cada widget',
          'Voz natural ou do Windows, volume, nível de detalhe e categorias, com «Testar voz»',
        ],
        alt: 'Captura da tela Overlay do Coach LoL IA: prévia com a barra de objetivos, o CS, o aviso «Nível 6: upe o R», a seta sobre o R e o aviso de compra; à direita, o botão «Mover e calibrar», a opacidade e os botões e tamanhos dos widgets Objetivos, Seta de habilidade e Desempenho (CS e KDA).',
        pie: 'Tela Overlay: widgets, posição, tamanho e voz.',
      },
    },

    novedades3: {
      antetitulo: 'Novidades da 3.0',
      titulo: 'Antes, durante e entre as partidas',
      intro:
        'A 3.0 traz a tela de carregamento, a seção Campeões com tier list, os modos ARAM, ARAM: Caos e Arena e os timers da selva. A 3.0.1 e a 3.0.2 adicionam runas selecionáveis, o tema «Sombra» e um overlay que se adapta a telas 2K e 4K. Tudo com dados que o jogo ou a API oficial da Riot já oferecem. [Ver todas as novidades](@novedades).',
      carga: {
        titulo: 'Tela de carregamento',
        texto:
          'Enquanto a partida carrega, o overlay organiza os dez jogadores como o jogo: os inimigos em cima e o seu time embaixo. De cada um você vê o elo oficial de Solo/Duo, a maestria com o campeão e a taxa de vitória daquele campeão na rota.',
        lista: [
          'Só etiquetas positivas ou neutras: «Especialista em…», «Escala para o late game»',
          'Sem MMR inventado nem rótulos negativos para ninguém',
          'Some sozinha assim que a partida começa',
        ],
        alt: 'Captura da tela de carregamento no overlay do Coach LoL IA: dez cartões de jogadores com nomes de exemplo, cinco inimigos em cima e cinco aliados embaixo, cada um com o campeão, a rota, o elo (de Ouro a Diamante, ou Sem ranque), vitórias e derrotas, maestria, taxa de vitória do campeão e etiquetas como «Especialista em Darius», «Sequência positiva nesta temporada» ou «Protege o time».',
        pie: 'Tela de carregamento com jogadores de exemplo.',
      },
      campeones: {
        titulo: 'Campeões e tier list',
        texto:
          'Todos os campeões por rota, com o tier (S, A, B ou C) segundo a taxa de vitória e de escolha, o número de partidas e a build completa em um clique. Um seletor alterna entre Ranqueada, ARAM, ARAM: Caos e Arena.',
        lista: [
          'Busca, filtro por rota e ordenação por tier, vitórias, escolhas ou partidas',
          'Aviso «Dados limitados» nos que têm menos de 30 partidas',
          'Na Arena, colocação média e taxa de top 4',
        ],
        alt: 'Captura da seção Campeões do Coach LoL IA: tier list da Ranqueada com dados do patch 16.20, o seletor de modo (Ranqueada, ARAM, ARAM: Caos, Arena), a busca, os filtros por rota e uma tabela com campeão, rota, tier, vitórias, escolhas e partidas; no topo, Yunara e Viego no tier S e, mais abaixo, campeões no tier B com o aviso de dados limitados.',
        pie: 'Seção Campeões: tier list por modo e rota.',
        enlace: 'Como as builds e a tier list são calculadas',
      },
      jungla: {
        titulo: 'Timers da selva, do seu jeito',
        texto:
          'Opcionais e desligados por padrão. Quando você limpa um acampamento do seu lado ou um Caranguejo, marca com um clique ou com a sua tecla, e o app conta o respawn em cima do minimapa, como os timers do próprio jogo. Alt+Shift+L mostra ou esconde.',
        lista: [
          'Só a sua selva e os dois Caranguejos: nunca os acampamentos do inimigo',
          'Dourado nos últimos 30 segundos e uma marca quando o acampamento já nasceu',
          '«Gromp em 30 segundos» por voz, se você quiser',
        ],
        alt: 'Detalhe dos timers da selva do Coach LoL IA sobre um minimapa esquemático do lado azul: contagens de 15 s e 1:40 em dois acampamentos, 1:08 e 1:13 em outros dois, e uma marca de confirmação nos que já nasceram.',
        pie: 'Timers sobre o minimapa (esquema do mapa).',
      },
    },

    novedadesEstrategia: {
      antetitulo: 'Novidades da 3.12 e da 3.13',
      titulo: 'Um coach que também fala de estratégia',
      intro:
        'A voz do coach não diz mais só o que comprar: ela avisa quando empurrar, quando voltar para a base e qual objetivo preparar. O overlay ganha quatro estilos e o coach com IA tem planos para quem quiser mais. [Ver todas as novidades](@novedades).',
      voz: {
        titulo: 'Coach de estratégia por voz',
        texto: 'Uma voz natural diz o que fazer em cada momento, e o que ela diz aparece também como legenda «Seu coach» no overlay.',
        lista: [
          'Rival de rota morto: empurre a wave ou volte para a base',
          'Um minuto e meio antes de cada objetivo: prepare-o conforme a sua função',
          'Wave de canhão, corrida ao nível 2 e primeiro gank',
          'O que fazer depois do Barão, do Ancião ou de um ace',
        ],
      },
      legendario: {
        titulo: 'Aviso quando o seu rival completa um lendário',
        texto:
          'Quando o seu rival de rota termina qualquer item lendário, o coach avisa na hora para você tomar cuidado nas trocas. Com os itens que mudam uma luta (estase, reviver, feridas graves…) ele explica também o que significam.',
      },
      estilos: {
        titulo: 'Quatro estilos de overlay',
        texto:
          'Escolha o seu favorito na tela Overlay: Filo (o próprio do Coach LoL IA), Hextech, Neon ou Cristal. Muda a forma, as bordas e as cores de todos os widgets.',
        nombres: { hextech: 'Hextech', neon: 'Neon', cristal: 'Cristal' },
        alt: 'Captura do overlay do Coach LoL IA na partida com o estilo {estilo}: a barra de objetivos, o CS, o widget «Próximo item» e os avisos, com as bordas e cores desse estilo.',
        pie: 'Estilo {estilo}.',
      },
      planes: {
        titulo: 'Planos do coach com IA',
        texto:
          'Tudo o que te ajuda durante a partida continua grátis. A análise com IA no fim da partida e as perguntas ao seu coach têm uma cota grátis (3 análises e 5 perguntas por mês) e planos para quem quiser mais.',
        enlace: 'Ver os planos',
      },
      ia: 'Feito com ajuda de IA.',
    },

    comoFunciona: {
      antetitulo: 'Como funciona',
      titulo: 'Da seleção de campeões à partida',
      intro: 'Sem configuração: abra o app antes ou depois do cliente e ele cuida do resto.',
      pasos: [
        {
          titulo: 'Abra o app e o cliente de LoL',
          texto:
            'O Coach LoL IA encontra o cliente lendo o arquivo lockfile (porta e senha locais). Enquanto não encontra, mostra «Aguardando o cliente de League of Legends…» e tenta de novo a cada 3 segundos.',
          detalle: 'LCU API · WebSocket',
        },
        {
          titulo: 'Escolha o campeão',
          texto:
            'O cliente avisa por WebSocket o campeão e a rota. O app pede a build ao servidor e mostra em menos de 2 segundos. Com «Importar» (ou com a importação automática) ele aplica runas, feitiços e itens.',
          detalle: 'Seleção de campeões',
        },
        {
          titulo: 'Jogue com o coach',
          texto:
            'Enquanto carrega, o overlay mostra a tela de carregamento com os dois times. Já na partida, o app consulta a Live Client Data API em https://127.0.0.1:2999 a cada segundo. O motor de dicas compara seu estado com a build e mostra os objetivos, a habilidade a upar, seu CS e KDA, a próxima compra e os avisos. Ctrl+Shift+O esconde ou mostra o overlay.',
          detalle: 'Live Client Data API',
        },
        {
          titulo: 'Fim da partida',
          texto:
            'Quando a partida termina, o overlay some e o app para de consultar a porta 2999. A próxima seleção de campeões recomeça o ciclo.',
          detalle: 'Sem processos residuais',
        },
      ],
      overlay: {
        alt: 'Captura do overlay do Coach LoL IA na partida com o estilo Filo sobre a arte de um campeão: a barra de objetivos no topo, o CS, o widget «Próximo item» com seus componentes e dois avisos, um dizendo que Zed terminou um item lendário e está mais forte e outro com a habilidade que deve subir.',
        pie: 'Overlay com o estilo Filo e o aviso do lendário do rival.',
        titulo: 'O que o coach te diz na partida',
        avisos: [
          ['Estratégia', '«Zed está morto: empurre a wave e volte para a base»'],
          ['Rival de rota', '«Zed terminou um lendário: agora está mais forte, cuidado nas trocas»'],
          ['Compra', '«Você pode comprar o Furacão de Runaan»'],
          ['Habilidades', '«Nível 6: upe o R»'],
          ['Objetivos', 'A 1 minuto, a 30 segundos e ao nascer, com o tipo de Dragão'],
          ['CS', '«Você está abaixo da meta de farm» (aos 5, 10, 15 e 20 minutos)'],
          ['Visão', '«Compre uma Sentinela de Controle»'],
          ['Selva', '«Gromp em 30 segundos» (só se você usar os timers)'],
          ['Caçador inimigo', '«O caçador inimigo acabou de aparecer no bot (abate)»'],
          ['Fase da partida', '«Mid game: agrupe com o time para os objetivos»'],
        ],
        nota: 'Cada widget fica no seu lugar: os objetivos no topo, a seta sobre a barra de habilidades e o resto onde você quiser. A voz diz uma frase por vez, a mais urgente primeiro, e o mesmo aviso não se repete até que a situação mude. O CS é comparado com uma referência da sua rota, sem cores vermelhas nem mensagens negativas.',
      },
      junglaEnemiga: {
        titulo: 'O caçador inimigo, só com o que o jogo já mostra',
        nota1:
          'Quando o caçador inimigo participa de um abate, o feed de abates do jogo mostra e o app te avisa: «O caçador inimigo acabou de aparecer no bot (abate)». Não é rastreamento: o app não sabe a posição nem os tempos de recarga dele, e o aviso sempre fala daquele abate.',
        nota2:
          'Se quiser, você pode ativar uma estimativa da rota habitual dele (desligada por padrão): por qual lado esse campeão costuma começar e qual rota costuma visitar primeiro, segundo as nossas partidas. É o que ele costuma fazer, não o que está fazendo na sua partida.',
        alt: 'Captura do overlay do Coach LoL IA com o aviso «O caçador inimigo acabou de aparecer no bot (abate)», ao lado da barra de objetivos, do CS, da seta sobre o R, do aviso de compra e dos timers da selva sobre um minimapa esquemático.',
        pie: 'Aviso pelo feed de abates.',
      },
    },

    arquitectura: {
      antetitulo: 'Arquitetura',
      titulo: 'Três peças trabalhando juntas',
      intro:
        'Um monorepo com o app de desktop, o servidor de builds e este site. A chave da API da Riot fica só no servidor; o app distribuído não contém nenhum segredo.',
      piezas: [
        {
          titulo: 'App de desktop',
          texto:
            'Electron com duas janelas em React. O processo principal reúne o **conector LCU** (cliente), o **conector da partida** (porta 2999), o **motor de dicas** (uma função pura e determinística: estado da partida + build + rota → avisos), o cliente de builds com cache em disco e os dados do Data Dragon.',
        },
        {
          titulo: 'Servidor de builds',
          texto:
            'Node com Fastify e SQLite, empacotado em Docker. O coletor baixa partidas da API da Riot respeitando os limites de requisições; o agregador calcula as builds a cada 6 horas e a API pública as entrega em JSON com o patch e a data do cálculo.',
        },
        {
          titulo: 'Site e assistente',
          texto:
            'Este site estático (Astro) é publicado no GitHub Pages. O assistente IA, assim como a tela Ajuda do app, consulta o servidor, que limita o uso e é o único que tem a chave do modelo.',
        },
      ],
    },

    seguridad: {
      antetitulo: 'Segurança e Vanguard',
      titulo: 'Só APIs oficiais. Nunca mexemos no jogo',
      intro:
        'O Vanguard é o sistema antitrapaça da Riot e vigia o processo do jogo. O Coach LoL IA foi feito para ficar longe dele: tudo o que sabe vem das interfaces que a Riot publica para ferramentas de terceiros.',
      si: {
        titulo: 'O que ele faz',
        lista: [
          'Lê o **lockfile** do cliente para se conectar à **LCU API**, uma API local protegida por senha.',
          'Consulta a **Live Client Data API** em `127.0.0.1:2999`, somente leitura, durante a partida.',
          'Baixa nomes e ícones do **Data Dragon**, o serviço público da Riot.',
          'Mostra o overlay como uma janela normal do Windows, transparente e com cliques que passam direto.',
          'Registra o atalho com a tecla global do Electron, sem enviar nada ao jogo.',
        ],
      },
      nunca: {
        titulo: 'O que ele nunca faz',
        lista: [
          'Ler ou escrever a memória do jogo.',
          'Injetar código ou DLL em qualquer processo.',
          'Tirar capturas de tela para analisá-las.',
          'Simular teclado ou mouse, nem automatizar ações.',
          'Apagar suas páginas de runas ou seus conjuntos de itens.',
        ],
      },
      noMuestra: {
        titulo: 'O que o overlay não mostra',
        lista: [
          'Timers de feitiços de invocador ou de ultimates inimigas.',
          'Timers dos acampamentos da selva inimiga: os timers da selva são só do seu lado e você mesmo marca.',
          'A posição dos inimigos ou qualquer dado que você não veja na tela. Do caçador inimigo, só repete o que já aparece no feed de abates.',
        ],
        nota: 'Antes de pedir a chave de produção da Riot, cada aviso é revisado de acordo com a política atual para desenvolvedores.',
      },
      datos:
        '**Seus dados:** a chave da API da Riot fica só no servidor como variável de ambiente. O app nunca envia suas credenciais. Ele pede a build do campeão e da rota e, para a tela de carregamento, só o PUUID (identificador público da Riot) dos dez jogadores, com campeão e rota; o Riot ID não é enviado. Com o PUUID o servidor consulta o elo e a maestria na API oficial e guarda a resposta só na memória, por no máximo 10 minutos. Para o coach com IA (análise ao fim da partida e dicas nos momentos mortos) envia as estatísticas, itens e eventos da partida, sem o seu Riot ID; nosso provedor de IA os processa e eles não são guardados.',
      guia: 'Guia: como usar um overlay no LoL com segurança',
    },

    datos: {
      antetitulo: 'Dados',
      titulo: 'Builds de partidas reais, recalculadas a cada 6 h',
      intro:
        'As recomendações não são opinião: vêm de partidas ranqueadas recentes de jogadores de elo alto, processadas pelo nosso próprio servidor.',
      tuberia: [
        {
          icono: 'usuario',
          titulo: 'Coletor',
          texto:
            'Usa a League-v4 para encontrar jogadores **Esmeralda ou acima** em **EUW, LAN e LAS**, e a Match-v5 para baixar suas partidas **ranqueadas Solo/Duo**, de **ARAM**, de **ARAM: Caos** e de **Arena**. Respeita os limites da Riot e processa milhares de partidas novas por região a cada ciclo, divididas entre os modos; o que um modo não usa vai para as ranqueadas.',
        },
        {
          icono: 'grafico',
          titulo: 'Agregador',
          texto:
            'Para cada campeão e rota, calcula a página de runas, os feitiços, os itens iniciais, o núcleo de 3 itens, as botas, os itens situacionais e a ordem de habilidades mais frequentes, com taxa de vitória e número de partidas. No ARAM e no ARAM: Caos agrupa por campeão, e na Arena adiciona a colocação média do campeão e os aumentos e itens mais escolhidos, só com a taxa de escolha. Também calcula o tier de cada campeão na sua rota.',
        },
        {
          icono: 'reloj',
          titulo: 'Publicação',
          texto:
            'O ciclo se repete **a cada 6 h**. A API entrega cada build com o patch e a data do cálculo, e o app guarda em cache para usar offline.',
        },
      ],
      umbrales: [
        {
          cifra: '200',
          texto:
            '**partidas no patch atual** para usar só dados do patch. Com menos de 200 partidas, elas são combinadas com as do patch anterior e a build avisa (`mezclaParches`).',
        },
        {
          cifra: String(MIN_PARTIDAS_BUILD),
          texto: `**${MIN_PARTIDAS_BUILD} partidas no total**, no mínimo, para publicar uma build. De ${MIN_PARTIDAS_BUILD} a ${PARTIDAS_DATOS_LIMITADOS - 1} partidas ela leva o selo **«Dados limitados»**, e com menos de ${MIN_PARTIDAS_BUILD} o app mostra «Build indisponível» em vez de inventar uma.`,
        },
        {
          cifra: '6 h',
          texto:
            '**entre as atualizações.** Quando sai um patch novo, o servidor e o Data Dragon se atualizam sozinhos e o app mostra «Dados do patch X.Y».',
        },
      ],
    },

    tecnologias: {
      antetitulo: 'Tecnologias',
      titulo: 'Um stack moderno, tipado de ponta a ponta',
      intro:
        'Descartamos o Overwolf (obriga a instalar a plataforma dele) e o Tauri (o overlay transparente com cliques que passam é menos maduro no Windows). O Electron dá o controle necessário sobre o overlay com uma única base de código em TypeScript.',
      lista: [
        ['Electron', 'App de desktop: janela principal e overlay transparente com cliques que passam.'],
        ['React 19', 'Interface das duas janelas, com CSS próprio baseado em tokens de design.'],
        ['TypeScript', 'Todo o código (app, servidor e tipos compartilhados) com checagem estrita.'],
        ['Node.js 24', 'Processo principal do app e servidor de builds.'],
        ['SQLite', 'Banco de dados do servidor (better-sqlite3): partidas e builds.'],
        ['Fastify', 'API HTTP do servidor: builds, rotas e o assistente IA.'],
        ['Vitest', 'Testes automatizados do app, do servidor e do código compartilhado.'],
        ['Astro', 'Este site: estático, sem frameworks no cliente e publicado no GitHub Pages.'],
        ['electron-builder', 'Instalador para Windows e atualizações automáticas pelo GitHub Releases.'],
        ['Docker', 'Imagem do servidor pronta para subir em qualquer hospedagem.'],
        ['GitHub Actions', 'Integração contínua e deploy do site.'],
      ],
    },

    calidad: {
      antetitulo: 'Qualidade',
      titulo: 'Testado antes de cada mudança',
      cifra: 'testes automatizados com Vitest no app, no servidor e no código compartilhado, executados a cada mudança.',
      tarjetas: [
        {
          icono: 'prueba',
          titulo: 'Testes com dados reais',
          texto:
            'O motor de dicas e o agregador são testados com partidas gravadas. Um **simulador de partida** reproduz uma partida real como uma Live Client Data API falsa, e um **LCU simulado** permite testar a seleção de campeões e a importação sem abrir o LoL.',
        },
        {
          icono: 'ramas',
          titulo: 'Integração contínua',
          texto:
            'O GitHub Actions checa os tipos de TypeScript de cada pacote e roda todos os testes no Windows a cada push. Também gera a imagem Docker do servidor e verifica se o SQLite carrega dentro dela.',
        },
        {
          icono: 'revisar',
          titulo: 'Revisão por tarefas',
          texto:
            'Cada versão parte de uma especificação e de um plano dividido em tarefas pequenas. Cada tarefa segue TDD (primeiro um teste que falha, depois o código) e passa por uma revisão de especificação e outra de qualidade antes do merge.',
        },
        {
          icono: 'rayo',
          titulo: 'Teste real em partida',
          texto:
            'Antes de publicar cada versão, ela é testada em uma partida de treino real. Este site também tem testes: eles compilam o site e conferem o HTML gerado.',
        },
      ],
    },

    planes: {
      antetitulo: 'Grátis e planos',
      titulo: 'Grátis para jogar, planos para mais coach com IA',
      intro:
        'Tudo o que te ajuda antes e durante a partida é grátis para todos. Os planos só ampliam o coach com IA (análise no fim da partida e perguntas ao seu coach), que é o que custa dinheiro.',
      incluido: {
        titulo: 'Grátis, sempre',
        lista: [
          'Builds Esmeralda+ por campeão e rota',
          'Seção Campeões com tier list',
          'Modos ARAM, ARAM: Caos e Arena, com aumentos',
          'Runas, feitiços, itens e ordem de habilidades',
          'Importação para o cliente em um clique',
          'Tela de carregamento com os dois times',
          'Coach na partida: overlay por widgets, voz e timers da selva',
          'Assistente IA de suporte',
        ],
      },
      sinAnuncios: {
        titulo: 'Sem anúncios dentro do app',
        texto:
          'O app não tem anúncios nem banners. O projeto se mantém com **anúncios no site** (só se você aceitar os cookies de publicidade) e com **doações voluntárias**.',
      },
      apoya: {
        titulo: 'Apoie o projeto',
        texto:
          'As doações e os planos pagam o servidor, os dados das builds e a IA. As doações são voluntárias e não dão vantagens.',
        boton: 'Como apoiar',
      },
    },

    hojaDeRuta: {
      antetitulo: 'Roadmap',
      titulo: 'Onde estamos e para onde vamos',
      completada: 'Concluída',
      items: [
        {
          version: 'v1',
          estado: 'Concluída',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Builds Esmeralda+ (EUW, LAN, LAS) com servidor próprio',
            'Importação de runas, feitiços e itens em um clique',
            'Overlay com avisos e voz opcional',
            'Instalador para Windows com atualizações automáticas',
            'Simulador de partida e LCU simulado para os testes',
          ],
        },
        {
          version: 'v2',
          estado: 'Concluída',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Interface nova com visual profissional: arte do campeão, cartões e microanimações',
            'Este site do produto',
            'Assistente IA de suporte no site e no app',
            'Tudo grátis para todos, sem anúncios dentro do app',
          ],
        },
        {
          version: 'v3',
          estado: 'Concluída',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Overlay por widgets: objetivos, seta de habilidade, CS e KDA, compra e avisos',
            'Tela de carregamento com elo, maestria e taxa de vitória do campeão',
            'Timers manuais da sua selva, também sobre o minimapa',
            'Seção Campeões com tier list, e modos ARAM, ARAM: Caos e Arena',
            'Runas selecionáveis, tema «Sombra» e overlay adaptado a 2K e 4K',
          ],
        },
        {
          version: '3.1',
          estado: 'Disponível',
          clase: 'etiqueta-dorada',
          hecho: true,
          puntos: [
            'Voz natural neural e offline em 5 idiomas, baixada sozinha em segundo plano (nunca durante a partida)',
            'Tela de carregamento em tela cheia com o seu card em destaque: Espaço esconde, ou escolha só cards ou desativada',
            '460 frases de voz por idioma com variações, nível de detalhe e categorias que você liga uma a uma',
          ],
        },
        {
          version: 'Depois',
          estado: 'Ideias',
          clase: '',
          hecho: false,
          puntos: ['Análise da partida com IA ao terminar', 'Contas de usuário e avisos por e-mail'],
        },
      ],
    },

    faq: {
      antetitulo: 'FAQ',
      titulo: 'Perguntas frequentes',
      escribir: 'Escrever para',
      ayuda:
        'Não encontrou sua resposta? Pergunte ao **assistente IA**: ele fica no botão «Assistente IA» deste site e na tela «Ajuda» do app.',
      ayudaAlt:
        'Captura da tela Ajuda do Coach LoL IA: o chat do assistente IA com a saudação, o campo de pergunta, o botão Enviar e o aviso de que as respostas são geradas por IA.',
      preguntas: [
        {
          p: 'Posso ser banido por usar o Coach LoL IA?',
          r: 'O app usa só as APIs locais oficiais que a Riot oferece a ferramentas de terceiros (LCU API e Live Client Data API) e nunca mexe no processo do jogo: não lê memória, não injeta código, não captura a tela e não simula teclas nem cliques. Além disso, o overlay não mostra nenhuma informação que você já não veja na tela. Mesmo assim, a decisão final sobre ferramentas de terceiros é sempre da Riot, e por isso revisamos cada aviso de acordo com a política vigente dela.',
        },
        {
          p: 'É grátis?',
          r: 'Sim, tudo: as builds, as runas, a importação e o coach na partida (overlay e voz), para todo mundo e sem anúncios dentro do app. A análise com IA no fim da partida e as perguntas ao seu coach têm uma cota grátis (3 análises e 5 perguntas por mês) e planos pagos para quem quiser mais. O projeto se mantém com esses planos, anúncios no site e doações voluntárias.',
        },
        {
          p: 'Preciso do Overwolf ou de outro programa?',
          r: 'Não. O Coach LoL IA é um app de desktop próprio para Windows: não precisa do Overwolf nem de nenhuma outra plataforma. Só do cliente de League of Legends.',
        },
        {
          p: 'Por que não vejo o overlay durante a partida?',
          r: 'O overlay é uma janela do Windows por cima do jogo, então só aparece se o LoL estiver no modo «Sem bordas» (Opções → Vídeo → Modo de janela). Se o jogo estiver em tela cheia, o app avisa. Durante a partida, Ctrl+Shift+O esconde ou mostra o overlay. Para posicionar cada widget, na tela Overlay do app clique em «Mover e calibrar», arraste e clique em «Fixar aqui» (ou Esc ou Ctrl+Shift+O). Nessa mesma tela você ativa, redimensiona ou desliga cada widget.',
        },
        {
          p: 'Como importo as runas automaticamente?',
          r: 'Na seleção de campeões, clique em «Importar» no app (ou ative a importação automática em Ajustes). O app cria a página «Coach: <Campeão> <Rota>», escolhe os feitiços e adiciona o conjunto de itens. Explicamos o passo a passo no guia [Como importar runas automaticamente](@guiaRunas).',
        },
        {
          p: 'Como funcionam os timers da selva?',
          r: 'São manuais e vêm desligados: você ativa na tela Overlay. Quando limpa um acampamento do seu lado ou um Caranguejo, marca com um clique ou com uma tecla que você escolhe, e o app conta quanto falta para ele nascer de novo, em um widget e em cima do minimapa. Alt+Shift+L mostra ou esconde durante a partida. Eles contam só a sua selva e os Caranguejos, nunca os acampamentos do inimigo: o app não sabe quando o inimigo os limpa, e as políticas da Riot não permitem acompanhar o que o inimigo faz fora da sua visão.',
        },
        {
          p: 'O que a tela de carregamento mostra?',
          r: 'Enquanto a partida carrega, o overlay mostra os dez jogadores com campeão e rota: o elo oficial de Solo/Duo, a maestria com aquele campeão e a taxa de vitória do campeão na rota segundo as nossas builds. Adiciona só etiquetas positivas ou neutras, como «Especialista em Ahri» ou «Escala para o late game». Não calcula um MMR próprio nem coloca rótulos negativos em ninguém, e some assim que a partida começa. Para pedir o elo e a maestria, o app envia ao servidor só o PUUID de cada jogador (nunca o Riot ID), e o servidor guarda a resposta na memória por no máximo 10 minutos.',
        },
        {
          p: 'O que ele me diz sobre o caçador inimigo?',
          r: 'Só o que o jogo já te mostra. Quando o caçador inimigo participa de um abate, que aparece no feed de abates, o app avisa: «O caçador inimigo acabou de aparecer no bot (abate)». Há também uma opção, desligada por padrão, com a rota habitual dele: uma estimativa das nossas partidas sobre por qual lado esse campeão costuma começar e qual rota costuma visitar primeiro. Nenhuma das duas diz onde ele está agora: o app não vê a posição nem os tempos de recarga dele.',
        },
        {
          p: 'Ele vai apagar minhas páginas de runas?',
          r: 'Só se você confirmar. O app cria as próprias páginas com o prefixo «Coach:» e, se existir uma dele, substitui essa. Se você não tiver nenhuma livre e clicar em «Importar», ele pergunta antes de substituir uma das suas (a selecionada ou a mais antiga; nunca uma predefinida). A importação automática nunca apaga nada.',
        },
        {
          p: 'De onde vêm as builds?',
          r: `De partidas ranqueadas Solo/Duo de jogadores Esmeralda ou acima em EUW, LAN e LAS, que o nosso servidor baixa da API oficial da Riot e agrega a cada 6 horas. Desses mesmos jogadores também baixa as partidas de ARAM, ARAM: Caos e Arena. Cada build mostra o número de partidas e a taxa de vitória. Uma build é publicada a partir de ${MIN_PARTIDAS_BUILD} partidas; de ${MIN_PARTIDAS_BUILD} a ${PARTIDAS_DATOS_LIMITADOS - 1} leva o selo «Dados limitados», e com menos de ${MIN_PARTIDAS_BUILD} o app diz «Build indisponível» em vez de inventar uma. [Mais sobre as builds e a tier list](@builds).`,
        },
        {
          p: 'Quais modos de jogo são suportados?',
          r: 'Ranqueada (por campeão e rota), ARAM e ARAM: Caos (por campeão, com runas, feitiços, itens e habilidades; no ARAM: Caos, também os aumentos mais escolhidos) e Arena (por campeão, com os aumentos e itens mais escolhidos e a taxa de escolha, além dos números do campeão: colocação média, top 4 e primeiro lugar). Cada modo tem sua tier list na seção Campeões. O app reconhece o modo na seleção de campeões e na partida, e o overlay se adapta: no ARAM e no ARAM: Caos tira os objetivos, o CS e a selva, e deixa o KDA, a seta de habilidade e a compra; na Arena também não há seta de habilidade.',
        },
        {
          p: 'O que é a tier list de Campeões?',
          r: 'Uma seção do app com todos os campeões por rota e modo. Cada um recebe um tier (S, A, B ou C) que combina a taxa de vitória e a taxa de escolha dentro da rota. Os que têm menos de 30 partidas nunca passam do B e levam o aviso «Dados limitados». Clique em um campeão para ver a build completa. Se quiser saber como ler, veja o guia [O que é uma tier list](@guiaTierList).',
        },
        {
          p: 'As builds servem se eu jogo em outro servidor, como o BR?',
          r: 'Sim. As builds são calculadas com partidas de EUW, LAN e LAS, mas dependem do campeão, da rota e do patch, não do servidor em que você joga.',
        },
        {
          p: 'Em quais idiomas está?',
          r: 'O app, o overlay, a voz e o assistente estão em espanhol, inglês, português (Brasil), francês e alemão, e este site também. Por padrão o app usa o idioma do seu Windows, e você pode mudar em Ajustes.',
        },
        {
          p: 'Ele vai me fazer subir de elo?',
          r: 'Não prometemos isso. O Coach LoL IA te dá informação e lembretes (builds com dados, objetivos, CS, compras) para você tomar suas próprias decisões com mais contexto. O que acontece na partida depende de como você joga.',
        },
        {
          p: 'Preciso criar uma conta?',
          r: 'Não. Você baixa o app, abre junto com o cliente de League of Legends e pronto: não há contas, chaves nem cadastros.',
        },
        {
          p: 'A voz precisa de internet?',
          r: 'Só uma vez: o modelo da voz natural (cerca de 124 MB) é baixado sozinho do GitHub em segundo plano, nunca durante a seleção de campeões, o carregamento ou a partida. Depois funciona offline, no seu PC. Até terminar, toca a voz do Windows.',
        },
        {
          p: 'E se eu ficar sem internet?',
          r: 'O app usa as últimas builds salvas e avisa. O coach na partida funciona igual, porque só precisa do cliente e da partida no seu PC.',
        },
        {
          p: 'Funciona no Mac ou no Linux?',
          r: 'Por enquanto só no Windows 10 e 11, onde é jogada a grande maioria das partidas de LoL. Mac e Linux ficam de fora desta versão.',
        },
        {
          p: 'Precisa de ajuda?',
          r: `Escreva para ${CORREO}. Se o problema for com o overlay, informe sua versão do Windows e se o jogo está no modo «Sem bordas».`,
          correo: true,
        },
        {
          p: 'O Coach LoL IA é um produto oficial da Riot?',
          r: 'Não. É um projeto independente, não endossado pela Riot Games.',
        },
      ],
    },

    cta: {
      titulo: 'Sua próxima partida, com coach',
      texto: 'Baixe o Coach LoL IA grátis e teste as builds na sua próxima seleção de campeões.',
    },
  },

  descargar: {
    antetitulo: 'Baixar',
    h1: 'Baixe o Coach LoL IA grátis para Windows',
    intro:
      'Grátis, em 5 idiomas e com atualizações automáticas. O instalador é publicado no GitHub Releases junto com as notas de cada versão.',
    ultima: 'Última versão:',
    archivo: 'Baixe o arquivo',
    archivoFin: 'e execute.',
    queTrae: 'O que traz a',
    requisitosTitulo: 'Requisitos',
    requisitos: [
      ['Sistema', 'Windows 10 ou 11 de 64 bits.'],
      ['Jogo', 'League of Legends instalado (cliente da Riot).'],
      ['Overlay', 'O jogo no modo «Sem bordas» (Opções → Vídeo → Modo de janela).'],
      ['Conexão', 'Internet para baixar as builds; offline, usa as últimas salvas.'],
    ],
    instalacionTitulo: 'Instalação',
    instalacion: [
      'Abra a [última release](https://github.com/pepeipto/coach-lol-ia/releases/latest) e baixe o instalador `.exe`.',
      'Execute. Se o Windows SmartScreen mostrar um aviso, clique em «Mais informações» e em «Executar assim mesmo».',
      'Abra o Coach LoL IA e depois o cliente de League of Legends. O app detecta sozinho e, na primeira vez, uma boas-vindas em quatro passos mostra o básico.',
      'Na seleção de campeões você verá sua build. Clique em «Importar» para aplicar.',
      'Para o coach na partida, coloque o jogo no modo **Sem bordas**.',
    ],
    extras: [
      {
        titulo: 'Atualizações automáticas',
        texto: 'O app verifica se há uma versão nova ao iniciar, baixa em segundo plano e instala ao fechar.',
      },
      {
        titulo: 'Só APIs oficiais da Riot',
        texto: 'Não mexe no processo do jogo: não lê a memória nem injeta código. [Mais detalhes](@inicio#seguridad).',
      },
      {
        titulo: 'Desinstalar',
        texto: 'Em Configurações do Windows → Aplicativos → Coach LoL IA. Suas runas e conjuntos de itens do cliente não são alterados.',
      },
      {
        titulo: 'Código no GitHub',
        texto:
          'O código, o histórico de mudanças e as notas de cada versão estão no [GitHub](https://github.com/pepeipto/coach-lol-ia).',
      },
      {
        titulo: 'Assinatura de código e verificação',
        texto:
          'Assinatura de código gratuita da SignPath.io, certificado da SignPath Foundation (solicitação em andamento). Cada instalador é compilado no GitHub Actions a partir do código publicado (licença MIT) e seu SHA-256 está em `SHA256SUMS.txt`. [Política de assinatura](https://github.com/pepeipto/coach-lol-ia/blob/main/CODE_SIGNING.md).',
      },
    ],
    ayuda:
      'O app não detecta o cliente ou o overlay não aparece? Escreva para nós com sua versão do Windows e uma descrição do problema.',
  },

  apoyar: {
    antetitulo: 'Apoie o projeto',
    h1: 'O Coach LoL IA é grátis para jogar',
    intro:
      'Tudo o que te ajuda antes e durante a partida está disponível para todo mundo, e o app não tem anúncios. O coach com IA tem uma cota grátis todo mês e planos para quem quiser mais. O projeto se mantém com esses planos, com os anúncios no site e com doações voluntárias.',
    porQue: 'Por que apoiar?',
    porQueTexto:
      'Manter o Coach LoL IA custa dinheiro todo mês. Se ele for útil para você, uma doação ajuda a manter grátis o que te ajuda na partida e a melhorar o app. Doar é voluntário e não dá vantagens no app.',
    quePagan: 'O que as doações pagam',
    destinos: [
      ['O servidor', 'A hospedagem do servidor que baixa as partidas, calcula as builds a cada 6 horas e as entrega ao app.'],
      ['Os dados', 'O armazenamento e o processamento de milhares de partidas Esmeralda+ de EUW, LAN e LAS, e o assistente IA de suporte.'],
      ['O desenvolvimento', 'O tempo para corrigir bugs, acompanhar cada patch de League of Legends e adicionar funções novas.'],
    ],
    cafe: 'Quer nos pagar um café? Qualquer valor ajuda.',
    donar: 'Doar',
    pronto: 'Em breve você poderá apoiar o projeto com uma doação.',
    mientras: 'Enquanto isso, se quiser ajudar, escreva para',
    otraForma: 'Outra forma de apoiar é contar para os seus amigos ou [baixar o app](@descargar) e usar.',
  },

  novedades: {
    antetitulo: 'Novidades',
    h1: 'O que há de novo no Coach LoL IA',
    intro:
      'Todas as versões do app, da mais recente à mais antiga. O app também mostra na tela «Novidades» e resume cada versão nova na primeira vez que você abre.',
    notaIdioma:
      'As notas de versão são escritas em espanhol. As versões 3.x estão traduzidas abaixo; as anteriores aparecem no espanhol original.',
    version: 'Versão',
    ultima: 'Última versão',
    proxima: {
      titulo: 'Novo na 3.1',
      texto:
        'Voz natural neural e offline nos 5 idiomas, baixada sozinha em segundo plano (nunca durante a seleção de campeões, o carregamento ou a partida); tela de carregamento em tela cheia com o seu card em destaque, que o Espaço esconde (ou só cards, ou desativada); e 460 frases de voz por idioma com variações, nível de detalhe e categorias.',
    },
    cierre: 'As atualizações são instaladas sozinhas ao fechar o app. Se ainda não tem, baixe grátis.',
    notasGithub: 'Notas no GitHub',
    meses: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    formatoFecha: '{d} de {m} de {a}',
  },

  legal: {
    antetitulo: 'Legal',
    plantilla:
      '**Modelo pendente de revisão.** Este texto é um modelo razoável redigido para o projeto e deve ser revisado pelo responsável (de preferência com assessoria jurídica) antes do lançamento público. Os campos entre colchetes, como *[nome ou razão social]*, devem ser preenchidos. Não constitui assessoria jurídica.',
    actualizado: 'Última atualização: 5 de novembro de 2026.',
    traduccion: 'Esta é uma tradução do original em espanhol. Em caso de divergência, prevalece a versão em espanhol.',
    privacidad: {
      h1: 'Política de privacidade',
      secciones: [
        {
          h: '1. Controlador dos dados',
          p: [
            `Controlador: ESTRADA GLOBAL GESTIO, S.L., com NIF B72985229 e sede em Carrer del Campament 25, 46035 València (Espanha). Contato para qualquer questão de privacidade: [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        { h: '2. Quais dados tratamos e para quê', tabla: true },
        {
          h: '3. Dados que não coletamos',
          p: [
            'O app lê dados do cliente e da partida **no seu próprio PC** (LCU API e Live Client Data API) para mostrar a build e os avisos. Essas informações não são enviadas ao nosso servidor, exceto os dados da tela de carregamento e do coach com IA descritos na seção anterior: não coletamos suas credenciais nem guardamos um histórico das suas partidas. O Coach LoL IA também não tem contas de usuário nem senhas.',
          ],
        },
        {
          h: '4. Dados salvos no seu PC',
          p: [
            'O app salva na sua pasta de usuário as configurações, o cache de builds e do Data Dragon, o modelo da voz natural com seu cache de frases, o histórico das suas análises com IA (as 50 últimas) e um registro local de erros. Eles são apagados ao desinstalar o app e excluir a pasta de dados dele.',
          ],
        },
        {
          h: '5. Operadores e destinatários',
          lista: [
            '**Anthropic**, nosso provedor de IA (gera as respostas do assistente IA a partir das mensagens do chat, e as análises e dicas do coach com IA a partir dos dados da partida, sem o seu Riot ID). Pode tratar dados fora do EEE com as garantias adequadas.',
            '**Google** (AdSense neste site, só com o seu consentimento).',
            '**GitHub** (hospedagem deste site, dos downloads do app e do modelo da voz natural, de cerca de 124 MB, que o app baixa sozinho; como em qualquer download, o GitHub recebe o seu endereço IP).',
            '**Stripe** (pagamentos dos planos e pacotes: coleta seus dados de pagamento e seu e-mail na própria página dele; nós não vemos os dados do seu cartão).',
            '**Fly.io** (hospedagem do nosso servidor, no seu data center de Frankfurt, Alemanha: builds, tela de carregamento, cotas e o assistente e o coach com IA).',
          ],
          p: [
            'Se você fizer uma doação, ela é processada pela plataforma de doações no site dela: nós não vemos nem guardamos seus dados de pagamento.',
            'Não vendemos seus dados nem os compartilhamos com terceiros, salvo por obrigação legal.',
          ],
        },
        {
          h: '6. Retenção',
          p: ['Os registros técnicos do servidor são mantidos por no máximo 30 dias. As mensagens do assistente e os dados de partida recebidos pelo coach com IA não são guardados.'],
        },
        {
          h: '7. Seus direitos',
          p: [
            `Você pode exercer seus direitos de acesso, retificação, exclusão, oposição, limitação e portabilidade escrevendo para [${CORREO}](mailto:${CORREO}). Se achar que não atendemos bem sua solicitação, pode apresentar reclamação à Agência Espanhola de Proteção de Dados (aepd.es) ou à autoridade de controle do seu país.`,
          ],
        },
        { h: '8. Cookies', p: ['Consulte a [política de cookies](@cookies).'] },
      ],
      tabla: {
        cabecera: ['Origem', 'Dados', 'Finalidade', 'Base legal'],
        filas: [
          [
            'App de desktop',
            'Campeão e rota consultados e endereço IP da requisição.',
            'Fornecer as builds.',
            'Execução do serviço que você solicita (art. 6.1.b do RGPD).',
          ],
          [
            'Tela de carregamento (app)',
            'Dos dez jogadores da sua partida: o identificador da Riot (PUUID), o campeão, a rota e o time, e a região do seu cliente. O Riot ID (nome#tag) não é enviado.',
            'Pedir à API oficial da Riot o elo de Solo/Duo e a maestria de cada jogador para a tela de carregamento. O servidor guarda a resposta só na memória, por no máximo 10 minutos, e não a grava no banco de dados nem nos registros.',
            'Execução do serviço que você solicita (art. 6.1.b do RGPD) e interesse legítimo em relação aos demais jogadores, com dados que a Riot já torna públicos (art. 6.1.f do RGPD).',
          ],
          [
            'Assistente IA (site e app)',
            'As mensagens que você escreve no chat do assistente e o endereço IP da requisição.',
            'Gerar a resposta: as mensagens são enviadas ao nosso servidor e à Anthropic, que processa o texto com o modelo de IA dela. Nosso servidor não as guarda além desse processamento. Não escreva dados pessoais no chat.',
            'Execução do serviço que você solicita (art. 6.1.b do RGPD).',
          ],
          [
            'Coach com IA (app)',
            'Dados da partida em andamento ou recém-terminada, sem seu nome de invocador nem seu Riot ID: seu campeão, rota e modo; estatísticas (KDA, CS, ouro, nível, dano, visão), itens e compras com o minuto, mortes com o minuto e objetivos dos eventos oficiais; nas dicas, também os campeões, níveis, itens e abates do placar (TAB). E o endereço IP da requisição.',
            'Gerar a análise ao fim da partida e as dicas dos momentos mortos (que você pode ativar ou desativar em Ajustes): os dados são enviados ao nosso servidor e à Anthropic, que os processa com o modelo de IA dela. Nosso servidor não os guarda nem os escreve nos registros: só conta as requisições para os limites diários. Suas análises ficam salvas só no seu PC.',
            'Execução do serviço que você solicita (art. 6.1.b do RGPD).',
          ],
          [
            'Coach pessoal (app)',
            'O que você diz ou escreve ao coach pessoal e um resumo do seu perfil calculado no seu PC, sem seu Riot ID nem seu nome de invocador: seu elo no Solo/Duo, seus campeões mais jogados, suas tendências e seu desafio atual, e as estatísticas das suas últimas 10 partidas (campeão, modo, rota, vitória ou derrota, KDA, CS por minuto, nota e duração). E o endereço IP da requisição.',
            'Responder com dicas adaptadas ao seu jeito de jogar: os dados são enviados ao nosso servidor e à Anthropic, que os processa com seu modelo de IA. Nosso servidor não guarda a conversa nem o resumo: só conta as requisições para seus limites.',
            'Execução do serviço que você solicita (art. 6.1.b RGPD / LGPD).',
          ],
          [
            'Cartão para compartilhar (app)',
            'Nenhum: quando você copia ou salva o cartão de uma partida, o app só avisa que um foi compartilhado, sem nenhum dado. O servidor vê o endereço IP da requisição e não o guarda.',
            'Contar quantos cartões são compartilhados por dia. Só se guarda o número do dia; o IP é usado em memória, nesse dia, para que um mesmo computador não conte mais de 20.',
            'Interesse legítimo em saber quanto a função é usada (art. 6.1.f RGPD).',
          ],
          [
            'Cotas e planos (app e site)',
            'Um identificador pseudônimo e persistente do dispositivo (um resumo SHA-256 que não permite saber qual computador é, mas que é sempre o mesmo para o seu PC) ou, se você tem um plano, a sua chave de licença; o número de análises e perguntas usadas no mês. Se você contratar um plano ou um pacote, os identificadores de cliente, de assinatura e de pagamento que o Stripe nos dá e o status da sua assinatura.',
            'Aplicar a cota do seu plano e gerenciar a sua assinatura. Só se guardam contadores: nunca os dados das suas partidas.',
            'Execução do contrato (art. 6.1.b RGPD) e obrigações legais de faturamento (art. 6.1.c RGPD).',
          ],
          [
            'Suporte',
            `Seu e-mail e o que você nos contar ao escrever para ${CORREO}.`,
            'Responder à sua consulta.',
            'Interesse legítimo em atender você (art. 6.1.f do RGPD).',
          ],
          [
            'Este site',
            'Sua escolha de cookies (no seu navegador) e, só se você aceitar, cookies de publicidade do Google AdSense.',
            'Lembrar sua escolha e exibir anúncios.',
            'Consentimento (art. 6.1.a do RGPD).',
          ],
        ],
      },
    },
    terminos: {
      h1: 'Termos de uso',
      secciones: [
        {
          h: '1. Quem somos',
          p: [
            `O Coach LoL IA é um serviço de ESTRADA GLOBAL GESTIO, S.L., com NIF B72985229 e sede em Carrer del Campament 25, 46035 València (Espanha). Contato: [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        {
          h: '2. O serviço',
          p: [
            'O Coach LoL IA é um aplicativo de desktop gratuito para Windows que sugere builds na seleção de campeões e mostra avisos durante a partida. As recomendações são orientativas e se baseiam em estatísticas de partidas; não garantem nenhum resultado.',
          ],
        },
        {
          h: '3. Uso do app',
          lista: [
            'Concedemos a você uma licença pessoal, não exclusiva e intransferível para usar o app.',
            'Você não pode usá-lo para descumprir as regras da Riot Games nem modificá-lo para acessar o jogo por outros meios.',
            'O app usa só as APIs oficiais da Riot. Mesmo assim, o uso de ferramentas de terceiros está sujeito às políticas da Riot, que podem mudar.',
          ],
        },
        {
          h: '4. Preço, planos e doações',
          lista: [
            'Tudo o que te ajuda antes e durante a partida (builds, runas, importação, overlay e coach por voz) é grátis para todos, e o app não tem anúncios.',
            'O coach com IA (a análise no fim da partida e as perguntas ao seu coach) tem uma cota mensal. O plano Grátis inclui 3 análises e 5 perguntas por mês; os planos pagos Aliado, Estratega, Mariscal e Leyenda ampliam essa cota. O preço e a cota de cada plano aparecem antes da contratação.',
            'A cota se renova todo mês no dia em que o seu plano começa (ou, no plano Grátis, no dia em que você usou o app pela primeira vez), e o que não for usado não se acumula. Se uma análise ou uma pergunta falhar por um erro da IA, ela não gasta cota.',
            'Os planos são pagos antecipadamente pelo Stripe, todo mês ou, no Aliado e no Estratega, todo ano (com 2 meses grátis), e se renovam sozinhos. No pagamento anual a cota continua mensal. Você pode cancelar quando quiser em «Gerenciar assinatura»: o plano continua ativo até o fim do período já pago.',
            'Os pacotes de partidas extras (com os planos Estratega, Mariscal e Leyenda) são um pagamento único e não expiram.',
            'Você também pode apoiar o projeto com uma doação em [Apoie o projeto](@apoyar). Doar é voluntário e não dá acesso a funções nem vantagens no app.',
            'Nada disso limita os direitos que a legislação de consumo te garante.',
          ],
        },
        {
          h: '5. Disponibilidade',
          p: [
            'Tentamos manter o serviço sempre disponível, mas pode haver interrupções por manutenção, mudanças de patch ou das APIs da Riot. Se o servidor não responder, o app usa os últimos dados salvos.',
          ],
        },
        {
          h: '6. Responsabilidade',
          p: [
            'O app é oferecido «no estado em que se encontra». Na medida permitida pela lei, não respondemos por danos indiretos decorrentes do seu uso. Nada disso limita os direitos que a legislação de defesa do consumidor garante a você.',
          ],
        },
        {
          h: '7. Propriedade intelectual e Riot Games',
          riot: true,
          p: [
            'League of Legends e suas imagens são marcas e conteúdo da Riot Games, Inc., usados de acordo com a política dela para projetos de terceiros.',
          ],
        },
        {
          h: '8. Mudanças e lei aplicável',
          p: [
            'Podemos atualizar estes termos; avisaremos as mudanças relevantes neste site. Eles são regidos pela lei espanhola e, para consumidores, são competentes os tribunais do seu domicílio.',
          ],
        },
      ],
    },
    cookies: {
      h1: 'Política de cookies',
      queUsamos: 'O que usamos',
      queUsamosTexto:
        'Este site não usa cookies próprios de análise nem de rastreamento. Ele conta as visitas sem cookies e sem guardar nada no seu navegador: nosso servidor só guarda totais por dia de páginas vistas e do site de origem. O seu IP não é gravado em nenhum banco de dados: só é usado em memória nesse dia, para que um mesmo computador não conte várias vezes, e é esquecido na virada do dia (interesse legítimo em medir o uso do site, art. 6.1.f RGPD). Só guarda sua escolha sobre a publicidade e, se você aceitar, carrega os anúncios do Google AdSense, que usam cookies de terceiros.',
      tabla: {
        cabecera: ['Nome', 'Tipo', 'Finalidade', 'Duração'],
        filas: [
          ['`coach-cookies` (armazenamento local)', 'Próprio, técnico', 'Lembrar se você aceitou ou recusou a publicidade.', '12 meses, ou até você apagar'],
          [
            'Cookies do Google AdSense',
            'De terceiros, publicidade',
            'Exibir e medir anúncios. Só são carregados se você aceitar. Mais informações na política do Google.',
            'Conforme o Google',
          ],
        ],
      },
      sinAnunciosApp: 'O app de desktop nunca mostra publicidade: os anúncios só aparecem neste site.',
      cambiar: 'Mudar sua escolha',
      conAnuncios: 'Clique no botão para apagar sua escolha; o aviso de cookies vai aparecer de novo.',
      sinAnuncios:
        'No momento este site não exibe anúncios, então não há nada para aceitar. Se ativarmos, você verá um aviso para escolher.',
      boton: 'Redefinir minha escolha de cookies',
      borradaBanner:
        ' Escolha apagada. Escolha de novo no aviso; se os anúncios já tinham sido carregados, deixarão de carregar ao recarregar a página.',
      borrada: ' Escolha apagada. A mudança vale ao recarregar a página.',
      navegador: 'Você também pode apagar os dados deste site nas configurações do seu navegador.',
      contacto: 'Contato',
      contactoTexto: 'Para qualquer dúvida:',
    },
  },

  tft: {
    antetitulo: "TFT",
    h1: "TFT no Coach LoL IA: composições e itens, dentro do app",
    intro: "A aba **TFT** do app mostra as composições que funcionam melhor no patch e os melhores itens de cada unidade, calculados com partidas ranqueadas de jogadores **Mestre ou acima** no EUW. É grátis e você consulta antes de jogar.",
    datos: "Patch {parche} · {partidas} partidas analisadas",
    capturas: {
      lista: { alt: "Captura da aba TFT do Coach LoL IA: as composições do patch agrupadas por tier, cada uma com suas sinergias, seus campeões, a colocação média, o top 4 e os itens do carregador.", pie: "Composições do patch, do tier S ao C." },
      objetos: { alt: "Captura do painel de itens de um campeão na aba TFT do Coach LoL IA: suas melhores combinações de três itens, com top 4 e colocação média, e os itens mais usados nele.", pie: "Clique em um campeão para ver seus melhores itens." },
    },
    funciones: {
      titulo: "O que a aba TFT faz",
      lista: [
        { titulo: "Composições por tier", texto: "As composições do patch ordenadas de S a C pela colocação média, com o top 4 e o nível em que costumam ser jogadas." },
        { titulo: "Campeões de cada composição", texto: "As unidades que mais aparecem em cada composição, com o carregador destacado e seus itens." },
        { titulo: "Melhores itens de cada unidade", texto: "Clique em um campeão e veja suas melhores combinações de três itens, com top 4 e colocação média, e os itens mais usados nele." },
        { titulo: "Dados de alto nível", texto: "Partidas ranqueadas de Mestre, Grão-Mestre e Desafiante do EUW, tiradas da API oficial da Riot e recalculadas várias vezes ao dia." },
        { titulo: "Grátis e no seu idioma", texto: "Com os nomes e ícones oficiais nos cinco idiomas do app, sem pagar nada." },
      ],
    },
    partida: {
      titulo: "E durante a partida de TFT?",
      texto: "O app não mostra nada. As regras da Riot não permitem ajuda ao vivo no TFT: nada de overlay, dicas durante a partida, espiar os rivais ou estatísticas de aumentos. Por isso a aba TFT é para consultar **antes de jogar** e, enquanto você joga TFT, o app não coloca nada sobre o jogo.",
    },
    lol: {
      titulo: "Onde há overlay: League of Legends",
      texto: "Nas partidas de LoL, o Coach LoL IA coloca sobre o jogo um overlay transparente por widgets, com voz, que só usa dados que o jogo já mostra. É isto que ele te diz:",
    },
    faq: [
      {
        p: "Onde vejo a tier list de TFT?",
        r: "Na aba TFT do app Coach LoL IA, que é grátis. Lá estão as composições do patch e os melhores itens de cada unidade, sempre atualizados.",
      },
      {
        p: "O Coach LoL IA tem overlay para TFT?",
        r: "Não. Seguindo as regras da Riot, o app não mostra nada durante uma partida de TFT. O overlay em partida é só para League of Legends.",
      },
      {
        p: "De quais partidas saem os dados?",
        r: "De partidas ranqueadas de TFT de jogadores Mestre, Grão-Mestre e Desafiante do EUW, baixadas com a API oficial da Riot.",
      },
      {
        p: "Por que não há estatísticas de aumentos?",
        r: "Porque a política da Riot para TFT não permite mostrar o desempenho dos aumentos. Por isso mostramos só composições, unidades e itens.",
      },
    ],
    ia: "Feito com ajuda de IA.",
    cta: "Baixe o app e veja as composições e os itens de TFT antes da sua próxima partida.",
  },
  builds: {
    antetitulo: 'Builds e tier list',
    h1: 'Builds de LoL e tier list com dados de partidas Esmeralda+',
    intro:
      'O Coach LoL IA calcula as builds de League of Legends e a tier list com partidas reais de jogadores **Esmeralda ou acima** em EUW, LAN e LAS. Não são opiniões nem listas feitas à mão: cada build mostra quantas partidas a sustentam e a taxa de vitória, e é recalculada **a cada 6 horas**.',
    capturaAlt:
      'Captura da tela Campeão do Coach LoL IA com a build da Ahri no Meio: runas de Dominação e Feitiçaria, Flash e Incendiar, itens iniciais, núcleo e botas, e a ordem de habilidades, com taxa de vitória, 33 partidas e o patch 16.20.',
    capturaPie: 'Build por campeão e rota, com o número de partidas.',
    queIncluye: {
      titulo: 'O que cada build inclui',
      lista: [
        '**Runas**: a página mais usada e, desde a 3.0.1, várias páginas para escolher, cada uma com sua taxa de vitória e partidas.',
        '**Feitiços de invocador**, como Flash e Incendiar ou Flash e Golpear.',
        '**Itens**: iniciais, núcleo de 3 itens, botas e situacionais.',
        '**Ordem de habilidades**, com a prioridade de evolução (por exemplo, Q > W > E).',
        'Na **Arena**, os aumentos e itens mais escolhidos, só com a taxa de escolha.',
      ],
    },
    origen: {
      titulo: 'De onde vêm os dados',
      texto:
        'Nosso servidor usa a API oficial da Riot: a League-v4 para encontrar jogadores Esmeralda+ e a Match-v5 para baixar suas partidas ranqueadas Solo/Duo, além das partidas de ARAM, ARAM: Caos e Arena. Com elas calcula, para cada campeão e rota, o que mais se joga e como se sai.',
      puntos: [
        '**Patch atual primeiro:** com 200 partidas ou mais no patch, usa só dados do patch; com menos, combina com o anterior e a build avisa.',
        `**Mínimo de ${MIN_PARTIDAS_BUILD} partidas** para publicar uma build; de ${MIN_PARTIDAS_BUILD} a ${PARTIDAS_DATOS_LIMITADOS - 1} ela leva o selo «Dados limitados».`,
        '**Nada inventado:** se não houver partidas suficientes, o app diz «Build indisponível».',
      ],
    },
    tierList: {
      titulo: 'Como a tier list é calculada',
      texto:
        'Na seção Campeões do app, cada campeão recebe um tier por rota e por modo que combina a **taxa de vitória** e a **taxa de escolha** dentro daquela rota. Assim, um campeão com muitas vitórias mas pouquíssimas partidas não vai para o topo por acaso.',
      tiers: [
        ['S', 'Rende acima do normal na rota e é jogado o suficiente para o dado ser confiável.'],
        ['A', 'Uma escolha sólida no patch atual.'],
        ['B', 'Jogável e equilibrado. Aqui também ficam os que têm menos de 30 partidas.'],
        ['C', 'Abaixo da média neste patch: pode funcionar, mas hoje é mais difícil.'],
      ],
      alt: 'Captura da seção Campeões do Coach LoL IA: tier list da Ranqueada com o seletor de modo, a busca, os filtros por rota e a tabela de campeões com tier, vitórias, escolhas e partidas.',
      pie: 'A tier list completa fica no app, com dados do patch atual.',
    },
    modos: {
      titulo: 'Ranqueada, ARAM, ARAM: Caos e Arena',
      texto:
        'Cada modo tem suas próprias builds e sua tier list. No ARAM e no ARAM: Caos as builds são por campeão (sem rota), com os aumentos mais escolhidos no ARAM: Caos; na Arena entram também a colocação média, o top 4 e o primeiro lugar do campeão. Os aumentos e os itens da Arena aparecem só com a taxa de escolha, sem taxa de vitória, como pede a política da Riot. Os modos com poucas partidas coletadas mostram «Sem dados ainda» até haver amostra suficiente.',
    },
    importar: {
      titulo: 'Da build para o cliente em um clique',
      texto:
        'Na seleção de campeões, o app detecta seu campeão e sua rota e mostra a build em menos de 2 segundos. Com «Importar» ele cria a página de runas, escolhe os feitiços e adiciona o conjunto de itens. [Passo a passo no guia de runas](@guiaRunas).',
    },
    honestidad: {
      titulo: 'O que a tier list não é',
      texto:
        'Uma tier list resume estatísticas; não diz qual campeão você tem que jogar. Seu domínio do campeão, seu time e o adversário pesam muito. Por isso o Coach LoL IA sempre mostra o número de partidas e não promete resultados. [Como ler uma tier list](@guiaTierList).',
    },
    faq: [
      {
        p: 'De quanto em quanto tempo as builds são atualizadas?',
        r: 'A cada 6 horas. Quando sai um patch novo, o servidor e o Data Dragon se atualizam sozinhos e o app mostra o patch dos dados.',
      },
      {
        p: 'Posso ver a tier list no site?',
        r: 'A tier list completa, com busca, filtros e a build de cada campeão, está na seção Campeões do app, que é grátis. Esta página explica como ela é calculada.',
      },
      {
        p: 'Por que uma build diz «Dados limitados»?',
        r: `Porque se baseia em menos de ${PARTIDAS_DATOS_LIMITADOS} partidas. Serve como orientação, mas a amostra é pequena e a taxa de vitória pode mudar bastante com poucas partidas a mais.`,
      },
      {
        p: 'As builds servem no servidor BR?',
        r: 'Sim: elas dependem do campeão, da rota e do patch, não do servidor em que você joga.',
      },
    ],
    cta: 'Baixe o app e veja a build do seu campeão na próxima seleção.',
  },

  guias: {
    antetitulo: 'Guias',
    h1: 'Guias de League of Legends',
    intro:
      'Guias curtos e práticos sobre overlays, tier lists e runas, escritos pela equipe do Coach LoL IA. Explicamos como as coisas funcionam, sem promessas de subir de elo.',
    otras: 'Mais guias',
    articulos: {
      guiaOverlay: {
        resumen: 'O que a Riot permite a um overlay, quais sinais de alerta observar e como configurá-lo bem.',
        h1: 'Como usar um overlay no LoL com segurança',
        entradilla:
          'Um overlay de League of Legends é uma janela desenhada por cima do jogo para mostrar informações: sua build, os tempos dos objetivos ou seu CS. Bem feito, ele respeita as regras da Riot. Mal feito, pode colocar sua conta em risco. Este guia te ajuda a diferenciar um do outro.',
        secciones: [
          {
            h: 'O que é um overlay e o que não é',
            p: [
              'Um overlay legítimo é uma janela normal do Windows, transparente e com cliques que passam direto, colocada por cima do jogo. Ele não faz parte do jogo nem o modifica: só desenha informações na sua tela.',
              'Para aparecer, o LoL precisa estar no modo **Sem bordas** (Opções → Vídeo → Modo de janela). Em tela cheia exclusiva, o Windows desenha o jogo por cima de qualquer outra janela.',
            ],
          },
          {
            h: 'O que a Riot permite aos apps de terceiros',
            p: [
              'A Riot publica interfaces oficiais para ferramentas de terceiros: a **LCU API** do cliente (seleção de campeões, runas, itens), a **Live Client Data API** da partida (em `127.0.0.1:2999`, somente leitura) e serviços públicos como o Data Dragon. Um app que usa só essas vias trabalha com dados que a Riot decide compartilhar.',
              'Além disso, as políticas da Riot limitam o que pode ser mostrado. Em geral, um overlay não deve te dar informação que você não teria jogando sem ele: nada de timers de feitiços ou ultimates inimigas, nem posições de inimigos que você não vê, nem decisões que joguem por você.',
            ],
          },
          {
            h: 'Sinais de alerta',
            lista: [
              'Lê a **memória do jogo** ou injeta código ou DLL no processo.',
              'Mostra **tempos de recarga inimigos**, posições fora da sua visão ou timers da selva inimiga.',
              '**Simula teclado ou mouse**, ou automatiza ações como desviar ou usar habilidades.',
              'Analisa **capturas de tela** ou do minimapa para tirar informação.',
              'Pede sua **senha da Riot** ou promete ser «indetectável».',
            ],
          },
          {
            h: 'Checklist antes de instalar um overlay',
            lista: [
              'Diz claramente quais APIs usa e o que não faz com o jogo.',
              'Não pede credenciais: o cliente já está aberto no seu PC.',
              'Explica na política de privacidade quais dados envia aos servidores.',
              'Inclui o aviso legal da Riot e não se apresenta como produto oficial.',
              'Você pode esconder ou desligar cada parte a qualquer momento.',
            ],
          },
          {
            h: 'Como o Coach LoL IA faz',
            p: [
              'O Coach LoL IA usa só a LCU API, a Live Client Data API e o Data Dragon. Não lê nem escreve a memória do jogo, não injeta código, não tira capturas para analisar e não simula teclas nem cliques. Os timers da selva são só do seu lado e você mesmo marca, e do caçador inimigo ele só repete o que já aparece no feed de abates.',
              'Mesmo assim, a última palavra sobre ferramentas de terceiros é sempre da Riot. Por isso revisamos cada aviso de acordo com a política vigente e recomendamos que você faça o mesmo com qualquer app que instalar. [Ver a seção de segurança](@inicio#seguridad).',
            ],
          },
          {
            h: 'Configure para não atrapalhar',
            lista: [
              'Coloque o jogo no modo **Sem bordas**.',
              'Na tela Overlay do app, use **«Mover e calibrar»** para colocar cada widget onde não cubra a HUD.',
              'Diminua a opacidade ou desligue os widgets que não usa.',
              'Durante a partida, **Ctrl+Shift+O** esconde ou mostra o overlay.',
            ],
          },
        ],
      },
      guiaTierList: {
        resumen: 'O que significa cada tier, como é calculado e por que o número de partidas importa.',
        h1: 'O que é uma tier list no LoL e como ler',
        entradilla:
          'Uma tier list ordena os campeões de League of Legends pelo quanto eles rendem no patch atual, normalmente em letras: S, A, B, C. É uma ferramenta útil para escolher ou descobrir campeões, desde que você saiba de onde vêm os dados e o que ela não diz.',
        secciones: [
          {
            h: 'O que significa cada tier',
            p: [
              'Não existe um padrão oficial, mas quase todas seguem a mesma ideia: **S** são os campeões que mais se destacam na rota, **A** escolhas muito sólidas, **B** campeões equilibrados e **C** os que hoje têm mais dificuldade. Algumas adicionam S+ ou D.',
              'O importante é que o tier é **por rota**: um campeão pode ser S na jungle e B no top.',
            ],
          },
          {
            h: 'Como é calculada',
            p: [
              'As tier lists baseadas em dados combinam principalmente dois números: a **taxa de vitória** (quantas partidas o campeão vence naquela rota) e a **taxa de escolha** ou *pick rate* (quantas vezes ele é escolhido). Algumas adicionam a taxa de banimento ou o desempenho em elos altos.',
              'Outras tier lists são **de opinião**: um jogador ou uma equipe faz com base na experiência. Não são ruins, mas vale saber qual você está lendo.',
            ],
          },
          {
            h: 'Por que o número de partidas importa',
            p: [
              'Uma taxa de vitória de 60 % em 20 partidas diz pouco: com mais algumas derrotas pode cair para 50 %. Uma de 52 % em milhares de partidas é muito mais confiável. Por isso uma boa tier list mostra a amostra, ou pelo menos não deixa um campeão com poucos dados chegar ao topo.',
              'Também importa **quais partidas**: um campeão não rende igual no Ferro e no Esmeralda+, e um patch novo pode mudar tudo de um dia para o outro.',
            ],
          },
          {
            h: 'Como usar sem cair em armadilhas',
            lista: [
              'Olhe para a **sua rota** e o **patch atual**.',
              'Um campeão tier B que você domina costuma render mais que um tier S que você não conhece.',
              'Use para descobrir campeões e para saber o que está forte contra você.',
              'Desconfie de números sem quantidade de partidas.',
            ],
          },
          {
            h: 'A tier list do Coach LoL IA',
            p: [
              'Na seção Campeões do app, cada campeão recebe um tier S, A, B ou C por rota e por modo (Ranqueada, ARAM, ARAM: Caos e Arena) que combina taxa de vitória e de escolha, com partidas de jogadores Esmeralda+ em EUW, LAN e LAS. Os que têm menos de 30 partidas nunca passam do B e levam o aviso «Dados limitados». [Mais detalhes sobre os dados](@builds).',
            ],
          },
        ],
      },
      guiaCoach: {
        resumen: 'O que um coach com IA faz, o que ele não pode fazer e como aproveitar ao máximo.',
        h1: 'Coach de LoL com IA: como usar para melhorar',
        entradilla:
          'Um coach de League of Legends com IA olha os dados das suas partidas e diz o que melhorar, no seu idioma e sem esperar alguém assistir aos seus replays. Ele não joga por você nem faz milagres, mas bem usado te ajuda a enxergar os erros que você repete. Este guia explica como funciona e como aproveitar ao máximo.',
        nota: 'Feito com ajuda de IA.',
        secciones: [
          {
            h: 'O que é um coach com IA para LoL',
            p: [
              'Um coach humano assiste às suas partidas e diz o que mudar. Um coach com IA faz algo parecido com os dados que a própria partida gera: seu CS por minuto, suas mortes, suas compras, os objetivos e a diferença de ouro para o seu rival. Um modelo de linguagem transforma esses números em conselhos concretos no seu idioma.',
              'A vantagem é a constância: ele está disponível depois de cada partida, não cansa e não te julga. O limite é que só vê o que os dados dizem: não vê o seu posicionamento nem o que acontece no chat.',
            ],
          },
          {
            h: 'O que ele pode fazer durante a partida (e o que não)',
            p: [
              'Na partida, um coach legítimo só usa as informações que a Riot compartilha com apps de terceiros, as mesmas que você vê na tela. Com elas, ele lembra o que é fácil esquecer: quando nasce o próximo dragão, qual item comprar ou que o seu rival de rota morreu e é uma boa hora para empurrar.',
              'O que ele nunca deve fazer é te dar informação oculta (recargas inimigas, posições que você não vê) nem jogar por você. Se um app promete isso, desconfie: explicamos no [guia de overlay com segurança](@guiaOverlay).',
            ],
          },
          {
            h: 'A análise no fim da partida',
            p: [
              'É no fim que você mais aprende. Uma boa análise não recita todas as estatísticas: escolhe as duas ou três coisas que mais te custaram a partida e diz o que fazer diferente da próxima vez. Por exemplo: “você perdeu muito CS entre os minutos 10 e 15 por voltar para a base sem empurrar a wave”.',
              'Depois você pode perguntar o que não entendeu: por que essa build, como jogar contra um campeão específico ou o que fazer quando está atrás.',
            ],
          },
          {
            h: 'Como aproveitar ao máximo',
            lista: [
              '**Escolha um único objetivo por sessão**, como o CS ou não morrer antes do minuto 10, e foque só nesse conselho.',
              '**Leia a análise logo ao terminar**, enquanto ainda lembra da partida.',
              '**Procure padrões**: se o mesmo conselho se repete em várias partidas, esse é o seu ponto fraco.',
              '**Faça perguntas concretas**: “como jogo de Ahri contra Zed?” rende respostas melhores que “como melhoro?”.',
              '**Confira nos seus replays** quando algo não fizer sentido: a IA também erra.',
            ],
          },
          {
            h: 'O que um coach com IA não substitui',
            p: [
              'Ele não substitui jogar com calma, revisar seus replays nem um coach humano se você quer competir a sério. Também não garante subir de elo: mostra o que melhorar, mas o trabalho é seu.',
              'E como toda resposta gerada por IA, pode conter erros. Use como uma segunda opinião, não como uma ordem.',
            ],
          },
          {
            h: 'Como o Coach LoL IA faz isso',
            p: [
              'O Coach LoL IA junta as duas partes. Durante a partida, um overlay e uma voz te avisam dos objetivos, da próxima compra e de quando empurrar ou voltar para a base. No fim, a IA analisa a sua partida e você pode fazer perguntas. Tudo com as APIs oficiais da Riot.',
              'Tudo o que te ajuda durante a partida é grátis. A análise com IA e as perguntas têm uma cota grátis por mês (3 análises e 5 perguntas) e planos para quem quiser mais. [Ver como funciona](@inicio#como-funciona).',
            ],
          },
        ],
      },
      guiaRunas: {
        resumen: 'Runas, feitiços e itens em um clique na seleção de campeões, sem perder suas páginas.',
        h1: 'Como importar runas automaticamente no LoL',
        entradilla:
          'Montar as runas em cada seleção de campeões leva tempo, ainda mais se você troca de campeão em cima da hora. Com um app que usa a API oficial do cliente, dá para importar runas, feitiços e itens em um clique. Veja como fazer com o Coach LoL IA.',
        secciones: [
          {
            h: 'Como a importação funciona',
            p: [
              'O cliente de League of Legends tem uma API local, a **LCU API**, que a Riot disponibiliza para ferramentas de terceiros. Por ela, um app pode criar páginas de runas, escolher feitiços de invocador e adicionar conjuntos de itens à loja, como você faria à mão.',
              'O Coach LoL IA se conecta lendo o arquivo *lockfile* do cliente (porta e senha locais). Ele nunca pede sua conta nem sua senha da Riot.',
            ],
          },
          {
            h: 'Passo a passo',
            ordenada: true,
            lista: [
              '[Baixe o Coach LoL IA](@descargar) e instale no Windows 10 ou 11.',
              'Abra o app e o cliente de LoL, em qualquer ordem. O app detecta o cliente sozinho.',
              'Entre na seleção de campeões. O app reconhece seu campeão e a rota que o cliente te atribui.',
              'Confira a build: runas (você pode escolher entre várias páginas), feitiços, itens e ordem de habilidades.',
              'Clique em **«Importar»**. Se preferir não mexer em nada, ative a importação automática em Ajustes.',
            ],
          },
          {
            h: 'Suas páginas de runas estão a salvo',
            p: [
              'O app cria as próprias páginas com o prefixo **«Coach:»**, por exemplo «Coach: Ahri Meio», e substitui a dele se já existir. Se você não tiver nenhuma livre, ele só substitui uma das suas quando você clica em «Importar» e confirma (nunca uma predefinida); a importação automática nunca apaga nada.',
            ],
          },
          {
            h: 'Se algo não funcionar',
            lista: [
              '**«Aguardando o cliente de League of Legends…»**: abra o cliente; o app tenta de novo a cada 3 segundos.',
              '**«Build indisponível»**: há menos de 10 partidas desse campeão nessa rota. Tente outra rota ou espere a próxima atualização.',
              '**A página não é criada**: verifique se você tem uma página livre ou uma página «Coach:» que possa ser substituída.',
              'Se continuar falhando, pergunte ao assistente IA ou escreva para support@coachlolia.com.',
            ],
          },
          {
            h: 'Fazer à mão também vale',
            p: [
              'Se preferir não instalar nada, você pode copiar a build à mão no cliente: crie uma página de runas, escolha os feitiços e compre seguindo a ordem de itens. A importação só economiza esse tempo na seleção de campeões.',
            ],
          },
        ],
      },
    },
  },

  noEncontrada: {
    h1: 'Página não encontrada',
    texto: 'A página que você procura não existe ou mudou de endereço.',
    volver: 'Ir para o início',
    otros: 'Outros idiomas',
  },
};
