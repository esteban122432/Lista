// server.js
const http = require('http');
const path = require('path');
const fs = require('fs');
const db = require('./db'); // Mantenemos la conexión a la DB
const url = require('url');

const PORT = 3000;

// Función para servir archivos estáticos (HTML, CSS, JS)
function serveStaticFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error interno del servidor.');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Función principal que maneja todas las peticiones
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
   
    // --- 1. Manejo de Peticiones GET (Archivos Estáticos y API) ---

    // Sirve el archivo HTML principal
    if (pathname === '/' && req.method === 'GET') {
        serveStaticFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html');
        return;
    }

    // Sirve archivos CSS o JavaScript del frontend
    if (pathname.startsWith('/public/') && req.method === 'GET') {
        const filePath = path.join(__dirname, pathname);
        const contentType = pathname.endsWith('.css') ? 'text/css' : 'application/javascript';
        serveStaticFile(res, filePath, contentType);
        return;
    }

    // API para obtener estudiantes (GET /api/estudiantes/:cursoId)
    if (pathname.startsWith('/api/estudiantes/') && req.method === 'GET') {
        const cursoId = pathname.split('/').pop(); // Extrae el ID del final de la URL
       
        try {
            const query = 'SELECT estudiante_id, nombre FROM Estudiantes WHERE curso_id = ? ORDER BY nombre';
            const [rows] = await db.execute(query, [cursoId]);
           
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rows));
        } catch (error) {
            console.error('Error al obtener estudiantes:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error de base de datos.' }));
        }
        return;
    }
   
    // --- 2. Manejo de Peticiones POST (API para Guardar Asistencia) ---

    if (pathname === '/api/asistencia' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString(); // Concatena los datos recibidos
        });

        req.on('end', async () => {
            try {
                const registros = JSON.parse(body); // Parsea el JSON
                const fechaActual = new Date().toISOString().split('T')[0];
               
                const connection = await db.getConnection();
                await connection.beginTransaction();

                for (const registro of registros) {
                    const query = `
                        INSERT INTO Asistencias (estudiante_id, fecha, estado)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE estado = VALUES(estado)
                    `;
                    await connection.execute(query, [registro.estudiante_id, fechaActual, registro.estado]);
                }

                await connection.commit();
                connection.release();

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Asistencias guardadas.' }));
            } catch (error) {
                console.error('Error al registrar:', error);
                await connection.rollback(); // En caso de error
                connection.release();
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Error al registrar.' }));
            }
        });
        return;
    }

    // --- 3. Petición no encontrada (404) ---
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Ruta no encontrada');
});

server.listen(PORT, () => {

});