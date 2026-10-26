export function cargarScriptWompi() {
  return new Promise((resolve, reject) => {
    if (window.WidgetCheckout) {
      resolve();
      return;
    }
    const existente = document.querySelector('script[data-wompi-widget]');
    if (existente) {
      existente.addEventListener('load', () => resolve());
      existente.addEventListener('error', () => reject(new Error('No se pudo cargar el checkout de Wompi')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.async = true;
    script.dataset.wompiWidget = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar el checkout de Wompi'));
    document.head.appendChild(script);
  });
}

export function abrirWidgetWompi({ intencion, onResultado }) {
  if (!window.WidgetCheckout) {
    throw new Error('El checkout de Wompi no esta disponible');
  }
  const checkout = new window.WidgetCheckout({
    currency: intencion.moneda,
    amountInCents: intencion.monto_en_centavos,
    reference: intencion.referencia,
    publicKey: intencion.llave_publica,
    signature: { integrity: intencion.firma_integridad },
    customerData: {
      email: intencion.customer_data?.email,
      fullName: intencion.customer_data?.full_name,
    },
  });
  checkout.open(onResultado);
  return checkout;
}
