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
    carregarUsuario();
});

// -----------------------------------------------------------
// GERAR RELATÓRIO PDF
// -----------------------------------------------------------
async function gerarRelatorio() {
    const btn     = document.getElementById('btnGerarRelatorio');
    const textoEl = btn.querySelector('.btn-texto');
    textoEl.textContent = 'Gerando…';
    btn.disabled = true;

    try {
        /* ── 1. Buscar todos os dados em paralelo ── */
        const hojeInicio = new Date(); hojeInicio.setHours(0,0,0,0);
        const semanaInicio = new Date(hojeInicio);
        semanaInicio.setDate(hojeInicio.getDate() - 6);

        const [rLivrosDetalhados, rAlunos, rEmp, rExemp, rDoacoes, rGeneros] = await Promise.all([
            supabaseClient.from('livros')
                .select('isbn, titulo, autor, genero, created_at, exemplares(id)')
                .order('created_at', { ascending: false }),
            supabaseClient.from('alunos').select('status'),
            supabaseClient.from('emprestimos')
                .select('id,status,data_prevista,created_at,alunos(nome_aluno,ra,serie,turma),exemplares(livros(titulo,isbn))')
                .order('created_at', { ascending: false }),
            supabaseClient.from('exemplares').select('status'),
            supabaseClient.from('doacoes')
                .select('nome_doador,titulo,genero,created_at')
                .order('created_at', { ascending: false }),
            supabaseClient.from('generos').select('nome', { count: 'exact', head: true })
        ]);

        const livrosDetalhados = rLivrosDetalhados.data || [];
        const emps     = rEmp.data     || [];
        const alunos   = rAlunos.data  || [];
        const exemps   = rExemp.data   || [];
        const doacoes  = rDoacoes.data || [];

        /* Mapa isbn → total de exemplares */
        const livrosMap = {};
        livrosDetalhados.forEach(l => { livrosMap[l.isbn] = l.exemplares?.length || 0; });

        /* Livros e doações do dia */
        const livrosHoje = livrosDetalhados.filter(l => {
            const d = new Date(l.created_at); d.setHours(0,0,0,0);
            return d.getTime() === hojeInicio.getTime();
        });
        const doacoesHoje = doacoes.filter(d => {
            const dt = new Date(d.created_at); dt.setHours(0,0,0,0);
            return dt.getTime() === hojeInicio.getTime();
        });

        /* ── 2. Calcular KPIs ── */
        const bloqueados  = alunos.filter(a => a.status === 'Bloqueado').length;
        const disponiveis = exemps.filter(e => e.status === 'Disponível').length;
        const ativos      = emps.filter(e => e.status === 'Ativo').length;
        const atrasados   = emps.filter(e => {
            if (e.status === 'Devolvido') return false;
            const dv = new Date(e.data_prevista); dv.setHours(0,0,0,0);
            return hojeInicio > dv;
        });
        const empHoje   = emps.filter(e => {
            const d = new Date(e.created_at); d.setHours(0,0,0,0);
            return d.getTime() === hojeInicio.getTime();
        });
        const empSemana = emps.filter(e => new Date(e.created_at) >= semanaInicio);

        /* ── 3. Configurar documento PDF ── */
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const PW = doc.internal.pageSize.getWidth();
        const PH = doc.internal.pageSize.getHeight();
        const ML = 14, MR = PW - 14;
        const AZUL     = [26, 115, 232];
        const VERDE    = [12, 166, 120];
        const VERMELHO = [229, 62, 62];
        const ROSA     = [208, 18, 100];
        const ROXO     = [124, 58, 237];
        const ESCURO   = [29, 29, 31];
        const CINZA    = [95, 99, 104];
        const agora    = new Date();
        let y = 0;

        /* ── 4. Cabeçalho ── */
        doc.setFillColor(...AZUL);
        doc.rect(0, 0, PW, 30, 'F');

        // Círculo branco com sigla
        doc.setFillColor(255, 255, 255);
        doc.circle(ML + 8, 15, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...AZUL);
        doc.text('BJA', ML + 5.5, 17.5);

        // Título
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text('Biblioteca Jorge Amado', ML + 21, 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(180, 210, 255);
        doc.text('Relatório Gerencial', ML + 21, 21);

        // Data/hora à direita
        const dataStr = agora.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
        const horaStr = agora.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        doc.setFontSize(8);
        doc.setTextColor(210, 230, 255);
        doc.text(`Gerado em ${horaStr}`, MR, 12, { align: 'right' });
        doc.setTextColor(180, 210, 255);
        doc.text(dataStr, MR, 21, { align: 'right' });

        y = 38;

        /* ── Funções auxiliares (closures sobre y, doc, etc.) ── */
        function secao(titulo, cor) {
            if (y > PH - 50) { doc.addPage(); y = 14; }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(...ESCURO);
            doc.text(titulo, ML, y);
            doc.setDrawColor(...(cor || AZUL));
            doc.setLineWidth(0.6);
            doc.line(ML, y + 1.8, ML + doc.getTextWidth(titulo), y + 1.8);
            y += 7;
        }

        function semDados(msg) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(...CINZA);
            doc.text(msg, ML, y + 2);
            y += 11;
        }

        function tabela(cabecalhos, linhas, corCabecalho, corAlternada) {
            doc.autoTable({
                startY: y,
                head: [cabecalhos],
                body: linhas,
                theme: 'plain',
                headStyles: {
                    fillColor: corCabecalho || AZUL,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8,
                    cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
                    textColor: ESCURO
                },
                alternateRowStyles: { fillColor: corAlternada || [248, 249, 252] },
                margin: { left: ML, right: 14 },
                tableLineColor: [224, 228, 233],
                tableLineWidth: 0.2,
                styles: { overflow: 'ellipsize' }
            });
            y = doc.lastAutoTable.finalY + 9;
        }

        function statusEmprestimo(e) {
            if (e.status === 'Devolvido') return 'Devolvido';
            return new Date(e.data_prevista) < new Date() ? 'Atrasado' : 'Em dia';
        }

        /* ── 5. Cards de resumo ── */
        secao('RESUMO GERAL');

        const kpis = [
            { label: 'Livros cadastrados',    val: livrosDetalhados.length,   cor: AZUL },
            { label: 'Alunos ativos',         val: alunos.length - bloqueados, cor: ROXO },
            { label: 'Empréstimos ativos',    val: ativos,                    cor: VERDE },
            { label: 'Em atraso',             val: atrasados.length,          cor: VERMELHO },
            { label: 'Exemplares disponíveis',val: `${disponiveis}/${exemps.length}`, cor: [2,132,199] },
            { label: 'Doações registradas',   val: doacoes.length,            cor: ROSA },
            { label: 'Alunos bloqueados',     val: bloqueados,                cor: [217,119,6] },
            { label: 'Gêneros literários',    val: rGeneros.count ?? 0,       cor: [101,163,13] },
        ];

        const cW = (PW - 28 - 9) / 4;
        const cH = 18;

        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 4; col++) {
                const k  = kpis[row * 4 + col];
                const cx = ML + col * (cW + 3);
                const cy = y + row * (cH + 3);

                doc.setFillColor(240, 242, 245);
                doc.roundedRect(cx, cy, cW, cH, 2, 2, 'F');
                doc.setFillColor(...k.cor);
                doc.roundedRect(cx, cy, 2.5, cH, 1, 1, 'F');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(...k.cor);
                doc.text(String(k.val), cx + 7, cy + 9);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(...CINZA);
                doc.text(doc.splitTextToSize(k.label, cW - 8), cx + 7, cy + 14);
            }
        }
        y += 2 * (cH + 3) + 10;

        /* ── 6. Livros cadastrados hoje ── */
        const VERDE_FOLHA = [101, 163, 13];
        secao(`LIVROS CADASTRADOS HOJE  (${livrosHoje.length})`, VERDE_FOLHA);
        if (livrosHoje.length === 0) {
            semDados('Nenhum livro cadastrado hoje.');
        } else {
            tabela(
                ['Título', 'Autor', 'Gênero', 'Exemplares'],
                livrosHoje.map(l => [
                    l.titulo || '—',
                    l.autor  || '—',
                    l.genero || '—',
                    String(l.exemplares?.length || 0)
                ]),
                VERDE_FOLHA, [245, 252, 237]
            );
        }

        /* ── 6b. Doações do dia ── */
        secao(`DOAÇÕES DO DIA  (${doacoesHoje.length})`, ROSA);
        if (doacoesHoje.length === 0) {
            semDados('Nenhuma doação registrada hoje.');
        } else {
            tabela(
                ['Doador', 'Título do Livro', 'Gênero'],
                doacoesHoje.map(d => [
                    d.nome_doador || '—',
                    d.titulo      || '—',
                    d.genero      || '—'
                ]),
                ROSA, [255, 245, 250]
            );
        }

        /* ── 7. Empréstimos de hoje ── */
        secao(`EMPRÉSTIMOS DE HOJE  (${empHoje.length})`, AZUL);
        if (empHoje.length === 0) {
            semDados('Nenhum empréstimo registrado hoje.');
        } else {
            tabela(
                ['Aluno', 'RA', 'Série', 'Turma', 'Livro', 'Exemplares', 'Status'],
                empHoje.map(e => [
                    e.alunos?.nome_aluno || '—',
                    e.alunos?.ra         || '—',
                    e.alunos?.serie      || '—',
                    e.alunos?.turma      || '—',
                    e.exemplares?.livros?.titulo || '—',
                    String(livrosMap[e.exemplares?.livros?.isbn] ?? '—'),
                    statusEmprestimo(e)
                ]),
                AZUL, [248, 249, 252]
            );
        }

        /* ── 7. Empréstimos da semana ── */
        secao(`EMPRÉSTIMOS DOS ÚLTIMOS 7 DIAS  (${empSemana.length})`, VERDE);
        if (empSemana.length === 0) {
            semDados('Nenhum empréstimo nos últimos 7 dias.');
        } else {
            doc.autoTable({
                startY: y,
                head: [['Livro', 'Aluno', 'RA', 'Série / Turma', 'Empréstimo', 'Devolução', 'Status']],
                body: empSemana.slice(0, 30).map(e => [
                    e.exemplares?.livros?.titulo || '—',
                    e.alunos?.nome_aluno         || '—',
                    e.alunos?.ra                 || '—',
                    [e.alunos?.serie, e.alunos?.turma].filter(Boolean).join(' — ') || '—',
                    new Date(e.created_at).toLocaleDateString('pt-BR'),
                    new Date(e.data_prevista).toLocaleDateString('pt-BR'),
                    statusEmprestimo(e)
                ]),
                theme: 'plain',
                headStyles: {
                    fillColor: VERDE,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8,
                    cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
                    textColor: ESCURO
                },
                alternateRowStyles: { fillColor: [245, 252, 249] },
                margin: { left: ML, right: 14 },
                tableLineColor: [224, 228, 233],
                tableLineWidth: 0.2,
                columnStyles: {
                    0: { cellWidth: 46 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 16 },
                    3: { cellWidth: 22 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 20 },
                    6: { cellWidth: 18 }
                },
                styles: { overflow: 'linebreak' }
            });
            y = doc.lastAutoTable.finalY + 9;
        }

        /* ── 8. Em atraso ── */
        if (atrasados.length > 0) {
            secao(`EMPRÉSTIMOS EM ATRASO  (${atrasados.length})`, VERMELHO);
            const ref = new Date(); ref.setHours(0,0,0,0);
            tabela(
                ['Aluno', 'RA', 'Série', 'Turma', 'Livro', 'Exemplares', 'Data Prevista', 'Dias em Atraso'],
                [...atrasados]
                    .sort((a, b) => new Date(a.data_prevista) - new Date(b.data_prevista))
                    .slice(0, 25)
                    .map(e => {
                        const dv = new Date(e.data_prevista); dv.setHours(0,0,0,0);
                        const dias = Math.floor((ref - dv) / 86400000);
                        return [
                            e.alunos?.nome_aluno || '—',
                            e.alunos?.ra         || '—',
                            e.alunos?.serie      || '—',
                            e.alunos?.turma      || '—',
                            e.exemplares?.livros?.titulo || '—',
                            String(livrosMap[e.exemplares?.livros?.isbn] ?? '—'),
                            dv.toLocaleDateString('pt-BR'),
                            `${dias} dia(s)`
                        ];
                    }),
                VERMELHO, [255, 245, 245]
            );
        }

        /* ── 9. Doações ── */
        if (doacoes.length > 0) {
            secao(`ÚLTIMAS DOAÇÕES  (${doacoes.length})`, ROSA);
            tabela(
                ['Doador', 'Título do Livro', 'Gênero', 'Data'],
                doacoes.map(d => [
                    d.nome_doador || '—',
                    d.titulo || '—',
                    d.genero || '—',
                    new Date(d.created_at).toLocaleDateString('pt-BR')
                ]),
                ROSA, [255, 245, 250]
            );
        }

        /* ── 10. Rodapé em todas as páginas ── */
        const totalPag = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPag; p++) {
            doc.setPage(p);
            const fy = PH - 8;
            doc.setDrawColor(220, 224, 232);
            doc.setLineWidth(0.25);
            doc.line(ML, fy - 2, MR, fy - 2);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(180, 185, 195);
            doc.text('Biblioteca Jorge Amado — Sistema de Gestão Bibliotecária', ML, fy + 1);
            doc.text(`Página ${p} de ${totalPag}`, MR, fy + 1, { align: 'right' });
        }

        /* ── 11. Download ── */
        const nomePDF = `relatorio-${agora.toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
        doc.save(nomePDF);

    } catch (err) {
        console.error('Erro ao gerar relatório:', err);
        alert('Erro ao gerar o relatório. Verifique o console (F12).');
    } finally {
        textoEl.textContent = 'Gerar Relatório PDF';
        btn.disabled = false;
    }
}

/* ================================================================
   USUÁRIO LOGADO — sidebar e modal de saída
   ================================================================ */
function carregarUsuario() {
    document.querySelectorAll('nav a').forEach(link => {
        const texto = link.querySelector('.nav-text');
        if (texto) link.setAttribute('data-tip', texto.textContent.trim());
    });
    const admin = JSON.parse(sessionStorage.getItem('admin') || 'null');
    if (!admin) return;
    const primeiroNome = admin.nome ? admin.nome.split(' ')[0] : '—';
    const elNome   = document.getElementById('sidebarNome');
    const elCargo  = document.getElementById('sidebarCargo');
    const elMNome  = document.getElementById('modalNome');
    const elMCargo = document.getElementById('modalCargo');
    if (elNome)   elNome.textContent   = primeiroNome;
    if (elCargo)  elCargo.textContent  = admin.cargo  || '';
    if (elMNome)  elMNome.textContent  = admin.nome   || '—';
    if (elMCargo) elMCargo.textContent = admin.cargo  || '—';
}

function abrirModalSair() {
    document.getElementById('modalSair').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}

function fecharModalSair(event) {
    if (event && event.target !== document.getElementById('modalSair')) return;
    document.getElementById('modalSair').classList.remove('ativo');
    document.body.style.overflow = '';
}

function confirmarSaida() {
    sessionStorage.removeItem('admin');
    window.location.href = '/Fronted sistema/login/login.html';
}

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
    document.querySelector('.sidebar').classList.toggle('collapsed');
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}
