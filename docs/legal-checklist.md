# Checklist legal (Colombia) — lo que el código no resuelve

La plataforma ya tiene: Política de Tratamiento de Datos (Ley 1581), Términos y
Condiciones, Contrato de Transmisión, Política de Cookies, modelo de autorización
para clientes finales, casillas de aceptación con prueba guardada
(`legal_acceptances`), autorización obligatoria al crear clientes, publicidad solo
con autorización y envío de campañas solo en horarios de la Ley 2300 de 2023.

Nada de esto reemplaza la revisión de un abogado. Pendiente, en orden:

1. **Constituir la sociedad (SAS)** y obtener el NIT. Mientras tanto, quien opera
   responde con su patrimonio personal.
2. **Completar `src/lib/legal.ts`**: razón social, NIT, dirección, ciudad, correo
   de datos personales, teléfono, correo de soporte y marca definitiva. Al quedar
   completo desaparece el aviso "Documento en revisión".
3. **Revisión por abogado** de los 5 documentos (sobre todo limitación de
   responsabilidad, retracto y jurisdicción). Si cambia el texto de un documento,
   subir su `version` en `LEGAL_DOCS`.
4. **Buzón de datos personales** monitoreado y una persona o área responsable de
   responder consultas (10 días hábiles) y reclamos (15 días hábiles).
5. **Manual interno de políticas y procedimientos** de datos personales
   (responsabilidad demostrada, Decreto 1074 de 2015) y procedimiento de gestión
   de incidentes de seguridad (reporte a la SIC).
6. **RNBD (Registro Nacional de Bases de Datos, SIC)**: obligatorio solo para
   sociedades con activos totales superiores a 100.000 UVT. Verificar al
   constituir la SAS.
7. **Registro de marca ante la SIC** cuando se defina el nombre.
8. **Facturación electrónica DIAN** de la propia suscripción (LemonSqueezy actúa
   como comerciante registrado; confirmar con el contador si además se requiere
   factura electrónica colombiana).
9. **Autorizaciones de clientes existentes**: los clientes creados antes de esta
   versión aparecen como "Sin autorización" y no reciben campañas hasta que la
   guardería registre su autorización (editar el cliente).
10. **Usuarios existentes**: se decidió no pedirles re-aceptación; no hay prueba
    de su autorización. Reconsiderar antes de crecer.
11. **Landing**: se retiraron estadísticas y testimonios ficticios, la barra de
    "centros que confían" y los planes anuales inexistentes. Cualquier
    testimonio, logo o cifra futura debe ser real y contar con autorización
    escrita del cliente (Ley 1480, publicidad engañosa).
