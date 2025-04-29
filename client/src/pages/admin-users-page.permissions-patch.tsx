
// Adicionar esta parte após o TabsContent do webhooks e antes do TabsContent do advanced
// no formulário de criação de usuário
              <TabsContent value="permissions" className="space-y-4">
                <ModulePermissions 
                  permissions={{
                    accessDashboard: formValues.accessDashboard,
                    accessLeads: formValues.accessLeads,
                    accessProspecting: formValues.accessProspecting,
                    accessAiAgent: formValues.accessAiAgent,
                    accessWhatsapp: formValues.accessWhatsapp,
                    accessContacts: formValues.accessContacts,
                    accessScheduling: formValues.accessScheduling,
                    accessReports: formValues.accessReports,
                    accessSettings: formValues.accessSettings
                  }}
                  onChange={(permissions) => {
                    setFormValues({
                      ...formValues,
                      ...permissions
                    });
                  }}
                />
              </TabsContent>

// Adicionar esta parte após o TabsContent do webhooks e antes do TabsContent do advanced
// no formulário de edição de usuário
              <TabsContent value="permissions" className="space-y-4">
                <ModulePermissions 
                  permissions={{
                    accessDashboard: formValues.accessDashboard,
                    accessLeads: formValues.accessLeads,
                    accessProspecting: formValues.accessProspecting,
                    accessAiAgent: formValues.accessAiAgent,
                    accessWhatsapp: formValues.accessWhatsapp,
                    accessContacts: formValues.accessContacts,
                    accessScheduling: formValues.accessScheduling,
                    accessReports: formValues.accessReports,
                    accessSettings: formValues.accessSettings
                  }}
                  onChange={(permissions) => {
                    setFormValues({
                      ...formValues,
                      ...permissions
                    });
                  }}
                />
              </TabsContent>
