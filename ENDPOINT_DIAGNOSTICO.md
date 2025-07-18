# Endpoint de Diagnóstico Único

## 🎯 **Endpoint Principal: `/api/mercadopago/diagnose-config`**

Este es el **único endpoint de diagnóstico** que necesitas. Reemplaza todos los endpoints de debugging anteriores y proporciona información completa del sistema.

## 📋 **Qué Verifica:**

### ✅ **Configuración del Sistema:**
- Variables de entorno (`BASE_URL`, `FRONTEND_URL`)
- Configuración de MercadoPago (`MP_ACCESS_TOKEN`, `MP_ACCESS_TOKEN_SUB`)
- Entorno de ejecución (`NODE_ENV`, `PORT`)

### ✅ **CORS y Headers:**
- Origen de la petición
- Lista de orígenes permitidos
- Validación de CORS

### ✅ **Conexión con MercadoPago:**
- Prueba real de creación de preferencia
- Validación del token
- Tiempo de respuesta
- Detalles del error (si existe)

## 🚀 **Cómo Usar:**

### Desde Terminal:
```bash
curl -X GET "https://newbackservido.onrender.com/api/mercadopago/diagnose-config" \
  -H "Origin: https://www.servido.com.ar"
```

### Desde Navegador:
```
https://newbackservido.onrender.com/api/mercadopago/diagnose-config
```

## 📊 **Respuesta de Ejemplo:**

### ✅ **Sistema Funcionando Correctamente:**
```json
{
  "success": true,
  "config": {
    "environment": {
      "NODE_ENV": "production",
      "PORT": "10000"
    },
    "urls": {
      "BASE_URL": "https://newbackservido.onrender.com",
      "FRONTEND_URL": "https://www.servido.com.ar"
    },
    "mercadopago": {
      "MP_ACCESS_TOKEN": "configurado",
      "MP_ACCESS_TOKEN_SUB": "configurado"
    }
  },
  "issues": [],
  "isOriginAllowed": true,
  "mercadopagoTest": {
    "status": "success",
    "message": "Conexión exitosa con MercadoPago",
    "preferenceId": "1234567890-abcdef",
    "responseTime": "500ms"
  },
  "recommendations": []
}
```

### ❌ **Sistema con Problemas:**
```json
{
  "success": false,
  "config": { ... },
  "issues": [
    "Token de MercadoPago expirado o sin permisos"
  ],
  "mercadopagoTest": {
    "status": "error",
    "message": "Error de conexión con MercadoPago",
    "error": "invalid json response body...",
    "type": "invalid-json",
    "details": "Token expirado o sin permisos - Renovar token en MercadoPago Developers"
  },
  "recommendations": [
    "Renovar token en https://www.mercadopago.com.ar/developers/panel/credentials"
  ]
}
```

## 🔧 **Solución de Problemas:**

### **Token de MercadoPago Expirado:**
1. Ve a: https://www.mercadopago.com.ar/developers/panel/credentials
2. Copia el nuevo token de producción
3. Actualiza `MP_ACCESS_TOKEN` en Render
4. Reinicia el servicio

### **Variables de Entorno Incorrectas:**
1. Verifica `BASE_URL` en Render
2. Verifica `FRONTEND_URL` en Render
3. Reinicia el servicio

### **Problemas de CORS:**
1. Verifica que el dominio esté en `allowedOrigins`
2. Contacta al desarrollador para agregar el dominio

## 🎯 **Ventajas del Endpoint Único:**

- ✅ **Completo**: Verifica todo en una sola llamada
- ✅ **Rápido**: Respuesta en ~2 segundos
- ✅ **Claro**: Información estructurada y fácil de entender
- ✅ **Útil**: Incluye recomendaciones automáticas
- ✅ **Confiable**: Prueba real de MercadoPago

## 🗑️ **Endpoints Eliminados:**

Los siguientes endpoints fueron eliminados por redundancia:
- `/test-connection`
- `/verify-token`
- `/simple-token-test`
- `/comprehensive-token-test`
- `/test-preference-creation`

**Ahora solo necesitas `/diagnose-config` para todo el diagnóstico.** 