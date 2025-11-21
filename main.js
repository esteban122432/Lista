const URL_BASE = 'http://localhost:3000';
const ESTADOS_VALIDOS = ['P', 'A', 'T', 'RA', 'AP'];

async function cargarCursos() {
    const selectorCurso = document.getElementById('selectorCurso');
    const selectorCursoNuevo = document.getElementById('selectorCursoNuevo');
    
    try {
        const respuesta = await fetch(`${URL_BASE}/cursos`);
        const cursos = await respuesta.json(); 
        
        const opcionesCursos = cursos.map(curso => 
            `<option value="${curso.id}">${curso.nombre}</option>`
        ).join('');

        selectorCurso.innerHTML = '<option value="">-- Seleccione un Curso --</option>' + opcionesCursos;
        selectorCursoNuevo.innerHTML = '<option value="">-- Seleccione Curso --</option>' + opcionesCursos;
        
    } catch (error) {
        console.error('Error al cargar cursos:', error);
    }
}

async function cargarMaterias(cursoId) {
    const selectorMateria = document.getElementById('selectorMateria');
    selectorMateria.innerHTML = '<option value="">-- Cargando Materias --</option>';
    selectorMateria.disabled = true;

    if (!cursoId) {
        selectorMateria.innerHTML = '<option value="">-- Seleccione Curso Primero --</option>';
        return;
    }

    try {
        const respuesta = await fetch(`${URL_BASE}/materias/${cursoId}`);
        const materias = await respuesta.json();
        
        if (materias.length === 0) {
            selectorMateria.innerHTML = '<option value="">-- No hay Materias asignadas --</option>';
        } else {
            const opcionesMaterias = materias.map(materia => 
                `<option value="${materia.id}">${materia.nombre}</option>`
            ).join('');
            selectorMateria.innerHTML = '<option value="">-- Seleccione una Materia --</option>' + opcionesMaterias;
            selectorMateria.disabled = false;
        }

    } catch (error) {
        console.error('Error al cargar materias:', error);
        selectorMateria.innerHTML = '<p>Error de conexión.</p>';
    }
}

