import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CREDENCIALES CHINA CIVIL ---
const firebaseConfig = {
  apiKey: "AIzaSyCy4L_T0s-SW0lHzpLiEDmVWJZToOl7rsM",
  authDomain: "china-civil.firebaseapp.com",
  projectId: "china-civil",
  storageBucket: "-civil.firebasestorage.app",
  messagingSenderId: "393154599336",
  appId: "1:393154599336:web:7d486cc943d5f343efa59d",
  measurementId: "G-W0ZF78V525"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ELEMENTOS DEL DOM ---
const inputDni = document.getElementById('dni');
const inputNombre = document.getElementById('nombre');

// --- BUSCADOR RENIEC (CONFIGURACIÓN PARA VERCEL) ---
inputDni.addEventListener('input', async (e) => {
    let dni = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = dni;

    if (dni.length === 8) {
        inputNombre.value = "BUSCANDO...";
        inputNombre.readOnly = true;

        try {
            const response = await fetch('/api/consulta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni: dni })
            });

            const result = await response.json();
            
            if (result && result.full_name) {
                inputNombre.value = result.full_name.toUpperCase();
                inputNombre.style.backgroundColor = "#f1f5f9";
                inputNombre.readOnly = true;
            } else {
                throw new Error("No hallado");
            }
        } catch (error) {
            console.error("Error en Vercel:", error);
            inputNombre.value = "";
            inputNombre.readOnly = false;
            inputNombre.placeholder = "No encontrado. Escriba manual";
            inputNombre.style.backgroundColor = "#fff4f4";
        }
    }
});

// --- CONFIGURACIÓN DE EMPRESAS ---
const EMPRESAS_CONFIG = {
    "China Civil": { rutaDefault: "Cusco - Challhuahuacho" },
    "CWE": { rutaDefault: "Cusco - Challhuahuacho" },
    "SINAR": { rutaDefault: "Cusco - Challhuahuacho" },
    "COMPANY": { rutaDefault: "Cusco - Challhuahuacho" }
};

// --- LÓGICA DE FIRMA ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function ajustarCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = 150;
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = "#000000";
}
ajustarCanvas();
window.addEventListener('resize', ajustarCanvas);

let dibujando = false;
const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    return { x, y };
};

canvas.onmousedown = (e) => { dibujando = true; ctx.beginPath(); ctx.moveTo(getPos(e).x, getPos(e).y); };
canvas.onmousemove = (e) => { 
    if(!dibujando) return; 
    if(e.touches) e.preventDefault(); 
    const p = getPos(e); 
    ctx.lineTo(p.x, p.y); 
    ctx.stroke(); 
};
window.onmouseup = () => dibujando = false;
canvas.ontouchstart = canvas.onmousedown; canvas.ontouchmove = canvas.onmousemove;
document.getElementById('clear').onclick = () => ctx.clearRect(0,0,canvas.width,canvas.height);

// --- GUARDAR EN FIREBASE (CON BLOQUEO DE DOBLE CLIC) ---
document.getElementById('save').onclick = async (e) => {
    const btn = e.target;
    const dni = inputDni.value;
    const nombre = inputNombre.value;
    const empresaActiva = document.getElementById('select-emp').value;

    if (empresaActiva === "") {
        alert("⚠️ ATENCIÓN: Es obligatorio seleccionar una empresa antes de guardar.");
        document.getElementById('select-emp').focus();
        return;
    }

    if(!dni || !nombre || nombre === "BUSCANDO...") {
        return alert("❌ Complete los datos");
    }
    
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const estaVacio = !Array.from(pixelData).some(p => p !== 0);
    if(estaVacio) return alert("❌ El trabajador debe firmar");

    // --- INICIO BLOQUEO ---
    btn.disabled = true;
    const textoOriginal = btn.innerText;
    btn.innerText = "GUARDANDO...";
    // ----------------------

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
    tempCtx.fillStyle = "#FFFFFF";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    const registro = {
        Fecha: new Date().toLocaleString(),
        Ruta: EMPRESAS_CONFIG[empresaActiva].rutaDefault,
        Empresa: empresaActiva,
        DNI: dni,
        Nombre: nombre,
        Firma: tempCanvas.toDataURL("image/jpeg", 0.6)
    };

    try {
        await addDoc(collection(db, "salidas"), registro);
        alert(`✅ Registrado correctamente`);
        location.reload();
    } catch (err) { 
        alert("❌ Error: " + err.message); 
        // --- DESBLOQUEO SI FALLA ---
        btn.disabled = false;
        btn.innerText = textoOriginal;
    }
};

// --- PDF Y EXCEL ---
document.getElementById('downloadPDF').onclick = async () => {
    const empresaFiltro = document.getElementById('select-download').value; 
    const querySnapshot = await getDocs(query(collection(db, "salidas"), orderBy("Fecha", "desc")));
    const registros = [];
    querySnapshot.forEach((doc) => {
        if(doc.data().Empresa === empresaFiltro) registros.push(doc.data());
    });

    if(registros.length === 0) return alert("No hay datos.");

    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    docPdf.text(`REPORTE: ${empresaFiltro.toUpperCase()}`, 14, 20);

    docPdf.autoTable({
        startY: 30,
        head: [['Fecha', 'Ruta', 'DNI', 'Nombre', 'Firma']],
        body: registros.map(r => [r.Fecha, r.Ruta, r.DNI, r.Nombre, ""]),
        didDrawCell: (data) => {
            if (data.column.index === 4 && data.cell.section === 'body') {
                const img = registros[data.row.index].Firma;
                docPdf.addImage(img, 'JPEG', data.cell.x + 2, data.cell.y + 2, 20, 10);
            }
        },
        styles: { minCellHeight: 15, verticalAlign: 'middle' }
    });
    docPdf.save(`Reporte_${empresaFiltro}.pdf`);
};

document.getElementById('downloadExcel').onclick = async () => {
    const empresaFiltro = document.getElementById('select-download').value;
    const querySnapshot = await getDocs(query(collection(db, "salidas"), orderBy("Fecha", "desc")));
    const registros = [];
    querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.Empresa === empresaFiltro) {
            registros.push({ Fecha: d.Fecha, Ruta: d.Ruta, DNI: d.DNI, Nombre: d.Nombre });
        }
    });

    if (registros.length === 0) return alert("Sin datos.");
    const hoja = XLSX.utils.json_to_sheet(registros);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Data");
    XLSX.writeFile(libro, `Excel_${empresaFiltro}.xlsx`);
};

// --- SIDEBAR ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay'); 

document.getElementById('menu-open').onclick = async () => {
    sidebar.classList.add('open');
    overlay.style.display = 'block';
    const snap = await getDocs(collection(db, "salidas"));
    document.getElementById('admin-count').innerText = snap.size;
};

document.getElementById('menu-close').onclick = () => { sidebar.classList.remove('open'); overlay.style.display = 'none'; };

document.getElementById('select-emp').addEventListener('change', (e) => {
    document.getElementById('empresa-display').innerText = e.target.value;
});

document.getElementById('clearDB').onclick = async () => {
    if (confirm("⚠️ ¿Borrar nube?") && prompt("Pass:") === "76161525") {
        const snap = await getDocs(collection(db, "salidas"));
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        alert("✅ Nube limpia");
        location.reload();
    }
};




