#!/bin/bash

# Primeiro, faça backup do arquivo original
cp client/src/pages/server-management-page.tsx client/src/pages/server-management-page.tsx.bak2

# Adicionar campo maxUsers no formulário de criação - Após o campo apiToken
sed -i '/name="apiToken"/,/\/>/!b;/\/>/a\
              <FormField\
                control={form.control}\
                name="maxUsers"\
                render={({ field }) => (\
                  <FormItem>\
                    <FormLabel className="font-bold text-primary">Quantidade Máxima de Usuários</FormLabel>\
                    <FormControl>\
                      <Input \
                        type="number" \
                        min="1" \
                        placeholder="Ex: 10" \
                        {...field} \
                      />\
                    </FormControl>\
                    <FormMessage />\
                    <FormDescription>\
                      Quantidade máxima de usuários que podem se conectar a este servidor simultaneamente.\
                    </FormDescription>\
                  </FormItem>\
                )}\
              />' client/src/pages/server-management-page.tsx

# Adicionar campo maxUsers no formulário de edição - Após o campo apiToken no segundo formulário
sed -i '1,/name="apiToken"/!{/name="apiToken"/,/\/>/!b;/\/>/a\
              <FormField\
                control={form.control}\
                name="maxUsers"\
                render={({ field }) => (\
                  <FormItem>\
                    <FormLabel className="font-bold text-primary">Quantidade Máxima de Usuários</FormLabel>\
                    <FormControl>\
                      <Input \
                        type="number" \
                        min="1" \
                        placeholder="Ex: 10" \
                        {...field} \
                      />\
                    </FormControl>\
                    <FormMessage />\
                    <FormDescription>\
                      Quantidade máxima de usuários que podem se conectar a este servidor simultaneamente.\
                    </FormDescription>\
                  </FormItem>\
                )}\
              />;b}' client/src/pages/server-management-page.tsx

echo "Campos maxUsers adicionados em ambos os formulários"