#!/bin/bash

# Cria um arquivo temporário
cp client/src/pages/server-management-page.tsx client/src/pages/server-management-page.tsx.temp

# Faz as substituições
sed -i '523,534s/<Select onValueChange={field.onChange} defaultValue={field.value}>.*<\/Select>/<FormControl>\n                        <Input placeholder="Ex: Evolution API, n8n, outro" {...field} \/>\n                      <\/FormControl>/g' client/src/pages/server-management-page.tsx.temp
sed -i '695,706s/<Select onValueChange={field.onChange} defaultValue={field.value}>.*<\/Select>/<FormControl>\n                        <Input placeholder="Ex: Evolution API, n8n, outro" {...field} \/>\n                      <\/FormControl>/g' client/src/pages/server-management-page.tsx.temp

# Move o arquivo temporário para substituir o original
mv client/src/pages/server-management-page.tsx.temp client/src/pages/server-management-page.tsx

echo "Arquivo atualizado com sucesso!"
