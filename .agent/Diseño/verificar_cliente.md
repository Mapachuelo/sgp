# Verificar cliente 
Instrucciones:
- Solo lo puede ver aquellas personas que hayan iniciado sesión mediante cuanta de empleado, si no han iniciado sesión no pueden ver esta sección.
- En esta sección se muestra el calendario de clientes, donde se muestra la fecha, día y hora de cada cita, además de un botón para verificar al cliente, el cual se muestra solo si el cliente tiene una cita programada para ese día, al hacer clic en el botón se muestra un mensaje de confirmación, si el cliente no tiene una cita programada para ese día, el botón no se muestra.
- La lista debe tener horario de 6:00 a 22:00, con intervalos de 30 minutos, y debe mostrar los días de la semana, además de la fecha correspondiente a cada día. 
- El empleado puede colocar día de no trabajo, para que el cliente no pueda agendar cita ese día, y el botón de verificar cliente no se muestre ese día.
- El empleado puede decidir que horario trabajar cada día, por ejemplo, puede decidir trabajar de 6:00 a 14:00, y el horario de 14:00 a 22:00 no se muestre en el calendario, y el botón de verificar cliente no se muestre en ese horario.

Diseño a tomar como referencia:

``bash
<div style="width: 1920px; height: 1080px; position: relative; background: white; overflow: hidden">
  <div style="width: 1920px; height: 152px; left: 0px; top: 0px; position: absolute; background: #422822"></div>
  <div style="width: 208px; height: 86px; left: 1668px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 1730px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Login</div>
  <div style="width: 336px; height: 86px; left: 1282px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 1337px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word"> Ver calendario</div>
  <div style="left: 66px; top: 49px; position: absolute; color: white; font-size: 48px; font-family: Inter; font-weight: 400; word-wrap: break-word">Prueba</div>
  <div style="width: 1688px; height: 791px; left: 116px; top: 239px; position: absolute; background: #D9D9D9; border-radius: 5px"></div>
  <div style="left: 116px; top: 181px; position: absolute; color: black; font-size: 48px; font-family: Inter; font-weight: 400; word-wrap: break-word">Calendario de clientes</div>
  <div style="width: 792px; height: 0px; left: 283px; top: 238px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 792px; height: 0px; left: 454px; top: 239px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 792px; height: 0px; left: 808px; top: 239px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 792px; height: 0px; left: 982px; top: 239px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 792px; height: 0px; left: 1154px; top: 239px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 792px; height: 0px; left: 1314px; top: 239px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 792px; height: 0px; left: 1474px; top: 239px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 792px; height: 0px; left: 1640px; top: 239px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 117px; top: 301px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 117px; top: 445px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 118px; top: 517px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 116px; top: 589px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 116px; top: 733px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 117px; top: 805px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 117px; top: 661px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 115px; top: 877px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 116px; top: 949px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 792px; height: 0px; left: 632px; top: 240px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 1686.01px; height: 0px; left: 118px; top: 373px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 22px; height: 790px; left: 1813px; top: 238px; position: absolute; background: #D9D9D9; border-radius: 5px"></div>
  <div style="width: 12px; height: 624px; left: 1818px; top: 247px; position: absolute; background: #B5B5B5; border-radius: 5px"></div>
  <div style="left: 155px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Fecha</div>
  <div style="left: 301px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">02-01-026</div>
  <div style="left: 483px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">03-01-026</div>
  <div style="left: 660px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">04-01-026</div>
  <div style="left: 842px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">05-01-026</div>
  <div style="left: 1008px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">06-01-026</div>
  <div style="left: 1174px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">07-01-026</div>
  <div style="left: 1340px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">08-01-026</div>
  <div style="left: 1500px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">09-01-026</div>
  <div style="left: 1658px; top: 255px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">10-01-026</div>
  <div style="left: 166px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Día</div>
  <div style="left: 301px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Viernes</div>
  <div style="left: 483px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Sabado</div>
  <div style="left: 660px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Domingo</div>
  <div style="left: 842px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Lunes</div>
  <div style="left: 1008px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Martes</div>
  <div style="left: 1174px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Miercoles</div>
  <div style="left: 1340px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Jueves</div>
  <div style="left: 1500px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Viernes</div>
  <div style="left: 1658px; top: 327px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">Sabado</div>
  <div style="left: 170px; top: 399px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">8:00</div>
  <div style="left: 166px; top: 471px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">8:30</div>
  <div style="left: 170px; top: 543px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">9:00</div>
  <div style="left: 170px; top: 613px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">9:30</div>
  <div style="left: 170px; top: 692px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">10:00</div>
  <div style="left: 172px; top: 764px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">10:30</div>
  <div style="left: 170px; top: 836px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">11:00</div>
  <div style="left: 170px; top: 906px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">11:30</div>
  <div style="left: 166px; top: 980px; position: absolute; color: black; font-size: 24px; font-family: Inter; font-weight: 400; word-wrap: break-word">12:00</div>
  <div style="width: 336px; height: 86px; left: 910px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 965px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Verificar cliente</div>
  <div style="width: 336px; height: 86px; left: 527px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 596px; top: 58px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Validación QR</div>
</div>
``
