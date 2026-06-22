function setFonte(tamanho) {
    var html = document.documentElement;
    html.classList.remove('fonte-grande', 'fonte-extra');
    if (tamanho === 'grande') html.classList.add('fonte-grande');
    else if (tamanho === 'extra') html.classList.add('fonte-extra');
    localStorage.setItem('tamanho-fonte', tamanho);
    atualizarBtnsFonte(tamanho);
}

function atualizarBtnsFonte(tamanho) {
    document.querySelectorAll('.btn-fonte').forEach(function (btn) {
        btn.classList.toggle('ativo', btn.dataset.size === tamanho);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    var tamanho = localStorage.getItem('tamanho-fonte') || 'normal';
    atualizarBtnsFonte(tamanho);
});
