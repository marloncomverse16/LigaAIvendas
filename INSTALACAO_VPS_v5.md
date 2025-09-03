# LigAI Dashboard - Guia de Instalação VPS v5.0

## 🚀 Instalador Automatizado Completo

O **LigAI Dashboard v5.0** oferece um sistema de instalação completamente automatizado para servidores Ubuntu/Debian VPS. Este instalador foi reconstruído do zero para máxima confiabilidade e robustez.

---

## 📋 Pré-requisitos do Sistema

### Requisitos Mínimos
- **Sistema Operacional**: Ubuntu 18.04+ ou Debian 9+
- **RAM**: 512MB mínimo (1GB recomendado)
- **Armazenamento**: 2GB livres
- **Rede**: Conexão estável com internet
- **Usuário**: Acesso root ou sudo

### Domínio e DNS
- Domínio/subdomínio apontado para o IP do servidor
- Exemplo: `ligai.seudominio.com`

---

## ⚡ Instalação Rápida

### 1. Baixar e Executar

```bash
# Download do instalador
wget -O install-ligai-complete.sh https://raw.githubusercontent.com/marloncomverse16/LigaAIvendas/main/install-ligai-complete.sh

# Tornar executável
chmod +x install-ligai-complete.sh

# Executar instalação
sudo bash install-ligai-complete.sh
```

### 2. Teste de Pré-requisitos (Opcional)

```bash
# Baixar script de teste
wget -O test-install-requirements.sh https://raw.githubusercontent.com/marloncomverse16/LigaAIvendas/main/test-install-requirements.sh

# Executar teste
sudo bash test-install-requirements.sh
```

---

## 🔧 Processo de Instalação

O instalador executa automaticamente:

### 1. **Verificação do Sistema**
- Valida pré-requisitos
- Verifica conectividade
- Testa acesso ao GitHub

### 2. **Atualização Base**
- Atualiza pacotes do sistema
- Instala dependências essenciais
- Configura repositórios necessários

### 3. **Instalação de Componentes**
- **Node.js 20.x** (runtime da aplicação)
- **PostgreSQL** (banco de dados)
- **Nginx** (proxy reverso)
- **Certbot** (certificados SSL)

### 4. **Configuração da Aplicação**
- Cria usuário sistema `ligai`
- Download do código fonte
- Instalação de dependências NPM
- Build da aplicação

### 5. **Configuração do Banco**
- Cria usuário e database
- Executa migrations automáticas
- Configura esquema completo

### 6. **Serviços e Segurança**
- Configura serviço systemd
- Proxy reverso Nginx
- Certificado SSL automático
- Firewall e Fail2Ban

---

## 📊 Componentes Instalados

### Aplicação Principal
- **Localização**: `/opt/ligai/`
- **Usuário**: `ligai`
- **Serviço**: `ligai-dashboard`
- **Porta interna**: `5000`

### Banco de Dados
- **PostgreSQL**: Versão mais recente
- **Database**: `ligai_db`
- **Usuário**: Configurável (padrão: `ligai_user`)
- **Senha**: Gerada automaticamente

### Proxy Web
- **Nginx**: Configuração otimizada
- **SSL/HTTPS**: Let's Encrypt automático
- **WebSocket**: Suporte completo
- **Compressão**: Gzip habilitado

### Segurança
- **Firewall**: UFW configurado
- **Fail2Ban**: Proteção contra ataques
- **Headers**: Segurança HTTP
- **Certificados**: Renovação automática

---

## 🎛️ Comandos de Gerenciamento

### Controle do Serviço
```bash
# Verificar status
systemctl status ligai-dashboard

# Iniciar/Parar/Reiniciar
systemctl start ligai-dashboard
systemctl stop ligai-dashboard
systemctl restart ligai-dashboard

# Ver logs em tempo real
journalctl -u ligai-dashboard -f

# Logs das últimas 100 linhas
journalctl -u ligai-dashboard -n 100
```

### Nginx e SSL
```bash
# Status do Nginx
systemctl status nginx

# Testar configuração
nginx -t

# Recarregar configuração
systemctl reload nginx

# Verificar certificados SSL
certbot certificates

# Renovar SSL manualmente
certbot renew
```

