# Backend modular de Asegúrate

Esta carpeta reemplaza únicamente el archivo `server.js` monolítico por una estructura modular.

## Instalación en GitHub

1. Crea/copias estas carpetas en la raíz del backend: `config`, `middleware`, `models`, `routes`, `services`, `utils`.
2. Reemplaza el `server.js` actual por el nuevo.
3. Agrega `app.js` en la misma carpeta donde está `server.js`.
4. No cambies `.env`, `package.json`, las variables de Vercel/Render ni la URL del frontend.
5. Sube todos los archivos en un solo commit.

Las rutas públicas y privadas conservan exactamente los mismos nombres. MongoDB utiliza las mismas colecciones y esquemas, por lo que no se requiere migración de datos.
