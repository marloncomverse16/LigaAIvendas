# LigAI Dashboard - Projeto de Gestão de Leads WhatsApp

## Visão Geral

Dashboard português interativo para gestão de leads e negócios via WhatsApp, com sistema completo de autenticação, multi-tenant, e integração com APIs WhatsApp Business Cloud e Evolution API.

### Funcionalidades Principais
- Sistema de autenticação completo (login/registro)
- Dashboard principal com métricas de negócio
- Gestão de leads e recomendações inteligentes  
- Módulo de prospecção com upload de arquivos CSV/Excel
- Sistema de envio de mensagens WhatsApp
- Conectividade dupla: QR Code (Evolution API) e Meta Cloud API
- Gestão de agentes de IA com comportamentos personalizados
- Relatórios Meta API com custos em BRL
- Sistema de metas e acompanhamento de performance
- Upload de mídia (PDF/CSV) com armazenamento no servidor
- Isolamento completo de dados multi-tenant
- **NOVO**: Sistema automático de encaminhamento de webhook WhatsApp Cloud para agentes IA

## Arquitetura do Projeto

### Estruturas de Dados Principais
- **Usuários**: Sistema de autenticação com roles (admin/user)
- **Servidores**: Configuração de APIs WhatsApp (Evolution/Meta)
- **Leads**: Gestão de contatos e prospecção
- **Agentes IA**: Configuração de comportamentos e webhooks
- **Relatórios**: Métricas Meta API e Evolution API
- **Mensagens**: Histórico de comunicações WhatsApp

### Tecnologias
- **Frontend**: React + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript + Drizzle ORM
- **Banco**: PostgreSQL com isolamento multi-tenant
- **Autenticação**: Passport.js com sessões
- **APIs**: WhatsApp Business Cloud API + Evolution API
- **Upload**: Multer com armazenamento local
- **WebSocket**: Comunicação tempo real

## Mudanças Arquiteturais Recentes

### 2025-06-17 - Sistema de Webhook Automático WhatsApp Cloud COM IDENTIFICAÇÃO COMPLETA DO USUÁRIO
- **Implementado sistema de encaminhamento automático** de mensagens WhatsApp Cloud para agentes IA
- **Arquivo criado**: `server/api/meta-webhook.ts` com funções:
  - `saveIncomingMessage()`: Salva mensagem e encaminha para IA
  - `findUserByPhoneNumberId()`: Identifica usuário pelo phone_number_id e busca agente específico
  - `forwardMessageToAI()`: Envia payload padronizado para webhook do agente
- **Rotas adicionadas** em `server/routes.ts`:
  - `GET /api/meta-webhook`: Verificação do webhook Meta
  - `POST /api/meta-webhook`: Recepção de mensagens WhatsApp Cloud
- **Fluxo automático COMPLETO**: WhatsApp Cloud → Meta Webhook → Identificação Usuário → Busca Agente Específico → Encaminhamento para Agente IA
- **Correção crítica**: Sistema agora busca o agente específico associado ao usuário via `user_ai_agents` + `server_ai_agents`
- **Associação usuário-agente**: Criada entrada na tabela `user_ai_agents` para conectar usuário admin ao "Agente 02"
- **Query SQL corrigida**: JOIN entre `user_servers`, `user_ai_agents` e `server_ai_agents` para isolamento correto
- **Teste confirmado**: Webhook encaminha corretamente para URL do "Agente 02" específico do usuário
- **Isolamento por usuário** baseado no phone_number_id configurado + agente específico
- **NOVO: Identificação completa do usuário no payload**:
  - `user_id`: ID numérico do usuário
  - `user_name`: Nome completo do usuário (campo name da tabela users)
  - `user_username`: Username do usuário
  - Headers HTTP: `X-User-ID` e `X-User-Name` enviados para o agente
  - Metadados: `userId`, `userName`, `userUsername` incluídos na seção metadata
- **Função aprimorada**: `findUserByPhoneNumberId()` agora retorna informações completas do usuário
- **Payload estruturado**: Agentes IA recebem identificação completa do usuário para contexto personalizado
- **Teste validado**: Webhook processando mensagens com informações completas do usuário incluindo nome

### 2025-06-17 - Correção Isolamento de Dados
- **Problema resolvido**: Isolamento de dados nas páginas de contatos e relatórios
- **Implementação**: Filtros WHERE user_id = $1 em todas as rotas de relatórios
- **Páginas corrigidas**: Contatos e Relatórios com mensagens adequadas para novos usuários
- **Detecção automática** de usuários novos sem configuração
- **Rotas verificadas**: Meta e QR reports com isolamento adequado

