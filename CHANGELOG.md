# CHANGELOG - PandaNet

Documento de registro de todas as alterações notáveis feitas no projeto PandaNet.

---

Versão 1.1.6 beta
19/06/2026
🗞️ Nota de Atualização - PandaNet v1.1.6 Beta
Esta grande atualização traz novas ferramentas de colaboração (Compartilhamento de Agendas e Barra de Presença), automações e inteligência avançada no WhatsPanda, além de polimentos estéticos e correções críticas no Modo Escuro e RH.

🚀 O que há de novo?

📅 Compartilhamento de Agenda Cooperativo
- Conceda e Revoque Acesso: Novo modal de configurações permitindo selecionar com quais colegas de equipe compartilhar seu calendário.
- Visualização Compartilhada: Dropdown de seleção de agendas de terceiros no topo da página.
- Agendamento Direto: Permissão para adicionar compromissos diretamente na agenda compartilhada do colega.
- Privacidade Garantida: Ocultação automática de eventos privados (`is_private = true`) e tarefas pessoais para outros colaboradores.

🐼 WhatsPanda Avançado & Triagem IA (Gemini)
- Templates de Chatbot Prontos: Lançamento do template dinâmico "Restaurante / Delivery" com fluxos funcionais.
- Controle de Expediente Complexo: Configuração de horários de atendimento detalhados por dia da semana e setor (filas).
- Triagem Inteligente: O Gemini analisa mensagens recebidas e, sabendo quais setores estão abertos ou fechados no momento (horário de Brasília), evita a transferência para setores inativos.
- Toggle Rápido e Salvar Fluxo: Construtor visual de fluxos com toggle de ativação e botão de salvamento persistente.

💬 Barra de Presença & Chat Flutuante (Chat Heads)
- Lista Realtime de Contatos: Barra lateral direita dinâmica listando colaboradores online (bolinha verde) e offline.
- Status Customizado: Defina uma frase personalizada na sua página de Perfil que será exibida para toda a empresa na barra lateral de presença.
- Popover de Ações Rápidas: Clique em um contato para conversar (abrindo balão flutuante estilo Facebook de forma global) ou silenciá-lo.

🎨 Destaques da Home & Modo Escuro
- Reestruturação de Destaques: A página inicial agora exibe três blocos independentes (Vídeos da Empresa em carrossel, Projetos participados e anúncios do Marketplace).
- Contraste Aprimorado no Dark Mode: Correções de CSS globais para garantir alta legibilidade de textos secundários, inputs e enquetes sob a classe `.dark`.

📋 Recursos de RH (Competências e Ausências com Atestado)
- Competências Customizadas: Permite que administradores definam até 10 competências da empresa. Notas de 1 a 10 + N/A com média calculada corretamente no gráfico de barras do colaborador.
- Upload de Atestados Médicos: Solicitação de ausência com anexo de atestado (PDF/Imagem) salvo com segurança no bucket `hr-files`.

---

Versão 1.1.5 beta teste
18/06/2026
🗞️ Nota de Atualização - PandaNet v1.1.5 Beta Teste
Esta atualização foca em usabilidade, correções de bugs visuais no WhatsPanda, melhorias importantes de responsividade em telas menores e a nova visualização semanal no Calendário.

🚀 O que há de novo?

📅 Visualização Semanal (WeekView) no Calendário
- Nova Visão Semanal: Adicionada a opção "Semana" ao cabeçalho do Calendário.
- Navegação Avançada: Navegue semana a semana de forma fluida.
- Distribuição Inteligente: Exibição limpa de reuniões, feriados, tarefas e aniversários distribuídos nos 7 dias da semana corrente.

🎨 Melhorias Visuais e de Responsividade no WhatsPanda
- Correção de Fontes e Bold: Removido o peso excessivo em fontes do WhatsPanda, forçando o uso da fonte padrão Arial/sans-serif. Isso elimina cortes de palavras e textos em colunas e menus de conversas.
- Gemini API Key Sem Extravasamento: Ajustado o input e botão "Salvar Chave" do Google Gemini nas configurações do Chatbot para empilhar em telas de celular, sem quebrar o layout.
- Tabelas Responsivas: As tabelas e modais de Usuários, Setores (Filas) e Etiquetas agora têm suporte a rolagem horizontal suave (`overflow-x-auto`) e ajuste automático de largura no mobile.

🛡️ Correção do Menu de Usuário (Z-Index)
- Visibilidade Sempre no Topo: Aumentado o z-index do menu dropdown do cabeçalho (onde estão Notas Rápidas, Tarefas, etc.) para que ele nunca fique por trás das informações do cliente no WhatsPanda ou outras janelas da intranet.

⚡ Resolução de Erros do Console (Estabilidade)
- Sem Promessas Rejeitadas (403): Adicionado tratamento de erros nas consultas à tabela `whatsapp_channel_users` e ao arquivo de som de notificações (`notification_sound`), limpando o console do desenvolvedor.

