const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* =================================================================-
   LIVROS FLUTUANTES — gerados dinamicamente no painel esquerdo
   ================================================================ */
function criarLivrosAnimados() {
    const container = document.getElementById('livros-bg');
    const cores = [
        '#2d6be4','#3b82f6','#7c3aed','#9333ea',
        '#0ea5e9','#6366f1','#14b8a6','#0891b2',
        '#1d4ed8','#4f46e5','#7e22ce','#0e7490'
    ];

    for (let i = 0; i < 14; i++) {
        const livro = document.createElement('div');
        livro.className = 'livro-particula';

        const largura  = Math.random() * 18 + 13;           // 13–31px
        const altura   = Math.random() * 42 + 48;           // 48–90px
        const left     = Math.random() * 88 + 4;            // 4–92%
        const duracao  = Math.random() * 12 + 9;            // 9–21s
        const delay    = -(Math.random() * duracao);        // offset negativo = começa no meio
        const cor      = cores[Math.floor(Math.random() * cores.length)];
        const opacMax  = (Math.random() * 0.35 + 0.25).toFixed(2);

        livro.style.cssText = `
            left: ${left}%;
            width: ${largura}px;
            height: ${altura}px;
            background: ${cor};
            animation-duration: ${duracao}s;
            animation-delay: ${delay}s;
            --op: ${opacMax};
        `;

        container.appendChild(livro);
    }
}

/* ================================================================
   ABAS — alternância entre Login e Cadastro
   ================================================================ */
function mudarAba(aba) {
    const botoes      = document.querySelectorAll('.aba');
    const formLogin   = document.getElementById('form-login');
    const formCad     = document.getElementById('form-cadastro');
    const indicador   = document.getElementById('abaIndicador');
    const abaAtiva    = document.querySelector(`.aba[data-aba="${aba}"]`);

    /* posicionar o slider indicador */
    indicador.style.left  = abaAtiva.offsetLeft + 'px';
    indicador.style.width = abaAtiva.offsetWidth + 'px';

    botoes.forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));

    if (aba === 'login') {
        formCad.classList.remove('ativo');
        formCad.classList.add('saindo');
        setTimeout(() => { formCad.classList.remove('saindo'); }, 250);
        setTimeout(() => { formLogin.classList.add('ativo'); }, 260);
    } else {
        formLogin.classList.remove('ativo');
        formLogin.classList.add('saindo');
        setTimeout(() => { formLogin.classList.remove('saindo'); }, 250);
        setTimeout(() => { formCad.classList.add('ativo'); }, 260);
    }

    limparAlertas();
}

/* ================================================================
   INICIALIZAR INDICADOR DAS ABAS
   ================================================================ */
function inicializarIndicador() {
    const abaAtiva  = document.querySelector('.aba.ativa');
    const indicador = document.getElementById('abaIndicador');
    if (abaAtiva && indicador) {
        indicador.style.left  = abaAtiva.offsetLeft + 'px';
        indicador.style.width = abaAtiva.offsetWidth + 'px';
    }
}

/* ================================================================
   VER / OCULTAR SENHA
   ================================================================ */
function verSenha(inputId, btn) {
    const input = document.getElementById(inputId);
    const icone = btn.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icone.classList.replace('bi-eye', 'bi-eye-slash');
    } else {
        input.type = 'password';
        icone.classList.replace('bi-eye-slash', 'bi-eye');
    }
}

/* ================================================================
   FORÇA DA SENHA
   ================================================================ */
function verificarForca(valor) {
    const wrapper = document.getElementById('forca-senha');
    const texto   = document.getElementById('texto-forca');
    const barras  = ['b1','b2','b3','b4'].map(id => document.getElementById(id));

    if (!valor) {
        wrapper.classList.remove('visivel');
        return;
    }

    wrapper.classList.add('visivel');

    let pontos = 0;
    if (valor.length >= 8)            pontos++;
    if (/[A-Z]/.test(valor))          pontos++;
    if (/[0-9]/.test(valor))          pontos++;
    if (/[^A-Za-z0-9]/.test(valor))   pontos++;

    const config = [
        { cor: '#e53e3e', label: 'Muito fraca' },
        { cor: '#f59f00', label: 'Fraca'        },
        { cor: '#1a73e8', label: 'Boa'          },
        { cor: '#0ca678', label: 'Forte'        },
    ];

    barras.forEach((barra, i) => {
        barra.style.background = i < pontos ? config[pontos - 1].cor : '#e0e4e9';
    });

    if (pontos > 0) {
        texto.textContent = config[pontos - 1].label;
        texto.style.color = config[pontos - 1].cor;
    } else {
        texto.textContent = '';
    }
}

/* ================================================================
   RIPPLE NO BOTÃO
   ================================================================ */
function criarRipple(evento, btn) {
    const rect   = btn.getBoundingClientRect();
    const tam    = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `
        width: ${tam}px; height: ${tam}px;
        left: ${evento.clientX - rect.left - tam / 2}px;
        top:  ${evento.clientY - rect.top  - tam / 2}px;
    `;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

/* ================================================================
   ESTADO DE CARREGAMENTO DO BOTÃO
   ================================================================ */
function ativarLoading(btn, ativo) {
    const textoEl   = btn.querySelector('.btn-texto');
    const iconeEl   = btn.querySelector('.btn-icone');
    const loadingEl = btn.querySelector('.btn-loading');

    btn.disabled     = ativo;
    textoEl.textContent  = ativo ? (btn.id === 'btn-login' ? 'Entrando…' : 'Criando conta…') : (btn.id === 'btn-login' ? 'Entrar' : 'Criar conta');
    if (iconeEl)   iconeEl.style.display   = ativo ? 'none' : '';
    if (loadingEl) loadingEl.style.display = ativo ? 'flex' : 'none';
}

/* ================================================================
   EXIBIR ALERTA
   ================================================================ */
function exibirAlerta(id, mensagem, tipo) {
    const el = document.getElementById(id);
    el.innerHTML = `<i class="bi bi-${tipo === 'sucesso' ? 'check-circle' : 'exclamation-circle'}"></i> ${mensagem}`;
    el.className = `alerta ${tipo}`;

    if (tipo === 'erro') {
        const form = el.closest('.formulario');
        if (form) {
            form.classList.add('chacoalhar');
            form.addEventListener('animationend', () => form.classList.remove('chacoalhar'), { once: true });
        }
    }

    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = 'alerta'; el.textContent = ''; }, 5000);
}