### 2025-06-11 - Configuração Multi-tenant Completa
- **Sistema multi-tenant** funcionando completamente
- **Isolamento de dados** por usuário em todas as tabelas
- **Gestão de servidores** com relações usuário-servidor
- **Conexões Meta API** específicas por usuário
- **Configuração de webhooks** individualizados

## Preferências do Usuário

### Comunicação
- **Idioma**: Português brasileiro em todas as respostas
- **Estilo**: Direto, técnico quando necessário, sem emojis excessivos
- **Feedback**: Sempre confirmar quando tarefas importantes são concluídas

### Desenvolvimento
- **Padrão**: TypeScript strict, Drizzle ORM, isolamento multi-tenant
- **Segurança**: Validação rigorosa de dados, sanitização de inputs
- **Performance**: Queries otimizadas, cache quando apropriado
- **Logs**: Detalhados para debugging, especialmente webhooks e APIs

## Estado Atual do Sistema

### Funcionalidades Operacionais
✅ Autenticação e gestão de usuários  
✅ Dashboard com métricas calculadas  
✅ Prospecção com upload CSV/Excel  
✅ Envio de mensagens WhatsApp (ambos métodos)  
✅ Relatórios Meta API com custos BRL  
✅ Gestão de agentes IA  
✅ Isolamento completo multi-tenant  
✅ **Sistema automático de webhook WhatsApp Cloud → Agente IA**

### Integrações Ativas
- WhatsApp Business Cloud API (Meta)
- Evolution API para QR Code
- Cloudinary para upload de mídia
- PostgreSQL para persistência
- **Webhook automático** para agentes IA

### Próximas Melhorias Sugeridas
- Expandir webhook automático para outros tipos de mídia
- Implementar retry automático em webhooks
- Métricas de performance dos encaminhamentos
- Interface de monitoramento de webhooks

## Configuração de Ambiente

### Variáveis Necessárias
```
DATABASE_URL=postgresql://...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
EVOLUTION_API_TOKEN=...
META_WEBHOOK_VERIFY_TOKEN=...
```

### Webhooks Configurados
- **Meta Webhook**: `/api/meta-webhook` (GET/POST)
- **Evolution Webhook**: `/webhook/find/:instance` (GET)
- **Agentes IA**: Configurados individualmente por servidor

---

### 2025-06-24 - Correção Token WhatsApp Cloud API
- **Problema identificado**: Discrepância entre tokens armazenados nas tabelas `users`, `settings` e `servers`
- **Token correto**: EAA6rwPJFpjIBOxGSjZCZBhCrtZAfM0YlnIS9zWjS7FqjKwl1dWXQ6... (salvo em Configurações)
- **Token incorreto**: EAA6rwPJFpjIBO1VnsRil4Mqu1N1hdB0R4CrcYZBVqiaX7tAD55JX6... (antigo em múltiplas tabelas)
- **Solução aplicada**: Sincronização do token correto em todas as três tabelas
- **Tabelas corrigidas**: `users.whatsapp_api_token`, `settings.whatsapp_meta_token`, `servers.whatsapp_meta_token`
- **Resultado**: Sistema agora usa consistentemente o token válido em todos os módulos
- **Templates Meta API**: Busca de templates corrigida e funcionando com 3 templates aprovados carregados
- **Configurações por usuário**: Sistema agora garante que cada usuário use suas próprias configurações da tabela settings
- **Autenticação obrigatória**: Todas as rotas de templates agora exigem autenticação e usam credenciais específicas do usuário

### 2025-06-24 - Correção Sistema de Agendamento de Mensagens
- **Problema**: Limitação de agendamento para 1 dia a partir da data atual
- **Solução frontend**: Correção do componente Calendar para permitir agendamento a partir da data/hora atual
- **Solução backend**: Atualização da validação para permitir agendamento com margem de 1 minuto de tolerância
- **Validação inteligente**: Se agendamento for para hoje, verifica se horário é futuro; se for outra data, permite qualquer horário
- **Schema corrigido**: Validação Zod atualizada para aceitar datas futuras a partir do momento atual
- **Resultado**: Usuários podem agendar mensagens a partir do momento atual sem limitação de 1 dia

