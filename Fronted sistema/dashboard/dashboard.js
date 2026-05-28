// --- SUPABASE ---
const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Paleta de cores para o gráfico de gêneros
const CHART_COLORS = [
    '#1a73e8', '#7c3aed', '#0ca678', '#e53e3e',
    '#d01264', '#d97706', '#0284c7', '#059669',
    '#dc2626', '#9333ea', '#0891b2', '#65a30d'
];

// -----------------------------------------------------------
// INICIALIZAÇÃO
// -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    exibirDataESaudacao();
    carregarDashboard();
});

// -----------------------------------------------------------
// DATA E SAUDAÇÃO
// -----------------------------------------------------------
function exibirDataESaudacao() {
    const agora = new Date();
    const hora  = agora.getHours();

    let saudacao = hora < 12 ? 'Bom dia!' : hora < 18 ? 'Boa tarde!' : 'Boa noite!';
    document.getElementById('saudacao').textContent = saudacao;

    document.getElementById('dataAtual').textContent = agora.toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
}

// -----------------------------------------------------------
// CARREGAMENTO PRINCIPAL
// Todas as queries rodam em paralelo para carregar mais rápido.
// -----------------------------------------------------------
async function carregarDashboard() {
    // Marca todos os valores como "carregando"
    ['totalLivros','totalAlunos','emprestimosAtivos','emprestimosAtrasados',
     'exemplasDisponiveis','totalDoacoes','alunosBloqueados','totalGeneros'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '…'; el.classList.add('loading'); }
    });

    try {
        // Busca tudo em paralelo
        const [
            resTotalLivros,
            resAlunos,
            resEmprestimos,
            resExemplares,
            resDoacoes,
            resGeneros
        ] = await Promise.all([
            supabaseClient.from('livros').select('isbn', { count: 'exact', head: true }),
            supabaseClient.from('alunos').select('status'),
            supabaseClient.from('emprestimos').select('id, status, data_prevista, created_at, alunos(nome_aluno), exemplares(codigo_rfid, livros(titulo))'),
            supabaseClient.from('exemplares').select('status'),
            supabaseClient.from('doacoes').select('nome_doador, titulo, genero, created_at').order('created_at', { ascending: false }).limit(5),
            supabaseClient.from('generos').select('nome', { count: 'exact', head: true })
        ]);

        // --- Processa alunos ---
        const alunos        = resAlunos.data   || [];
        const totalAlunos   = alunos.length;
        const bloqueados    = alunos.filter(a => a.status === 'Bloqueado').length;

        // --- Processa empréstimos ---
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const emprestimos = resEmprestimos.data || [];
        const ativos      = emprestimos.filter(e => e.status === 'Ativo').length;
        const atrasados   = emprestimos.filter(e => {
            if (e.status === 'Devolvido') return false;
            const dv = new Date(e.data_prevista); dv.setHours(0,0,0,0);
            return hoje > dv;
        });

        // --- Processa exemplares ---
        const exemplares    = resExemplares.data || [];
        const disponiveis   = exemplares.filter(e => e.status === 'Disponível').length;

        // --- Atualiza os cards ---
        definirValor('totalLivros',          resTotalLivros.count ?? 0);
        definirValor('totalAlunos',          totalAlunos);
        definirValor('emprestimosAtivos',    ativos);
        definirValor('emprestimosAtrasados', atrasados.length);
        definirValor('exemplasDisponiveis',  `${disponiveis}/${exemplares.length}`);
        definirValor('totalDoacoes',         resDoacoes.data?.length ?? 0);
        definirValor('alunosBloqueados',     bloqueados);
        definirValor('totalGeneros',         resGeneros.count ?? 0);

        // --- Gráficos ---
        renderizarGraficoEmprestimos(emprestimos);
        await renderizarGraficoGeneros();

        // --- Tabelas ---
        renderizarTabelaAtrasados(atrasados);
        renderizarTabelaDoacoes(resDoacoes.data || []);

    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
    }
}

function definirValor(id, valor) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('loading');
    el.textContent = valor;
}