### Banco de Dados
```bash
# Conectar ao PostgreSQL
sudo -u postgres psql ligai_db

# Backup do banco
pg_dump -U ligai_user -h localhost ligai_db > backup.sql

# Restore do banco
psql -U ligai_user -h localhost ligai_db < backup.sql
```

---

## 🔍 Diagnóstico e Solução de Problemas

### Verificações Básicas

1. **Aplicação funcionando**:
```bash
curl -I http://localhost:5000
# Deve retornar HTTP 200 ou 302
```

2. **Banco acessível**:
```bash
sudo -u ligai psql postgresql://ligai_user:SENHA@localhost:5432/ligai_db -c "SELECT 1;"
```

3. **Nginx proxy**:
```bash
curl -I http://seudominio.com
# Deve redirecionar para HTTPS
```

### Logs Importantes
- **Aplicação**: `journalctl -u ligai-dashboard -f`
- **Nginx**: `tail -f /var/log/nginx/error.log`
- **PostgreSQL**: `tail -f /var/log/postgresql/postgresql-*.log`
- **Instalação**: `/var/log/ligai-install.log`

### Problemas Comuns

#### 🔴 Aplicação não inicia
```bash
# Verificar permissões
ls -la /opt/ligai/
chown -R ligai:ligai /opt/ligai/

# Verificar arquivo .env
cat /opt/ligai/.env

# Testar manualmente
cd /opt/ligai
sudo -u ligai npm start
```

#### 🔴 Erro de banco de dados
```bash
# Verificar PostgreSQL
systemctl status postgresql

# Testar conexão
sudo -u postgres psql -c "SELECT version();"

# Verificar usuário e senha
sudo -u postgres psql -c "\du"
```

#### 🔴 SSL não funciona
```bash
# Verificar domínio
nslookup seudominio.com

# Testar certbot
certbot --nginx --dry-run -d seudominio.com

# Verificar configuração Nginx
nginx -t
```

---

## 🔐 Informações de Segurança

### Usuários Criados
- **Sistema**: `ligai` (sem login direto)
- **Database**: Configurável durante instalação

### Portas Abertas
- **80**: HTTP (redireciona para HTTPS)
- **443**: HTTPS (aplicação principal)
- **22**: SSH (se já estava ativo)

### Diretórios Importantes
- `/opt/ligai/`: Código da aplicação
- `/etc/nginx/sites-available/ligai`: Configuração Nginx
- `/etc/systemd/system/ligai-dashboard.service`: Serviço systemd
- `/var/log/ligai-install.log`: Log de instalação

---

## 📈 Pós-Instalação

### 1. Primeiro Acesso
- Acesse `https://seudominio.com`
- Registre o primeiro usuário (será admin)
- Configure as preferências básicas

### 2. Configuração APIs
- Evolution API (WhatsApp via QR Code)
- Meta WhatsApp Cloud API
- OpenAI (para agentes IA)
- Cloudinary (upload de mídia)

### 3. Configuração Avançada
- Webhooks personalizados
- Agentes de IA
- Templates de mensagem
- Relatórios e métricas

---

## 🆘 Suporte Técnico

### Informações do Sistema
```bash
# Versão do instalador
head -10 install-ligai-complete.sh | grep "Versão"

# Status geral
systemctl status ligai-dashboard nginx postgresql

# Versões dos componentes
node --version
npm --version
nginx -v
psql --version
```

### Contato
- **GitHub**: https://github.com/marloncomverse16/LigaAIvendas
- **Issues**: https://github.com/marloncomverse16/LigaAIvendas/issues
- **Documentação**: https://github.com/marloncomverse16/LigaAIvendas/wiki

---

## 🔄 Atualizações

### Atualizar Aplicação
```bash
cd /opt/ligai
sudo -u ligai git pull origin main
sudo -u ligai npm install
sudo -u ligai npm run build
sudo -u ligai npm run db:push
systemctl restart ligai-dashboard
```

### Backup Antes de Atualizar
```bash
# Backup do código
tar -czf /tmp/ligai-backup-$(date +%Y%m%d).tar.gz -C /opt ligai

# Backup do banco
pg_dump -U ligai_user -h localhost ligai_db > /tmp/ligai-db-backup-$(date +%Y%m%d).sql
```

---

**LigAI Dashboard v5.0** - Sistema completo de gestão WhatsApp com IA
*Instalação automatizada para máxima simplicidade e confiabilidade*