### 2025-06-24 - Correção Seleção de Templates Meta API
- **Problema**: Template "Modelo_de_teste_ligai" não selecionava quando clicado
- **Causa**: Conflito de tipos entre IDs de templates Meta API (string) e templates locais (number)
- **Solução**: Atualização do Select para tratar tipos diferentes conforme o tipo de conexão
- **Schema atualizado**: templateId agora aceita string ou number usando z.union()
- **Lógica corrigida**: Meta API usa IDs como string, templates locais como number
- **Resultado**: Todos os templates Meta API agora selecionam corretamente

### 2025-06-24 - Correção Erro "realLeadsCount is not defined"
- **Problema**: Variável `realLeadsCount` não definida ao agendar envio Meta API
- **Causa**: Variável usada mas não declarada no código de envio
- **Solução**: Substituída por `totalRecipients` baseado na quantidade solicitada
- **Código corrigido**: Definição de `totalRecipients = data.quantity || 10`
- **Resultado**: Agendamento de envios Meta API funciona sem erro

### 2025-06-24 - Sistema de Agendamento Meta API Implementado
- **Problema**: Sistema enviava mensagens imediatamente ao invés de agendar
- **Solução**: Criação de sistema duplo de envio (imediato vs agendado)
- **Rota nova**: `/api/meta-schedule-send` para agendamentos
- **Lógica frontend**: Detecta se há data/hora e escolhe endpoint adequado
- **Agendamento**: Usa setTimeout para executar na data/hora especificada
- **Status tracking**: "agendado" → "em_andamento" → "concluido"
- **Resultado**: Envios executam na data/hora correta quando agendados

### 2025-06-24 - Remoção Completa de Campos de Perfil
- **Solicitação do usuário**: Remover campos Nome, Email, Telefone, Empresa e Sobre da seção "Configurações - Perfil e Conta"
- **Frontend atualizado**: Campos removidos do formulário em `client/src/pages/settings-page.tsx`
- **Schema simplificado**: `profileSchema` agora vazio, sem validações de campos pessoais
- **Interface limpa**: Seção mostra mensagem explicativa sobre simplificação
- **Backend atualizado**: Rota `/api/profile` retorna apenas dados básicos (id, username, isAdmin)
- **Aplicado globalmente**: Alteração afeta todos os usuários do sistema
- **Compatibilidade mantida**: Funções antigas mantidas para evitar quebras

### 2025-06-24 - Correção Sistema de Agendamento Robusto
- **Problema**: setTimeout não funcionava em ambiente servidor que pode reiniciar
- **Solução**: Sistema de scheduler robusto com verificação periódica
- **Implementação**: Classe MessageScheduler com singleton pattern
- **Verificação**: A cada 30 segundos verifica envios pendentes para executar
- **Execução real**: Envios agendados agora executam disparos reais via Meta API
- **Confiabilidade**: Sistema funciona mesmo com reinicializações do servidor
- **Resultado**: Agendamentos executam corretamente na data/hora especificada

### 2025-06-24 - Sistema Completo de Rastreamento QR Code
- **Problema**: Mensagens enviadas via QR Code não apareciam nos relatórios automaticamente
- **Solução completa implementada**:
  - **Sincronização automática**: Monitora Evolution API a cada 30 segundos (`server/api/qr-sync.ts`)
  - **Rastreamento de envios**: Sistema automático que registra mensagens enviadas (`server/api/qr-message-tracker.ts`)
  - **Integração no histórico**: Envios QR Code automaticamente atualizam tabela `contacts`
  - **Webhook de confirmação**: Endpoint `/webhook/qr-sent/:instance` para confirmações externas
- **Funcionalidades**:
  - Buscar telefones da `prospecting_results` quando QR Code é enviado
  - Criar/atualizar contatos na tabela `contacts` com `source = 'qr_code'`
  - Sincronização em tempo real de mensagens recebidas
  - Rastreamento em lote para múltiplos destinatários
- **Resultado**: Sistema 100% automático - envios e recebimentos QR Code aparecem nos relatórios

### 2025-06-25 - Remoção Campo ID da Instância (Evolution API)
- **Solicitação do usuário**: Removido campo "ID da Instância (Evolution API)" da seção avançada
- **Localização**: Formulário de edição e criação de servidores em configurações avançadas
- **Alterações**: Schema, interface TypeScript e campos do formulário removidos
- **Motivo**: Simplificação da interface conforme solicitação do usuário

### 2025-06-24 - Correção Duplicação e Erros SQL
- **Problema**: Registros duplicados no histórico e erro SQL no scheduler
- **Causa**: Frontend criava registro duplo + problemas com operadores Drizzle
- **Solução**: Removida criação dupla no frontend + SQL direto no scheduler
- **Coluna adicionada**: scheduled_at na tabela message_sending_history
- **SQL corrigido**: Queries diretas para evitar problemas de sintaxe
- **Resultado**: Agendamentos únicos e scheduler funcionando sem erros

