                                       
  Lista de tareas pre-producción (sin Supabase CLI)aaa                                                
                                                                                                      
  1. Desplegar las Edge Functions (CRÍTICO)                                                           
                                                                                                      
  Las funciones send-campaign y handle-ls-webhook fueron modificadas con los fixes de seguridad       
  críticos. Necesitas subirlas manualmente al dashboard de Supabase.                                  
                                                                                                      
  Accede a: https://supabase.com/dashboard/project/vdcwrtqrnsekyguhqowc/functions                     
   
  Para cada función, copia el contenido del archivo correspondiente:                                  
                                                            
  - supabase/functions/send-campaign/index.ts → función send-campaign                                 
  - supabase/functions/handle-ls-webhook/index.ts → función handle-ls-webhook
                                                                                                      
  En el dashboard: Edge Functions → selecciona la función → Edit code → pega el contenido → Deploy.   
                                                                                                      
  ---                                                                                                 
  2. Configurar los secrets de las Edge Functions (CRÍTICO) 
                                                                                                      
  Accede a: https://supabase.com/dashboard/project/vdcwrtqrnsekyguhqowc/settings/functions
                                                                                                      
  Añade estos secrets (o verifica que ya existen):                                                    
                                                                                                      
  ┌─────────────────────────────┬──────────────────────────────────────────────────────┐              
  │           Secret            │                     Descripción                      │
  ├─────────────────────────────┼──────────────────────────────────────────────────────┤
  │ RESEND_API_KEY              │ Tu API key de Resend para envío de emails            │
  ├─────────────────────────────┼──────────────────────────────────────────────────────┤
  │ LEMONSQUEEZY_WEBHOOK_SECRET │ Signing secret del webhook en LemonSqueezy dashboard │              
  ├─────────────────────────────┼──────────────────────────────────────────────────────┤              
  │ ALLOWED_ORIGIN              │ https://tudominio.lovable.app (o tu dominio custom)  │              
  ├─────────────────────────────┼──────────────────────────────────────────────────────┤              
  │ SUPABASE_ANON_KEY           │ Tu anon/public key de Supabase (ya tienes la URL)    │
  └─────────────────────────────┴──────────────────────────────────────────────────────┘              
                                                            
  SUPABASE_SERVICE_ROLE_KEY y SUPABASE_URL son auto-inyectadas por Supabase en las edge functions — no
   necesitas configurarlas.                                 
                                                                                                      
  ---                                                       
  3. Verificar RLS Policies (ALTO)
                                  
  Accede a: https://supabase.com/dashboard/project/vdcwrtqrnsekyguhqowc/auth/policies
                                                                                                      
  Verifica que las tablas críticas tengan RLS habilitado y políticas que filtren por organization_id  
  y/o user_id:                                                                                        
                                                                                                      
  - reservations — ✅ debe tener organization_id en policies                                          
  - customers — ✅ debe tener organization_id
  - vaccination_schedule — ✅ debe tener organization_id                                              
  - medical_history — ✅ debe tener organization_id                                                   
  - campaigns — ✅ debe tener organization_id
                                                                                                      
  Si alguna tabla tiene RLS disabled, actívalo con el toggle en el dashboard.                         
                                                                                                      
  ---                                                                                                 
  4. Redesplegar el frontend desde Lovable                  
                                                                                                      
  Desde el editor de Lovable, haz clic en "Publish" (botón en la esquina superior derecha). Esto
  redespliega el frontend con todos los cambios de código que hemos aplicado.                         
                                                            
  Si tienes conectado un repositorio GitHub, Lovable detecta los commits automáticamente.             
                                                            
  ---                                                                                                 
  5. Verificación rápida post-deploy                        
                                    
  Una vez desplegado, prueba manualmente:
                                                                                                      
  1. Login → entra a tu organización
  2. Nueva reserva → crea una y verifica que aparece en el calendario                                 
  3. Check-in → comprueba que los warnings de vacunas/balance aparecen correctamente                  
  4. Campañas → intenta enviar una campaña de prueba (segmento "all")                                 
  5. Facturación → verifica que LemonSqueezy redirige correctamente                                   
                                                                                                      
  ---                                                                                                 
  Lo más urgente es el punto 1 (Edge Functions) — sin el redeploy, las funciones en producción siguen 
  teniendo el código sin autenticación JWT y el bug de cross-org data leakage. Los cambios del        
  frontend ya están en el repositorio y se despliegan solos desde Lovable.