async function cargarAlumnos(cursoId, materiaId) {
    const listaAlumnos = document.getElementById('listaAlumnos');
    listaAlumnos.innerHTML = '<p>Cargando alumnos...</p>';

    if (!cursoId || !materiaId) {
        listaAlumnos.innerHTML = '<p>Seleccione un curso y una materia para cargar la lista de alumnos</p>';
        return;
    }

    try {
        const respuesta = await fetch(`${URL_BASE}/alumnos/${cursoId}`);
        const alumnos = await respuesta.json();

        if (alumnos.length === 0) {
            listaAlumnos.innerHTML = '<p>No se encontraron alumnos para este curso.</p>';
            return;
        }

        let tablaHTML = `
            <table class="tabla-asistencia">
                <thead>
                    <tr>
                        <th>Apellido, Nombre</th>
                        <th>P</th>
                        <th>A</th>
                        <th>T</th>
                        <th>RA</th>
                        <th>AP</th> <th>Último Reg.</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const alumno of alumnos) {
            const resAsistencia = await fetch(`${URL_BASE}/asistencia_reciente/${alumno.id}/${cursoId}/${materiaId}`);
            const asistencias = await resAsistencia.json();
            const estadoReciente = asistencias.estado || 'N/A';
            
            const generarRadio = (estado) => {
                const checked = estadoReciente === estado ? 'checked' : '';
                const activoClass = estadoReciente === estado ? 'activo' : '';
                return `
                    <label class="estado-label">
                        <input type="radio" name="estado-${alumno.id}" class="estado-radio" data-alumno-id="${alumno.id}" data-estado="${estado}" ${checked} onchange="manejarRegistro(this)">
                        <span class="radio-custom ${activoClass}"></span>
                        <span class="radio-text">${estado}</span>
                    </label>
                `;
            };

            tablaHTML += `
                <tr>
                    <td>${alumno.apellido}, ${alumno.nombre}</td>
                    <td class="radio-container">${generarRadio('P')}</td>
                    <td class="radio-container">${generarRadio('A')}</td>
                    <td class="radio-container">${generarRadio('T')}</td>
                    <td class="radio-container">${generarRadio('RA')}</td>
                    <td class="radio-container">${generarRadio('AP')}</td>
                    <td><span class="estado-reciente">${estadoReciente}</span></td>
                </tr>
            `;
        }

        tablaHTML += `</tbody></table>`;
        listaAlumnos.innerHTML = tablaHTML;

    } catch (error) {
        console.error('Error al cargar alumnos:', error);
        listaAlumnos.innerHTML = '<p>Error al cargar la lista de alumnos.</p>';
    }
}

window.manejarRegistro = async function(radioInput) {
    const selectorCurso = document.getElementById('selectorCurso');
    const selectorMateria = document.getElementById('selectorMateria');
    const inputInicio = document.getElementById('fechaInicio');
    const inputFin = document.getElementById('fechaFin');
    
    const alumno_id = radioInput.dataset.alumnoId;
    const estado = radioInput.dataset.estado;
    const curso_id = selectorCurso.value;
    const materia_id = selectorMateria.value;

    if (!curso_id || !materia_id) {
        alert('Error: Debe seleccionar un Curso y una Materia.');
        return;
    }
    
    const data = { alumno_id, curso_id, estado, materia_id };

    try {
        const respuesta = await fetch(`${URL_BASE}/registro`, { 
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const fila = radioInput.closest('tr');
        const celdaUltimoRegistro = fila.querySelector('.estado-reciente');
        
        if (respuesta.ok) {
            
            fila.querySelectorAll('.radio-custom').forEach(b => b.classList.remove('activo'));
            radioInput.nextElementSibling.classList.add('activo');
            
            celdaUltimoRegistro.textContent = estado;
            
            cargarHistorial(inputInicio.value, inputFin.value); 
        } else {
            const errorData = await respuesta.json();
            alert(`Error en registro. Mensaje: ${errorData.message}`);
        }

    } catch (error) {
        console.error('Error al registrar:', error);
        alert('Error crítico de conexión. Revise el servidor.');
    }
}

async function cargarHistorial(fechaInicio, fechaFin) {
    const contenedorTablaHistorial = document.getElementById('contenedorTablaHistorial');
    contenedorTablaHistorial.innerHTML = '<p>Cargando registros...</p>';

    if (!fechaInicio || !fechaFin) {
           contenedorTablaHistorial.innerHTML = '<p>Ingrese las fechas para ver el historial.</p>';
           return;
    }

    try {
        const url = `${URL_BASE}/historial?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
        const respuesta = await fetch(url);
        const historial = await respuesta.json();

        if (historial.length === 0) {
            contenedorTablaHistorial.innerHTML = '<p>No se encontraron registros en el rango de fechas.</p>';
            return;
        }

        let tablaHTML = `
            <table class="tabla-historial">
                <thead>
                    <tr>
                        <th>Fecha y Hora</th>
                        <th>Apellido y Nombre</th>
                        <th>Curso</th>
                        <th>Materia</th>
                        <th>Estado</th>
                        <th>Acciones</th> </tr>
                </thead>
                <tbody>
        `;

        historial.forEach(reg => {
            tablaHTML += `
                <tr>
                    <td>${reg.fecha_formato}</td>
                    <td>${reg.alumno_apellido}, ${reg.alumno_nombre}</td>
                    <td>${reg.curso_nombre}</td>
                    <td>${reg.materia_nombre}</td>
                    <td class="estado-historial estado-${reg.estado.toLowerCase()}">${reg.estado}</td>
                    <td class="historial-acciones">
                        <button class="btn-edit" onclick="manejarEditarAsistencia(${reg.registro_id})">E</button>
                        <button class="btn-delete" onclick="manejarBorrarAsistencia(${reg.registro_id})">X</button>
                    </td>
                </tr>
            `;
        });

        tablaHTML += `</tbody></table>`;
        contenedorTablaHistorial.innerHTML = tablaHTML;

    } catch (error) {
        console.error('Error al cargar historial:', error);
        contenedorTablaHistorial.innerHTML = '<p>Error de conexión al cargar el historial.</p>';
    }
}