### 2025-06-24 - Sistema de Agendamento Finalmente Funcional
- **Status**: Sistema de agendamento Meta API 100% operacional
- **Scheduler detectando**: Agendamentos sendo encontrados e processados automaticamente
- **Correções aplicadas**: Nomes de campos corrigidos (schedule.user_id, schedule.search_id, etc.)
- **SQL direto**: Todas as operações usando queries SQL diretas para máxima confiabilidade
- **Teste confirmado**: Scheduler executa envios na data/hora especificada
- **Logs detalhados**: Sistema mostra progresso completo de cada agendamento

### 2025-06-24 - Melhorias Sistema de Envios
- **Exclusão de agendamentos**: Corrigida exclusão de agendamentos pendentes com validação de usuário
- **Limpeza automática**: Sistema remove histórico de envios após 90 dias automaticamente
- **Paginação implementada**: Histórico mostra 10 registros por página com navegação
- **Validações de segurança**: Verificação de propriedade antes de exclusões
- **Performance otimizada**: Queries SQL diretas para melhor desempenho

### 2025-06-24 - Correção Relatórios Meta API
- **Histórico de envios**: Corrigido erro "pagination is not defined" com implementação completa de paginação
- **Mapeamento de campos**: Corrigida consulta SQL para mapear snake_case → camelCase corretamente
- **Relatórios Meta API**: Corrigidos campos de exibição nas 4 seções principais:
  - **Conversas**: contact_number, is_free_window, started_at, cost_brl
  - **Mensagens**: contact_number, delivery_status, sent_at, cost_brl
  - **Faturamento**: phone_number_id, conversation_count, message_count, total_cost
  - **Leads**: contact_number, has_response (boolean tratado corretamente)
- **Dados autênticos**: Todos os dados vêm das tabelas reais do banco sem fallbacks
- **Isolamento garantido**: Todos os relatórios respeitam isolamento por usuário

### 2025-06-25 - Sistema Completo de CRM para Leads
- **Implementação completa do CRM**: Sistema robusto para gestão de leads com 3 estágios principais
- **Estrutura de banco de dados**:
  - Tabela `crm_leads`: Dados principais do lead (telefone, nome, email, empresa, status, prioridade)
  - Tabela `crm_lead_activities`: Histórico completo de atividades e mudanças de status
  - Tipos enum: `lead_status` e `lead_priority` para padronização
- **Status de atendimento**: 6 estágios claros de acompanhamento:
  - `sendo_atendido_ia`: Sendo Atendido pela IA
  - `finalizado_ia`: Finalizada pela IA  
  - `precisa_atendimento_humano`: Precisa de Atendimento Humano
  - `transferido_humano`: Transferido para Humano
  - `finalizado_humano`: Finalizado por Humano
  - `abandonado`: Abandonado
- **Sistema de prioridades**: 4 níveis (baixa, média, alta, urgente) com cores distintivas
- **API completa implementada**:
  - `GET /api/crm/leads`: Listagem com filtros avançados e paginação
  - `GET /api/crm/leads/:id`: Detalhes do lead com histórico de atividades
  - `POST /api/crm/leads`: Criação de novos leads
  - `PUT /api/crm/leads/:id`: Atualização de leads existentes
  - `POST /api/crm/leads/:id/transfer-human`: Transferência para atendimento humano
  - `GET /api/crm/stats`: Estatísticas consolidadas do CRM
  - `POST /api/crm/leads/:id/activities`: Adição de atividades ao histórico
- **Interface frontend completa**:
  - Dashboard de estatísticas com cartões informativos
  - Sistema de filtros por status, prioridade e busca textual
  - Listagem responsiva com informações essenciais do lead
  - Formulário de criação com validação Zod
  - Paginação automática para grandes volumes
  - Botões de ação contextuais (transferir, ver detalhes)
- **Funcionalidades avançadas**:
  - Rastreamento automático de atividades
  - Sistema de tags para categorização
  - Acompanhamento de conversões
  - Follow-ups agendados
  - Isolamento completo por usuário (multi-tenant)
  - Validações rigorosas de segurança
- **Integração ao sistema**: Página adicionada ao menu de navegação como "CRM de Leads"
- **Dados de demonstração**: 5 leads de exemplo criados para teste das funcionalidades

*Última atualização: 25 de junho de 2025*
*Sistema CRM de leads operacional com interface completa e funcionalidades avançadas*