function limparAlertas() {
    ['alerta-login','alerta-cadastro'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.className = 'alerta'; el.textContent = ''; }
    });
}

/* ================================================================
   FORMULÁRIO DE LOGIN
   ================================================================ */
async function fazerLogin(evento) {
    evento.preventDefault();
    const btn   = document.getElementById('btn-login');
    const email = document.getElementById('l-email').value.trim();
    const senha = document.getElementById('l-senha').value;

    criarRipple(evento, btn);
    ativarLoading(btn, true);

    try {
        const { data, error } = await supabaseClient
            .from('administradores')
            .select('*')
            .eq('email', email)
            .eq('ativo', true)
            .single();

        if (error || !data) {
            exibirAlerta('alerta-login', 'E-mail ou senha incorretos.', 'erro');
            ativarLoading(btn, false);
            return;
        }

        const lib = (window.dcodeIO && window.dcodeIO.bcrypt) || window.bcrypt;
        const senhaCorreta = await lib.compare(senha, data.senha_hash);

        if (!senhaCorreta) {
            exibirAlerta('alerta-login', 'E-mail ou senha incorretos.', 'erro');
            ativarLoading(btn, false);
            return;
        }

        await supabaseClient
            .from('administradores')
            .update({ ultimo_acesso: new Date().toISOString() })
            .eq('id', data.id);

        sessionStorage.setItem('admin', JSON.stringify({
            id: data.id,
            nome: data.nome,
            email: data.email,
            cargo: data.cargo
        }));

        exibirAlerta('alerta-login', 'Login realizado com sucesso! Redirecionando…', 'sucesso');
        setTimeout(() => {
            window.location.href = '/Fronted sistema/dashboard/dashboard.html';
        }, 1200);

    } catch (err) {
        console.error('Erro no login:', err);
        exibirAlerta('alerta-login', `Erro: ${err.message || 'Tente novamente.'}`, 'erro');
        ativarLoading(btn, false);
    }
}

/* ================================================================
   FORMULÁRIO DE CADASTRO
   ================================================================ */
async function fazerCadastro(evento) {
    evento.preventDefault();

    const nome      = document.getElementById('c-nome').value.trim();
    const email     = document.getElementById('c-email').value.trim();
    const cargo     = document.getElementById('c-cargo').value;
    const senha     = document.getElementById('c-senha').value;
    const confirmar = document.getElementById('c-confirmar').value;
    const btn       = document.getElementById('btn-cadastro');

    /* Validações */
    if (nome.length < 3) {
        exibirAlerta('alerta-cadastro', 'Informe o nome completo.', 'erro');
        return;
    }

    if (senha.length < 8) {
        exibirAlerta('alerta-cadastro', 'A senha deve ter ao menos 8 caracteres.', 'erro');
        return;
    }

    if (senha !== confirmar) {
        exibirAlerta('alerta-cadastro', 'As senhas não coincidem.', 'erro');
        return;
    }

    criarRipple(evento, btn);
    ativarLoading(btn, true);

    try {
        const lib = (window.dcodeIO && window.dcodeIO.bcrypt) || window.bcrypt;
        const senhaHash = await lib.hash(senha, 10);

        const { error } = await supabaseClient
            .from('administradores')
            .insert([{ nome, email, cargo, senha_hash: senhaHash }]);

        if (error) {
            const msg = error.code === '23505'
                ? 'Este e-mail já está cadastrado.'
                : 'Erro ao criar conta. Tente novamente.';
            exibirAlerta('alerta-cadastro', msg, 'erro');
            ativarLoading(btn, false);
            return;
        }

        exibirAlerta('alerta-cadastro', 'Conta criada com sucesso!', 'sucesso');
        evento.target.reset();
        document.getElementById('forca-senha').classList.remove('visivel');
        setTimeout(() => mudarAba('login'), 2200);
        ativarLoading(btn, false);

    } catch (err) {
        console.error('Erro no cadastro:', err);
        exibirAlerta('alerta-cadastro', `Erro: ${err.message || 'Tente novamente.'}`, 'erro');
        ativarLoading(btn, false);
    }
}

/* ================================================================
   ESQUECI A SENHA
   ================================================================ */
function esqueceuSenha() {
    const email = document.getElementById('l-email').value.trim();
    if (!email) {
        exibirAlerta('alerta-login', 'Informe seu e-mail antes de solicitar a recuperação.', 'erro');
    } else {
        exibirAlerta('alerta-login', `Link de recuperação enviado para ${email}.`, 'sucesso');
    }
    return false;
}

/* ================================================================
   INICIALIZAÇÃO
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    criarLivrosAnimados();
    inicializarIndicador();

    /* Adicionar ripple aos botões principais */
    document.querySelectorAll('.btn-principal').forEach(btn => {
        btn.addEventListener('click', e => criarRipple(e, btn));
    });
});

/* Recalcular indicador ao redimensionar */
window.addEventListener('resize', inicializarIndicador);
