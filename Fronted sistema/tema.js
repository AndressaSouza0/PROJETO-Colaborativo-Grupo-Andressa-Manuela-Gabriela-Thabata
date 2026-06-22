function alternarTema() {
    const html = document.documentElement;
    const icone = document.getElementById('iconeTema');
    const label = document.querySelector('#btnTema .nav-text');
    const noturno = html.classList.toggle('modo-noturno');
    localStorage.setItem('tema-preferido', noturno ? 'noturno' : 'claro');
    if (icone) icone.className = noturno ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    if (label) label.textContent = noturno ? 'Modo Claro' : 'Modo Noturno';
}

document.addEventListener('DOMContentLoaded', function () {
    const icone = document.getElementById('iconeTema');
    const label = document.querySelector('#btnTema .nav-text');
    if (document.documentElement.classList.contains('modo-noturno')) {
        if (icone) icone.className = 'bi bi-sun-fill';
        if (label) label.textContent = 'Modo Claro';
    }
});