---

Versão 1.1.3 beta
01/06/2026
🗞️ Nota de Atualização - PandaNet v1.1.3 Beta
Esta atualização traz o novo e revolucionário módulo de Agendamentos, além de melhorias no gerenciamento de projetos e correções essenciais de usabilidade e segurança.

🚀 O que há de novo?

📅 Módulo de Agendamentos
Integramos um sistema profissional de agendamento de horários:
- Configuração de Agendas: Crie links para reuniões ou eventos definindo duração, descrição e disponibilidade.
- Agendamento Pago: Suporte a agendamentos pagos com simulação integrada de checkout via Pix (QR Code e Copia e Cola).
- Links Públicos de Reserva: Compartilhe o link da sua agenda para que convidados externos escolham o melhor horário sem precisar de login.
- Confirmações via E-mail: Dispare e-mails automáticos ao aprovar reservas, usando modelos de e-mail customizados e dinâmicos (placeholders como {guest_name}, {booking_date}, etc.).
- Controle de Acesso: Apenas o anfitrião e os administradores da empresa têm acesso às configurações e reservas.

📊 Painel de Projetos Aprimorado
- Planejamento e Kanban: Melhorias na navegação de cartões, timesheets e métricas de projetos.
- Visibilidade e Controle: Acesso integrado ao calendário de projetos diretamente no menu lateral.

🛡️ Correções de Segurança e Perfil
- Exclusão de Usuários Segura: Correção dos erros de chave estrangeira que impediam a exclusão de perfis (nudges, mensagens, reply_to agora são tratados de forma limpa).
- Gestão de Avatares: Novo fluxo de criação de usuários sem imagens aleatórias automáticas (pravatar), exibindo círculos de iniciais organizados e limpos.

---

Versão 1.1.2 beta
07/04/2026
🗞️ Nota de Atualização - PandaNet v1.1.2 Beta
Esta atualização marca um salto gigantesco na individualidade e eficiência do ecossistema WhatsPanda, além de uma limpeza profunda para garantir a máxima performance da plataforma.

🚀 O que há de novo?

🐼 WhatsPanda 2.0: Conexão Individual (1:1)
O WhatsPanda foi totalmente refatorado para o modelo 1:1. Agora, cada usuário é dono da sua própria conexão, eliminando a complexidade de atendimentos compartilhados e filas de espera.
- Conexão por Usuário: Cada colaborador pode conectar seu próprio WhatsApp individualmente através do menu "Canais".
- Isolamento Total: Suas conversas, seus contatos. Foco total na privacidade e agilidade.

🎨 Nova Interface de Chat (3 Colunas)
Redesenhamos a experiência de conversa com um layout de 3 colunas premium, inspirado nas melhores ferramentas de CRM do mercado:
- Coluna 1: Lista de conversas ultra-rápida.
- Coluna 2: Janela de chat limpa e focada.
- Coluna 3 (Painel do Contato): Um centro de comando lateral sempre visível para gestão rápida.

📋 CRM de Contato Integrado
Transformamos a barra lateral do chat em um poderoso assistente de gestão:
- Notas Internas: Bloco de notas persistente para cada contato. Nunca mais perca detalhes importantes de uma negociação.
- Etapas do Kanban: Mova o contato entre as etapas do seu funil de vendas diretamente pela conversa, com um clique.
- Gestão de Etiquetas: Adicione ou remova tags visuais instantaneamente para organizar seu fluxo.

🛡️ Modo Ghost: "Invisibilidade Real"
Aprimoramos o sistema de auditoria para garantir que supervisores possam monitorar sem deixar qualquer rastro:
- Zero Trace: Visualizações em modo Ghost não marcam mensagens como lidas no banco de dados.
- Bloqueio de Ações: Campos de texto e botões de envio são ocultados automaticamente em modo auditoria, evitando o envio acidental de mensagens pelo auditor.

⚡ Permissões de Nudge (Chamar Atenção)
Mais controle para administradores sobre o recurso de "Shaking":
- Permissão Granular: Defina individualmente quais usuários podem "Chamar a Atenção".
- Cooldown Personalizado: Configure o tempo de espera (em segundos) entre cada Nudge por usuário, evitando o uso excessivo do recurso.

🧹 Simplificação e Performance
- Remoção do CRM Legado: Eliminamos completamente centenas de linhas de código do antigo módulo de vendas (Leads, Faturas, Kanban antigo) para garantir que o PandaNet rode mais leve do que nunca.
- Interface Limpa: Removemos abas desnecessárias de configurações (Usuários e Filas) para simplificar a navegação.

Nota: Esta é uma versão Beta focada em produtividade individual. Se encontrar qualquer comportamento inesperado, por favor, reporte à equipe técnica.

