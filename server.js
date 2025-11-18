const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: '127.0.0.1', 
    user: 'root', 
    password: '',     
    database: 'escuela',
    port: 3306, 
};

const db = mysql.createConnection(dbConfig);

db.connect(err => {
    if (err) {
        console.error('error db:', err.stack);
        console.log('🔴 error: revisa mysql.');
        return;
    }
    console.log(`✅ conexión a "${dbConfig.database}" exitosa.`);
});

app.get('/cursos', (req, res) => {
    db.query('SELECT * FROM cursos ORDER BY id', (err, results) => {
        if (err) return res.status(500).json({ message: 'Error al obtener Cursos.' });
        res.json(results);
    });
});

app.get('/materias/:cursoId', (req, res) => {
    const { cursoId } = req.params;
    const sql = `
        SELECT m.id, m.nombre
        FROM materias m
        JOIN curso_materia cm ON m.id = cm.materia_id
        WHERE cm.curso_id = ?
        ORDER BY m.nombre`;
    db.query(sql, [cursoId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error al obtener Materias.' });
        res.json(results);
    });
});

app.get('/alumnos/:cursoId', (req, res) => {
    const { cursoId } = req.params;
    const sql = 'SELECT id, nombre, apellido FROM alumnos WHERE curso_id = ? ORDER BY apellido';
    db.query(sql, [cursoId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error al obtener alumnos.' });
        res.json(results);
    });
});

app.get('/asistencia_reciente/:alumnoId/:cursoId/:materiaId', (req, res) => {
    const { alumnoId, cursoId, materiaId } = req.params;
    const sql = `
        SELECT estado 
        FROM asistencia 
        WHERE alumno_id = ? AND curso_id = ? AND materia_id = ?
        ORDER BY fecha DESC LIMIT 1`;
    db.query(sql, [alumnoId, cursoId, materiaId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error al obtener asistencia reciente.' });
        if (results.length === 0) return res.json({});
        res.json(results[0]);
    });
});

app.post('/registro', (req, res) => {
    const { alumno_id, curso_id, estado, materia_id } = req.body;
    
    const estadosValidos = ['P', 'A', 'T', 'RA', 'AP'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ message: `Estado inválido: ${estado}.` });
    }

    if (!alumno_id || !curso_id || !materia_id || !estado) {
        return res.status(400).json({ message: 'Faltan campos requeridos.' });
    }

    const sql = 'INSERT INTO asistencia (alumno_id, curso_id, materia_id, estado) VALUES (?, ?, ?, ?)';
    db.query(sql, [alumno_id, curso_id, materia_id, estado], (err, result) => {
        if (err) {
            console.error('error al registrar asistencia:', err);
            return res.status(500).json({ message: 'Error al insertar registro en la BD.' });
        }
        res.status(201).json({ message: 'Registro de asistencia exitoso.' });
    });
});

app.get('/historial', (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;

    let sql = `
        SELECT 
            a.id AS registro_id,
            a.fecha,
            DATE_FORMAT(a.fecha, '%d/%m/%Y %H:%i') AS fecha_formato,
            a.estado,
            al.nombre AS alumno_nombre,
            al.apellido AS alumno_apellido,
            c.nombre AS curso_nombre,
            m.nombre AS materia_nombre
        FROM asistencia a
        JOIN alumnos al ON a.alumno_id = al.id
        JOIN cursos c ON a.curso_id = c.id
        JOIN materias m ON a.materia_id = m.id
    `;
    let params = [];

    if (fecha_inicio && fecha_fin) {
        sql += ' WHERE DATE(a.fecha) BETWEEN ? AND ?';
        params = [fecha_inicio, fecha_fin];
    }
    
    sql += ' ORDER BY a.fecha DESC';

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error al obtener historial.' });
        res.json(results);
    });
});

app.put('/registro/:id', (req, res) => {
    const registroId = req.params.id;
    const { estado } = req.body;
    
    const estadosValidos = ['P', 'A', 'T', 'RA', 'AP'];
    if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ message: `Estado inválido: ${estado}. Los estados válidos son ${estadosValidos.join(', ')}.` });
    }

    const sql = 'UPDATE asistencia SET estado = ?, fecha = CURRENT_TIMESTAMP WHERE id = ?';
    db.query(sql, [estado, registroId], (err, result) => {
        if (err) {
            console.error('Error al actualizar registro:', err);
            return res.status(500).json({ message: 'Error al actualizar registro.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Registro no encontrado.' });
        res.json({ message: 'Registro de asistencia actualizado con éxito.' });
    });
});

app.delete('/registro/:id', (req, res) => {
    const registroId = req.params.id;

    const sql = 'DELETE FROM asistencia WHERE id = ?';
    db.query(sql, [registroId], (err, result) => {
        if (err) {
            console.error('Error al eliminar registro:', err);
            return res.status(500).json({ message: 'Error al eliminar registro.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Registro no encontrado.' });
        res.json({ message: 'Registro de asistencia eliminado con éxito.' });
    });
});

app.post('/alumno', (req, res) => {
    const { nombre, apellido, curso_id } = req.body;
    
    if (!nombre || !apellido || !curso_id) {
        return res.status(400).json({ message: 'Faltan campos: nombre, apellido o ID de Curso.' });
    }

    const sql = 'INSERT INTO alumnos (nombre, apellido, curso_id) VALUES (?, ?, ?)';
    db.query(sql, [nombre, apellido, curso_id], (err, result) => {
        if (err) {
            console.error('error al agregar alumno:', err);
            return res.status(500).json({ message: 'Error al insertar el nuevo alumno en la BD.' });
        }
        res.status(201).json({ message: 'Alumno agregado con éxito.', id: result.insertId });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});