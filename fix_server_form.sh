#!/bin/bash

# Encontrar a linha do formulário de criação
CREATE_FORM_LINE=$(grep -n "onCreateSubmit" client/src/pages/server-management-page.tsx | grep "form" | cut -d':' -f1)
echo "Formulário de criação começa na linha $CREATE_FORM_LINE"

# Encontrar a linha do token da API no formulário de criação
API_TOKEN_CREATE=$(grep -n "name=\"apiToken\"" client/src/pages/server-management-page.tsx | head -1 | cut -d':' -f1)
echo "Campo Token da API no formulário de criação está na linha $API_TOKEN_CREATE"

# Encontrar o próximo campo após o token da API
NEXT_FIELD_CREATE=$(grep -n "name=\"" client/src/pages/server-management-page.tsx | awk -v line="$API_TOKEN_CREATE" '$1 > line {print $0; exit}')
echo "Próximo campo após o Token da API no formulário de criação: $NEXT_FIELD_CREATE"

# Encontrar a linha do formulário de edição
UPDATE_FORM_LINE=$(grep -n "onUpdateSubmit" client/src/pages/server-management-page.tsx | grep "form" | cut -d':' -f1)
echo "Formulário de edição começa na linha $UPDATE_FORM_LINE"

# Encontrar a linha do token da API no formulário de edição
API_TOKEN_UPDATE=$(grep -n "name=\"apiToken\"" client/src/pages/server-management-page.tsx | tail -1 | cut -d':' -f1)
echo "Campo Token da API no formulário de edição está na linha $API_TOKEN_UPDATE"

# Encontrar o próximo campo após o token da API no formulário de edição
NEXT_FIELD_UPDATE=$(grep -n "name=\"" client/src/pages/server-management-page.tsx | awk -v line="$API_TOKEN_UPDATE" '$1 > line {print $0; exit}')
echo "Próximo campo após o Token da API no formulário de edição: $NEXT_FIELD_UPDATE"