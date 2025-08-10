# 🚚 Sistema de Envíos Integrado - Backend

## 📋 Descripción

El backend ahora está completamente sincronizado con el frontend para manejar los costos de envío en las transacciones de MercadoPago.

## 🔄 Cambios Implementados

### 1. **Recepción de Datos de Envío**
```javascript
const { products, buyerId, buyerEmail, shippingCosts } = req.body;
```

### 2. **Cálculo de Envío Total**
```javascript
// Calcular envío total
let totalShipping = 0;
if (shippingCosts && Array.isArray(shippingCosts)) {
  totalShipping = shippingCosts.reduce((total, cost) => total + (cost || 0), 0);
}

// Incluir envío en el total final
const finalTotal = totalAmount + totalShipping;
```

### 3. **Integración con MercadoPago**
```javascript
// Agregar información de envío si hay costo
...(totalShipping > 0 && {
  shipments: {
    cost: totalShipping,
    mode: "not_specified"
  }
}),
```

### 4. **Almacenamiento en Firestore**
```javascript
await db.collection('pending_purchases').doc(purchaseId).set({
  buyerId,
  buyerEmail,
  products: validatedProducts,
  totalAmount,
  shippingCost: totalShipping,        // 🆕 Nuevo campo
  finalTotal,                         // 🆕 Nuevo campo
  status: 'pending',
  createdAt: new Date(),
  preferenceId: result.id
});
```

### 5. **Respuesta con Totales**
```javascript
return res.json({
  ...result,
  totals: {
    subtotal: totalAmount,
    shipping: totalShipping,
    final: finalTotal
  }
});
```

## 📤 Formato de Request

### Frontend debe enviar:
```javascript
{
  "products": [
    {
      "productId": "product_123",
      "quantity": 2
    }
  ],
  "buyerId": "user_456",
  "buyerEmail": "comprador@email.com",
  "shippingCosts": [500, 300]  // 🆕 Array de costos de envío por vendedor
}
```

### Backend responde:
```javascript
{
  "id": "preference_789",
  "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "sandbox_init_point": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "totals": {
    "subtotal": 2000,
    "shipping": 800,
    "final": 2800
  }
}
```

## 🗄️ Estructura de Base de Datos

### Collection: `pending_purchases`
```javascript
{
  buyerId: "user_456",
  buyerEmail: "comprador@email.com",
  products: [...],
  totalAmount: 2000,           // Subtotal sin envío
  shippingCost: 800,           // 🆕 Costo total de envío
  finalTotal: 2800,            // 🆕 Total final con envío
  status: "pending",
  createdAt: Timestamp,
  preferenceId: "preference_789"
}
```

### Collection: `purchases` (después del webhook)
```javascript
{
  buyerId: "user_456",
  buyerEmail: "comprador@email.com",
  products: [...],
  paymentId: "payment_123",
  status: "approved",
  totalAmount: 2000,           // Subtotal sin envío
  shippingCost: 800,           // 🆕 Costo total de envío
  finalTotal: 2800,            // 🆕 Total final con envío
  paidToSellers: false,
  createdAt: Timestamp
}
```

## 🔍 Logs de Debug

El sistema ahora incluye logs detallados para monitorear los cálculos:

```javascript
console.log('DEBUG: Cálculo de totales:', {
  subtotal: totalAmount,
  envío: totalShipping,
  totalFinal: finalTotal
});
```

## ✅ Beneficios

1. **Sincronización completa** entre frontend y backend
2. **Transparencia** en los costos de envío
3. **Trazabilidad** completa de la transacción
4. **Integración nativa** con MercadoPago
5. **Auditoría** de todos los costos

## 🚀 Próximos Pasos

- [ ] Actualizar el frontend para enviar `shippingCosts`
- [ ] Probar la integración completa
- [ ] Implementar validaciones adicionales de envío
- [ ] Agregar soporte para diferentes tipos de envío
