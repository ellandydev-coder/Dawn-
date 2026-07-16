📚 Antes de empezar 

Vamos a hacer 4 cosas:

Instalar Node.js (un programa que hace funcionar la app) → como instalar Word
Descargar la carpeta del proyecto → como bajar un archivo cualquiera
Instalar las piezas que necesita el proyecto → un solo comando
Arrancar la app → otro comando y listo 🎉

1️⃣ Instalar Node.js

Cómo instalarlo:
Abre este enlace en tu navegador (Chrome, Edge, Firefox):

👉 https://nodejs.org/es/

Verás DOS botones verdes grandes. Descarga el que dice:

text

LTS
Recomendado para la mayoría
⚠️ NO descargues el otro ("Current"), ese es para expertos.

Se descargará un archivo tipo node-v20.11.0-x64.msi. Ábrelo haciendo doble clic.

Aparecerá un asistente de instalación. Solo dale a "Next" en todo hasta que aparezca "Install".

💡 No cambies NADA. Solo Next → Next → Next → Install → Finish.

¿Cómo saber si funcionó?
Presiona la tecla Windows en tu teclado (la que tiene el logo)

Escribe: powershell

Presiona Enter → se abrirá una ventana azul o negra con letras

Escribe exactamente esto y dale Enter:

text

node --version
Debe aparecer algo como v20.11.0

despues haz Ctrl + ñ y se te abrira la terminal, ejecuta este comando: cd web-daw

Dentro de la web-daw escribe exactamente esto y dale Enter:

npm install Qué va a pasar:

Se descargarán muchas cositas de internet 📦
Tarda entre 2 y 5 minutos (depende de tu internet)
Verás mucho texto pasando rápido — es normal, no te asustes
Verás textos amarillos — son avisos, no importan
Solo debes preocuparte si ves textos rojos con la palabra "ERROR"

Al terminar verás algo como:

added 289 packages
found 0 vulnerabilities
✅ ¡Listo! Solo se hace esto UNA VEZ.

5️⃣ ¡Arrancar la app! 🚀
Ahora escribe:

text

npm run dev
Espera unos segundos. Aparecerá algo como:

text

VITE v8.1.3  ready in 210 ms

➜  Local:   http://localhost:5173/

Ahora:

Abre Google Chrome o Microsoft Edge

En la barra de direcciones (donde escribes google.com) escribe:

text

http://localhost:5173/

⚠️ Muy importante:
NO cierres la ventana negra de PowerShell mientras uses la app. Si la cierras, la app se apaga.
Para apagar la app: vuelve a la ventana negra y presiona Ctrl + C. Escribe S y Enter si te pregunta.
