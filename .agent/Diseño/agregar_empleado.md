# Agregar empleado
Instrucciones para agregar un empleado:
- Solo el administrador puede agregar un empleado.
- El administrador debe llenar un formulario con el nombre, apellido, número de teléfono, identificación y correo del empleado.
- Al hacer clic en el botón "Agregar empleado", se debe validar que todos los campos estén completos y que el número de teléfono y la identificación sean únicos en la base de datos.
- Si la validación es exitosa, se debe agregar el empleado a la base de datos y mostrar un mensaje de confirmación.
- Si la validación falla, se debe mostrar un mensaje de error indicando qué campos son incorrectos o están vacíos.
- La lista de empleados debe actualizarse automáticamente para reflejar el nuevo empleado agregado.

``bash
<div style="width: 1920px; height: 1080px; position: relative; background: white; overflow: hidden">
  <div style="width: 1920px; height: 152px; left: 0px; top: 0px; position: absolute; background: #422822"></div>
  <div style="left: 66px; top: 49px; position: absolute; color: white; font-size: 48px; font-family: Inter; font-weight: 400; word-wrap: break-word">Prueba</div>
  <div style="width: 550px; height: 698px; left: 161px; top: 290px; position: absolute; background: #D9D9D9"></div>
  <div style="width: 208px; height: 86px; left: 1686px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 1748px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Login</div>
  <div style="width: 336px; height: 86px; left: 1314px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 1369px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word"> Ver calendario</div>
  <div style="width: 336px; height: 86px; left: 947px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 1002px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Verificar cliente</div>
  <div style="width: 288px; height: 86px; left: 623px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 662px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Validación QR</div>
  <div style="width: 313px; height: 86px; left: 279px; top: 33px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 300px; top: 56px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Ingreso empleado</div>
  <div style="width: 984px; height: 698px; left: 847px; top: 290px; position: absolute; background: #D9D9D9"></div>
  <div style="left: 161px; top: 197px; position: absolute; color: black; font-size: 40px; font-family: Inter; font-weight: 400; word-wrap: break-word">Ingreso empleado</div>
  <div style="left: 858px; top: 206px; position: absolute; color: black; font-size: 40px; font-family: Inter; font-weight: 400; word-wrap: break-word">Lista empleado</div>
  <div style="left: 228px; top: 343px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Nombre</div>
  <div style="left: 228px; top: 427px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Apellido</div>
  <div style="left: 230px; top: 519px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Numero</div>
  <div style="left: 225px; top: 608px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Identificación</div>
  <div style="left: 225px; top: 700px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Correo</div>
  <div style="width: 313px; height: 86px; left: 258px; top: 832px; position: absolute; background: #D97F6A; border-radius: 5px"></div>
  <div style="left: 279px; top: 855px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Agregar empleado</div>
  <div style="width: 453px; height: 35px; left: 202px; top: 382px; position: absolute; background: white; border-radius: 5px"></div>
  <div style="width: 453px; height: 35px; left: 202px; top: 469px; position: absolute; background: white; border-radius: 5px"></div>
  <div style="width: 453px; height: 35px; left: 202px; top: 561px; position: absolute; background: white; border-radius: 5px"></div>
  <div style="width: 453px; height: 35px; left: 202px; top: 656px; position: absolute; background: white; border-radius: 5px"></div>
  <div style="width: 453px; height: 35px; left: 202px; top: 755px; position: absolute; background: white; border-radius: 5px"></div>
  <div style="width: 693px; height: 0px; left: 1002px; top: 290px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 984.03px; height: 0px; left: 847px; top: 356.75px; position: absolute; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="left: 871px; top: 304px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">nombre</div>
  <div style="width: 693px; height: 0px; left: 1176px; top: 290px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 693px; height: 0px; left: 1369px; top: 292px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="width: 693px; height: 0px; left: 1634px; top: 290px; position: absolute; transform: rotate(90deg); transform-origin: top left; outline: 1px black solid; outline-offset: -0.50px"></div>
  <div style="left: 1028px; top: 304px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">apellido</div>
  <div style="left: 1213px; top: 304px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Numero</div>
  <div style="left: 1407px; top: 304px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">identicación</div>
  <div style="left: 1675px; top: 304px; position: absolute; color: black; font-size: 32px; font-family: Inter; font-weight: 400; word-wrap: break-word">Correo</div>
</div>
``