// -----------------------------------------------------------
// GRÁFICO DE BARRAS — Empréstimos por mês
// -----------------------------------------------------------
function renderizarGraficoEmprestimos(emprestimos) {
    // Monta array dos últimos 6 meses
    const meses = [];
    const contagens = [];
    const hoje = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const nomeMes = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        meses.push(nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1));

        const qtd = emprestimos.filter(e => {
            const criado = new Date(e.created_at);
            return criado.getMonth() === d.getMonth() && criado.getFullYear() === d.getFullYear();
        }).length;

        contagens.push(qtd);
    }

    const ctx = document.getElementById('chartEmprestimos').getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Empréstimos',
                data: contagens,
                backgroundColor: 'rgba(26, 115, 232, 0.15)',
                borderColor: '#1a73e8',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1d1d1f',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} empréstimo(s)`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#9ca3af', font: { size: 11 } },
                    grid: { color: '#f3f4f6' }
                },
                x: {
                    ticks: { color: '#9ca3af', font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// -----------------------------------------------------------
// GRÁFICO DE ROSCA — Livros por gênero
// -----------------------------------------------------------
async function renderizarGraficoGeneros() {
    // Busca todos os livros com seu gênero
    const { data: livros } = await supabaseClient.from('livros').select('genero');
    if (!livros || livros.length === 0) return;

    // Conta por gênero
    const contagem = {};
    livros.forEach(l => {
        const g = l.genero || 'Sem gênero';
        contagem[g] = (contagem[g] || 0) + 1;
    });

    const labels = Object.keys(contagem);
    const valores = Object.values(contagem);
    const cores = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    const ctx = document.getElementById('chartGeneros').getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: cores.map(c => c + '33'), // transparência
                borderColor: cores,
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1d1d1f',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} livro(s)`
                    }
                }
            }
        }
    });

    // Monta legenda customizada abaixo do gráfico
    const legenda = document.getElementById('legendaGeneros');
    legenda.innerHTML = labels.map((label, i) => `
        <div class="legenda-item">
            <span class="legenda-dot" style="background:${cores[i]};"></span>
            <span>${label} (${valores[i]})</span>
        </div>
    `).join('');
}

// -----------------------------------------------------------
// TABELA: Empréstimos em atraso
// -----------------------------------------------------------
function renderizarTabelaAtrasados(atrasados) {
    const tbody = document.getElementById('tabelaAtrasados');
    const hoje  = new Date(); hoje.setHours(0,0,0,0);

    if (!atrasados.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="no-data">Nenhum empréstimo em atraso 🎉</td></tr>`;
        return;
    }

    // Mostra os 5 mais atrasados
    const top5 = [...atrasados]
        .sort((a, b) => new Date(a.data_prevista) - new Date(b.data_prevista))
        .slice(0, 5);

    tbody.innerHTML = top5.map(e => {
        const dv   = new Date(e.data_prevista); dv.setHours(0,0,0,0);
        const dias = Math.floor((hoje - dv) / (1000 * 60 * 60 * 24));
        const nome  = e.alunos?.nome_aluno  || '—';
        const livro = e.exemplares?.livros?.titulo || '—';

        return `
            <tr>
                <td title="${nome}">${nome}</td>
                <td title="${livro}">${livro}</td>
                <td>${dv.toLocaleDateString('pt-BR')}</td>
                <td><span class="badge-atraso">${dias}d</span></td>
            </tr>
        `;
    }).join('');
}

// -----------------------------------------------------------
// TABELA: Últimas doações
// -----------------------------------------------------------
function renderizarTabelaDoacoes(doacoes) {
    const tbody = document.getElementById('tabelaDoacoes');

    if (!doacoes.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="no-data">Nenhuma doação registrada ainda.</td></tr>`;
        return;
    }

    tbody.innerHTML = doacoes.map(d => `
        <tr>
            <td title="${d.nome_doador}">${d.nome_doador}</td>
            <td title="${d.titulo}">${d.titulo}</td>
            <td><span class="badge-genero-sm">${d.genero || '—'}</span></td>
            <td>${new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
        </tr>
    `).join('');
}

// -----------------------------------------------------------
// SIDEBAR
// -----------------------------------------------------------
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    const icon = document.getElementById('menu-icon');
    icon.className = sidebar.classList.contains('collapsed') ? 'bi bi-caret-right' : 'bi bi-caret-left';
}