PandaNet - Sua comunicação, sua segurança. 🐼🚀

---

Versão 1.1.1 beta
26/02/2026
🗞️ Nota de Atualização - PandaNet v1.1.1 Beta
Estamos orgulhosos de anunciar a versão 1.1.1 Beta do PandaNet! Esta atualização é um marco em segurança, usabilidade e robustez para o seu ecossistema de comunicação.

🚀 O que há de novo?
👥 Gerenciamento de Contatos (PandaMail)
Novo Diretório de Contatos: Uma interface moderna e rápida para gerenciar seus e-mails frequentes.
Ações Rápidas: Envie e-mails para seus contatos com um único clique no botão "Escrever".
Cadastro Simplificado: Adicione novos contatos manualmente com um formulário fixo e intuitivo.
Autocomplete Inteligente: Sugestões automáticas baseadas em seus contatos ao redigir mensagens.

📎 Sistema de Anexos Profissional
Limite de 20MB: Agora você pode enviar documentos, imagens e arquivos pesados com segurança.
Área de Opções e Anexos: Uma nova seção dedicada na tela de composição com interface de arrastar e soltar (estilizada).
Validação Automática: O sistema avisa instantaneamente se um arquivo for grande demais, evitando erros de envio.
Remoção Fácil: Organize seus anexos antes de enviar com a lista de pré-visualização.

🛠️ Melhorias de UI e Experiência
Scroll Inteligente: A tela de composição agora possui uma área de rolagem independente. Mesmo em conversas longas, o botão "Enviar" sempre estará acessível e visível.
Modo Tela Cheia: Melhor visibilidade para leitura de e-mails complexos.
Persistência de Leitura: Correção no status de e-mails lidos/não lidos.

🛡️ Nível de Segurança: "Escudo Total"
Hoje implementamos três camadas de proteção que tornam o PandaNet um dos ambientes mais seguros da categoria:

1. Proteção Perimetral (Cloudflare)
Escudo Anti-DDoS: O PandaNet agora está atrás do firewall global da Cloudflare. Ataques de negação de serviço (DDoS) são filtrados antes mesmo de chegarem ao seu servidor.
Ocultação de IP: Seu servidor agora é invisível para o mundo externo. Isso impede que hackers tentem ataques diretos ao seu hardware.
SSL Avançado: Criptografia de ponta a ponta reforçada.

2. Proteção de Acesso (Fail2Ban)
Anti-Brute Force: Implementamos uma vigilância ativa no terminal do servidor.
Banimento Automático: Se alguém tentar adivinhar sua senha de acesso e errar 5 vezes, o IP do invasor é bloqueado automaticamente por 1 hora.

3. Segurança no Código (BFF & JWT)
Autenticação JWT: Todos os comandos do WhatsApp e E-mail agora exigem tokens de segurança criptografados.
Proteção contra 401 (Unauthorized): Refizemos a lógica de autenticação do backend para garantir que o acesso nunca seja perdido após reinicializações do servidor.
Headers de Segurança (Helmet): Proteção nativa contra XSS, Clickjacking e outras vulnerabilidades web comuns.

📦 Manutenção e Robustez
Log Rotation: Sistema automático que impede que o disco do servidor fique cheio com arquivos de log antigos. Sua máquina agora "se limpa" sozinha.
Build Otimizado: O tempo de atualização do sistema foi reduzido em mais de 70% com a nova política de build.

---

Versão 1.1.0
20/02/2026
🚀 Grande Atualização: Nova Experiência e Recursos
Olá! Temos o prazer de anunciar uma série de melhorias e novos recursos que acabam de chegar à PandaNet. Nossa missão é facilitar o seu dia a dia com uma plataforma mais completa, bonita e acessível.

📧 Chegou o PandaMail!
Agora você pode gerenciar seus e-mails corporativos diretamente dentro da PandaNet.

Integração Total: Conecte sua conta de e-mail e leia/envie mensagens sem sair da plataforma.
Configuração Simplificada: Suporte para os principais servidores de e-mail com segurança reforçada.

🌗 Temas Claro e Escuro
Escolha a aparência que melhor se adapta ao seu ambiente de trabalho e conforto visual.
Modo Escuro: Uma interface moderna em tons de cinza e azul escuro, ideal para reduzir o carsaço visual em ambientes com pouca luz.
Modo Claro: Um visual limpo, vibrante e clássico para o seu dia a dia.

🌎 Suporte Multi-idiomas
A PandaNet agora fala a sua língua!
Tradução Completa: Toda a interface está preparada para suportar diferentes idiomas (Português, Inglês e Espanhol).

✨ Branding e Visual Corrigido
Logotipo Restaurado: Corrigimos a exibição da logo na barra lateral, garantindo que a identidade da sua empresa esteja sempre visível e profissional.
Navegação Fluida: Ajustamos menus e ícones para uma experiência mais intuitiva e rápida.
