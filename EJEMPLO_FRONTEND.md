# 🎯 Ejemplo de Implementación Frontend

## 📤 Cómo Enviar Datos de Envío al Backend

### 1. **Preparar los Datos del Carrito**

```typescript
// En tu contexto del carrito o antes de hacer la llamada al backend
const cartItems = [
  {
    id: "product_123",
    name: "Producto A",
    price: 1000,
    discountedPrice: 1000,
    quantity: 2,
    sellerId: "seller_1",
    freeShipping: false,
    shippingCost: 500
  },
  {
    id: "product_456", 
    name: "Producto B",
    price: 1500,
    discountedPrice: 1500,
    quantity: 1,
    sellerId: "seller_2",
    freeShipping: false,
    shippingCost: 300
  }
];

// Calcular costos de envío por vendedor
const shippingCosts = cartItems.map(item => item.shippingCost || 0);
// Resultado: [500, 300]
```

### 2. **Llamada al Backend**

```typescript
const createPaymentPreference = async () => {
  try {
    const response = await fetch('/api/mercadopago/payments/create-preference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        products: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity
        })),
        buyerId: currentUser.uid,
        buyerEmail: currentUser.email,
        shippingCosts: shippingCosts  // 🆕 Array de costos de envío
      })
    });

    const result = await response.json();
    
    // Ahora tienes acceso a los totales desglosados
    console.log('Totales:', result.totals);
    // {
    //   subtotal: 3500,
    //   shipping: 800,
    //   final: 4300
    // }
    
    // Redirigir a MercadoPago
    window.location.href = result.init_point;
    
  } catch (error) {
    console.error('Error creando preferencia:', error);
  }
};
```

### 3. **Actualizar el Contexto del Carrito**

```typescript
// En tu cart-context.tsx, asegúrate de que getTotalWithShipping use shippingCost
const getTotalWithShipping = (): number => {
  return getTotalPrice() + getTotalShipping();
};

const getTotalShipping = (): number => {
  return state.items.reduce((total, item) => {
    if (item.freeShipping) {
      return total;
    }
    if (item.shippingCost !== undefined && item.shippingCost > 0) {
      return total + item.shippingCost;
    }
    return total;
  }, 0);
};
```

### 4. **Componente de Resumen de Compra**

```typescript
// En tu purchase-summary.tsx
export function PurchaseSummary({ cartItems, className = "" }: PurchaseSummaryProps) {
  const summary = getCartPurchaseSummary(cartItems);
  const totalShipping = cartItems.reduce((total, item) => {
    if (item.freeShipping) return total;
    return total + (item.shippingCost || 0);
  }, 0);

  return (
    <Card className={className}>
      {/* ... resto del componente ... */}
      
      {/* Mostrar envío por separado */}
      {totalShipping > 0 && (
        <div className="flex justify-between items-center text-blue-600">
          <div className="flex items-center gap-1">
            <Truck className="h-4 w-4" />
            <span className="text-sm">Envío:</span>
          </div>
          <span className="font-medium">{formatPriceNumber(totalShipping)}</span>
        </div>
      )}
      
      {/* Total final incluyendo envío */}
      <div className="flex justify-between items-center text-lg font-bold">
        <div className="flex items-center gap-1">
          <DollarSign className="h-5 w-5" />
          <span>Total a pagar:</span>
        </div>
        <span>{formatPriceNumber(summary.total + totalShipping)}</span>
      </div>
    </Card>
  );
}
```

## 🔄 Flujo Completo

1. **Usuario agrega productos** al carrito (con costos de envío)
2. **Frontend calcula** totales incluyendo envío
3. **Frontend envía** `shippingCosts` al backend
4. **Backend procesa** y agrega envío a MercadoPago
5. **MercadoPago muestra** total correcto con envío
6. **Usuario paga** el monto total (productos + envío)
7. **Backend guarda** toda la información en Firestore

## ✅ Beneficios de esta Implementación

- **Sincronización perfecta** entre frontend y backend
- **Transparencia total** en costos de envío
- **Integración nativa** con MercadoPago
- **Trazabilidad completa** de la transacción
- **Experiencia de usuario** consistente

## 🧪 Para Probar

1. Agrega productos al carrito con diferentes costos de envío
2. Verifica que el resumen muestre envío por separado
3. Haz clic en "Pagar" y verifica que se envíe `shippingCosts`
4. Confirma que MercadoPago muestre el total correcto
5. Verifica en Firestore que se guarden todos los campos
