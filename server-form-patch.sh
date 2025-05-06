#!/bin/bash

# Backup original
cp client/src/pages/server-management-page.tsx client/src/pages/server-management-page.tsx.bak

# Adicionar campo maxUsers no formulário de criação
sed -i '767a\
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

# Adicionar campo maxUsers no formulário de edição
sed -i '987a\
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

echo "Campo maxUsers adicionado em ambos os formulários"