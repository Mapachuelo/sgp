# Validar QR
Instrucciones para validar un QR:
- Solo el empleado puede verlo y validarlo.
- El cliente no puede verlo ni validarlo.
- La camara debe escanear el QR y mostrar un mensaje de confirmación.
- Se sincroniza con la tabla de clientes para verificar que el cliente es valido y se le permite el acceso al evento.

Diseño a tomar como referencia:

 ``bash
<div style="width: 1920px; height: 1080px; position: relative; background: white; overflow: hidden">
  <div style="width: 1920px; height: 152px; left: 0px; top: 0px; position: absolute; background: #422822"></div>
  <div style="width: 208px; height: 86px; left: 1668px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 1730px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Login</div>
  <div style="width: 336px; height: 86px; left: 1282px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 1337px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word"> Ver calendario</div>
  <div style="left: 66px; top: 49px; position: absolute; color: white; font-size: 48px; font-family: Inter; font-weight: 400; word-wrap: break-word">Prueba</div>
  <div style="width: 336px; height: 86px; left: 112px; top: 263px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 187px; top: 284px; position: absolute; color: black; font-size: 36px; font-family: Inter; font-weight: 400; word-wrap: break-word">Validad QR</div>
  <div style="left: 169px; top: 402px; position: absolute; color: black; font-size: 36px; font-family: Inter; font-weight: 400; word-wrap: break-word">Mensaje de <br/>confirmación</div>
  <div style="width: 336px; height: 86px; left: 896px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 951px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Verificar cliente</div>
  <div style="width: 336px; height: 86px; left: 513px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 582px; top: 58px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Validación QR</div>
  <div style="width: 1199px; height: 787px; left: 573px; top: 201px; position: absolute; background: #D9D9D9; border-radius: 5px"></div>
</div>
 ``