window.manejarEditarAsistencia = async function(registroId) {
    const inputInicio = document.getElementById('fechaInicio');
    const inputFin = document.getElementById('fechaFin');

    const nuevoEstado = prompt(`Ingrese el nuevo estado para el registro ID ${registroId}. Opciones válidas: ${ESTADOS_VALIDOS.join(', ')}`);
    
    if (!nuevoEstado) {
        return;
    }
    
    const estadoUpper = nuevoEstado.toUpperCase();

    if (!ESTADOS_VALIDOS.includes(estadoUpper)) {
        alert(`Estado "${nuevoEstado}" inválido. Por favor, use uno de: ${ESTADOS_VALIDOS.join(', ')}`);
        return;
    }

    try {
        const respuesta = await fetch(`${URL_BASE}/registro/${registroId}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ estado: estadoUpper })
        });

        if (respuesta.ok) {
            alert('Registro actualizado con éxito.');
            cargarHistorial(inputInicio.value, inputFin.value);
        } else {
            const errorData = await respuesta.json();
            alert(`Error al actualizar: ${errorData.message}`);
        }
    } catch (error) {
        console.error('Error al editar:', error);
        alert('Error crítico de conexión al editar.');
    }
}

window.manejarBorrarAsistencia = async function(registroId) {
    if (!confirm(`¿Está seguro de que desea eliminar el registro de ID ${registroId}?`)) {
        return;
    }

    const inputInicio = document.getElementById('fechaInicio');
    const inputFin = document.getElementById('fechaFin');

    try {
        const respuesta = await fetch(`${URL_BASE}/registro/${registroId}`, {
            method: 'DELETE'
        });

        if (respuesta.ok) {
            alert('Registro eliminado con éxito.');
            cargarHistorial(inputInicio.value, inputFin.value);
        } else {
            const errorData = await respuesta.json();
            alert(`Error al eliminar: ${errorData.message}`);
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error crítico de conexión al eliminar.');
    }
}

function configurarFechasPorDefecto() {
    const inputInicio = document.getElementById('fechaInicio');
    const inputFin = document.getElementById('fechaFin');
    
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);

    const formatoFecha = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    inputFin.value = formatoFecha(hoy);
    inputInicio.value = formatoFecha(hace30Dias);
}

document.addEventListener('DOMContentLoaded', () => {
    const selectorCurso = document.getElementById('selectorCurso');
    const selectorMateria = document.getElementById('selectorMateria');
    const inputInicio = document.getElementById('fechaInicio');
    const inputFin = document.getElementById('fechaFin');
    const botonFiltrar = document.getElementById('botonFiltrar');
    
    const formularioAltaAlumno = document.getElementById('formularioAltaAlumno');
    const selectorCursoNuevo = document.getElementById('selectorCursoNuevo');
    const inputNombre = document.getElementById('inputNombre'); 
    const inputApellido = document.getElementById('inputApellido'); 
    const mensajeRespuesta = document.getElementById('mensajeRespuesta');

    selectorCurso.addEventListener('change', () => {
        const cursoId = selectorCurso.value;
        const materiaId = selectorMateria.value;
        cargarMaterias(cursoId);
        cargarAlumnos(cursoId, materiaId);
    });

    selectorMateria.addEventListener('change', () => {
        const cursoId = selectorCurso.value;
        const materiaId = selectorMateria.value;
        cargarAlumnos(cursoId, materiaId);
    });
    
    botonFiltrar.addEventListener('click', () => {
        const inicio = inputInicio.value;
        const fin = inputFin.value;
        cargarHistorial(inicio, fin);
    });

    formularioAltaAlumno.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            nombre: inputNombre.value,
            apellido: inputApellido.value,
            curso_id: selectorCursoNuevo.value
        };

        if (!data.nombre || !data.apellido || !data.curso_id) {
            mensajeRespuesta.textContent = 'Complete todos los campos.';
            mensajeRespuesta.style.color = 'black';
            return;
        }

        try {
            const respuesta = await fetch(`${URL_BASE}/alumno`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(data)
            });

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                mensajeRespuesta.textContent = `Éxito. ${resultado.message}`;
                mensajeRespuesta.style.color = 'black';
                
                formularioAltaAlumno.reset();
                
                if (selectorCurso.value === data.curso_id) {
                    const materiaId = selectorMateria.value;
                    cargarAlumnos(data.curso_id, materiaId);
                }
                
            } else {
                mensajeRespuesta.textContent = `Error: ${resultado.message}`;
                mensajeRespuesta.style.color = 'black';
            }
        } catch (error) {
            mensajeRespuesta.textContent = 'Error de red.';
            mensajeRespuesta.style.color = 'black';
        }
    });

    cargarCursos();
    configurarFechasPorDefecto(); 
    cargarHistorial(inputInicio.value, inputFin.value);
});
