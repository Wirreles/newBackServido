# Solución para Problema de Dominio Personalizado

## Problema Identificado

Cuando agregaste el dominio personalizado `servido.com.ar` en Vercel, el flujo de pagos se rompió porque:

1. **Variables de entorno no actualizadas**: El backend sigue usando las URLs antiguas
2. **CORS no configurado**: El nuevo dominio no está en la lista de orígenes permitidos
3. **URLs de redirección incorrectas**: Las URLs de éxito/fallo apuntan a dominios incorrectos

## Solución Paso a Paso

### 1. Actualizar Variables de Entorno en Render

En tu dashboard de Render, actualiza las siguientes variables de entorno:

```bash
# URL del backend (tu aplicación en Render)
BASE_URL=https://tu-backend.onrender.com

# URL del frontend (nuevo dominio personalizado)
FRONTEND_URL=https://www.servido.com.ar

# O si prefieres usar el dominio sin www
# FRONTEND_URL=https://servido.com.ar
```

### 2. Verificar Configuración CORS

El backend ya está configurado para aceptar:
- `https://www.servido.com.ar`
- `https://servido.com.ar`
- `https://new-front-servido.vercel.app`

### 3. Probar la Configuración

#### Opción A: Usar el endpoint de diagnóstico
```bash
curl -X GET "https://tu-backend.onrender.com/api/mercadopago/diagnose-config" \
  -H "Origin: https://www.servido.com.ar"
```

#### Opción B: Usar el script de prueba
```bash
# Instalar axios si no está instalado
npm install axios

# Configurar variables de entorno
export BACKEND_URL="https://tu-backend.onrender.com"
export FRONTEND_URL="https://www.servido.com.ar"

# Ejecutar script de prueba
node test-frontend-connection.js
```

### 4. Verificar en el Frontend

En tu aplicación frontend, asegúrate de que las llamadas al backend usen la URL correcta:

```javascript
// En tu archivo de configuración del frontend
const API_BASE_URL = 'https://tu-backend.onrender.com';

// Ejemplo de llamada
const response = await fetch(`${API_BASE_URL}/api/mercadopago/payments/create-preference`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data)
});
```

### 5. Reiniciar el Servicio

Después de actualizar las variables de entorno en Render:
1. Ve a tu dashboard de Render
2. Encuentra tu servicio backend
3. Haz clic en "Manual Deploy" → "Deploy latest commit"
4. O simplemente reinicia el servicio

## Diagnóstico de Problemas

### Si sigues teniendo problemas:

1. **Verificar CORS**:
   ```bash
   curl -X GET "https://tu-backend.onrender.com/api/mercadopago/diagnose-config" \
     -H "Origin: https://www.servido.com.ar" \
     -v
   ```

2. **Verificar token de MercadoPago**:
   ```bash
   curl -X GET "https://tu-backend.onrender.com/api/mercadopago/simple-token-test"
   ```

3. **Verificar logs en Render**:
   - Ve a tu dashboard de Render
   - Selecciona tu servicio
   - Ve a la pestaña "Logs"
   - Busca errores relacionados con CORS o URLs

### Errores Comunes y Soluciones

#### Error 403 CORS
- **Causa**: El dominio no está en la lista de orígenes permitidos
- **Solución**: Verificar que `https://www.servido.com.ar` esté en `allowedOrigins`

#### Error 500 en creación de preferencia
- **Causa**: Variables de entorno incorrectas
- **Solución**: Verificar `BASE_URL` y `FRONTEND_URL` en Render

#### Error de token de MercadoPago
- **Causa**: Token expirado o sin permisos
- **Solución**: Generar nuevo token en MercadoPago Developers

## Verificación Final

1. Abre `https://www.servido.com.ar` en tu navegador
2. Intenta hacer una compra
3. Verifica que se redirija correctamente a MercadoPago
4. Verifica que después del pago regrese a la URL correcta

## Contacto

Si sigues teniendo problemas después de seguir estos pasos, proporciona:
1. Los logs del endpoint `/api/mercadopago/diagnose-config`
2. Los logs de error del navegador (F12 → Console)
3. Los logs del backend en Render 