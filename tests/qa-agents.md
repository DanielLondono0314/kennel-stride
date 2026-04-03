# 🤖 QA Testing Plan - Agentes Automáticos

## App Info
- **URL Local:** http://localhost:5173
- **Última versión:** [fecha de hoy]
- **Funciones a probar:** [lista de features]

## Agentes Asignados
1. QA Lead
2. Functional Tester
3. UI/UX Tester
4. Bug Hunter
5. Performance Tester

---

## Checklist de Pruebas

### Funcionalidad Principal
- [ ] Login/Signup funciona
- [ ] Dashboard carga correctamente
- [ ] Crear elemento funciona
- [ ] Editar elemento funciona
- [ ] Eliminar elemento funciona
- [ ] Filtros funcionan
- [ ] Búsqueda funciona

### UI/UX
- [ ] Responsive en mobile
- [ ] Responsive en tablet
- [ ] Responsive en desktop
- [ ] Colores y tipografía correctos
- [ ] Botones son clickeables
- [ ] Formularios son validados

### Performance
- [ ] Página carga en < 3s
- [ ] Sin errores en consola
- [ ] Sin memory leaks

### Seguridad
- [ ] No expone datos sensibles
- [ ] Auth funciona correctamente
- [ ] Inyección SQL imposible

---

## Reportes por Agente
[Los reportes irán aquí]
```

---

### **Paso 2: Pídele a Claude Code que cree un script de testing**

Abre Claude Code en VS Code y dile:
```
Crea un archivo `tests/test-suite.ts` que contenga:
1. Suite de pruebas funcionales para [lista tus features]
2. Suite de pruebas de UI (validación de elementos)
3. Pruebas de casos extremos (inputs vacíos, caracteres especiales, etc)
4. Pruebas de rendimiento básicas

Usa Vitest o Jest, lo que prefieras.