#!/bin/bash

# Script de teste para verificar o download do GitHub
# Testa se o repositório https://github.com/marloncomverse16/LigaAIvendas é acessível

echo "🔍 Testando download do repositório GitHub..."
echo "📱 Repositório: https://github.com/marloncomverse16/LigaAIvendas"
echo ""

# Testar conectividade com GitHub
echo "1. Testando conectividade com GitHub..."
if ping -c 1 github.com &>/dev/null; then
    echo "   ✅ GitHub acessível"
else
    echo "   ❌ GitHub não acessível"
    exit 1
fi

# Testar clone do repositório
echo ""
echo "2. Testando clone do repositório..."
TEST_DIR="/tmp/ligai_test_$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

if git clone https://github.com/marloncomverse16/LigaAIvendas.git test_repo; then
    echo "   ✅ Clone via Git bem-sucedido"
    
    # Verificar estrutura
    if [[ -f "test_repo/package.json" ]]; then
        echo "   ✅ package.json encontrado"
    else
        echo "   ⚠️  package.json não encontrado"
    fi
    
    if [[ -d "test_repo/client" ]]; then
        echo "   ✅ Diretório client encontrado"
    else
        echo "   ⚠️  Diretório client não encontrado"
    fi
    
    if [[ -d "test_repo/server" ]]; then
        echo "   ✅ Diretório server encontrado"
    else
        echo "   ⚠️  Diretório server não encontrado"
    fi
    
else
    echo "   ❌ Clone via Git falhou"
    echo "   🔄 Tentando download direto..."
    
    # Testar download direto
    if curl -L https://github.com/marloncomverse16/LigaAIvendas/archive/refs/heads/main.zip -o ligai.zip; then
        echo "   ✅ Download direto bem-sucedido"
        
        if unzip -q ligai.zip; then
            echo "   ✅ Extração bem-sucedida"
            
            # Verificar estrutura
            if [[ -f "LigaAIvendas-main/package.json" ]]; then
                echo "   ✅ package.json encontrado no ZIP"
            else
                echo "   ⚠️  package.json não encontrado no ZIP"
            fi
        else
            echo "   ❌ Falha na extração"
        fi
    else
        echo "   ❌ Download direto falhou"
    fi
fi

# Limpeza
echo ""
echo "3. Limpando arquivos de teste..."
cd /
rm -rf "$TEST_DIR"
echo "   ✅ Limpeza concluída"

echo ""
echo "🎯 Teste concluído!"