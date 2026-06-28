const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sygtwdcdjtbslcavelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z3R3ZGNkanRic2xjYXZlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQxNTgsImV4cCI6MjA5MDY1MDE1OH0.TlvsoZkzLjKimaqvqMrekWLlWL7dvOfLtimJOTr8htU';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const REGRAS_NOTIFICACAO = [
    { tipo: 'lembrete_3d',  diasAntes:  3, mensagem: 'lembrete' },
    { tipo: 'lembrete_hoje', diasAntes:  0, mensagem: 'lembrete_urgente' },
    { tipo: 'atraso_7d',    diasApos:   7, mensagem: 'atraso' },
    { tipo: 'atraso_14d',   diasApos:  14, mensagem: 'atraso' },
    { tipo: 'atraso_21d',   diasApos:  21, mensagem: 'atraso' },
    { tipo: 'atraso_28d',   diasApos:  28, mensagem: 'atraso' },
];

let filaPendente = [];

function formatarNumero(numero) {
    const digitos = String(numero).replace(/\D/g, '');
    if (digitos.length === 11 || digitos.length === 10) return `55${digitos}`;
    if (digitos.length === 13 || digitos.length === 12) return digitos;
    return null;
}

function formatarData(dateStr) {
    if (!dateStr) return '';
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

function diffDias(dataStr) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const data = new Date(dataStr + 'T00:00:00');
    return Math.floor((hoje - data) / (1000 * 60 * 60 * 24));
}

function montarMensagem(tipo, nomeAluno, tituloLivro, dataPrevista) {
    const dataFmt = formatarData(dataPrevista);

    if (tipo === 'lembrete_3d') {
        return (
            `Olá, *${nomeAluno}*! ⏰\n\n` +
            `Lembrete da *Biblioteca Jorge Amado*:\n\n` +
            `O livro *"${tituloLivro}"* deve ser devolvido em *3 dias* (${dataFmt}).\n\n` +
            `Não esqueça! 📚`
        );
    }
    if (tipo === 'lembrete_hoje') {
        return (
            `Olá, *${nomeAluno}*! 🔔\n\n` +
            `Atenção! Hoje é o *último dia* para devolver o livro *"${tituloLivro}"* na *Biblioteca Jorge Amado*.\n\n` +
            `📅 Prazo: *${dataFmt}*\n\n` +
            `Contamos com você! 📚`
        );
    }

    const diasAtraso = diffDias(dataPrevista);
    return (
        `Olá, *${nomeAluno}*! ⚠️\n\n` +
        `Aviso da *Biblioteca Jorge Amado*:\n\n` +
        `O livro *"${tituloLivro}"* está em atraso há *${diasAtraso} dia(s)*.\n\n` +
        `Por favor, devolva o quanto antes para evitar bloqueio do seu cadastro.`
    );
}

async function jaEnviou(emprestimoId, tipo) {
    const { data } = await supabase
        .from('notificacoes_enviadas')
        .select('id')
        .eq('emprestimo_id', emprestimoId)
        .eq('tipo', tipo)
        .limit(1);
    return data && data.length > 0;
}

async function registrarEnvio(emprestimoId, tipo, status) {
    await supabase.from('notificacoes_enviadas').insert([{
        emprestimo_id: emprestimoId,
        tipo,
        status
    }]);
}

async function enviarNotificacao(client, emp, tipo, salvarHistorico) {
    const nome    = emp.alunos?.nome_aluno || 'Aluno';
    const telefone = emp.alunos?.telefone;
    const titulo  = emp.exemplares?.livros?.titulo || 'livro';

    if (!telefone) return;

    const numero = formatarNumero(telefone);
    if (!numero) return;

    const texto = montarMensagem(tipo, nome, titulo, emp.data_prevista);

    try {
        await client.sendMessage(`${numero}@c.us`, texto);
        await registrarEnvio(emp.id, tipo, 'enviado');
        salvarHistorico({
            nomeAluno: nome, numero, tipo,
            status: 'enviado', data: new Date().toISOString()
        });
        console.log(`  ✅ ${tipo} → ${nome} (${numero})`);
    } catch (err) {
        console.error(`  ❌ ${tipo} → ${nome}: ${err.message}`);
        await registrarEnvio(emp.id, tipo, 'erro');
    }
}

async function processarNotificacoes(client, estado, salvarHistorico) {
    if (estado !== 'conectado') {
        console.log('⏸️  WhatsApp desconectado — notificações adiadas.');
        return;
    }

    console.log('\n📋 Verificando notificações automáticas...');

    const { data: emprestimos, error } = await supabase
        .from('emprestimos')
        .select('id, data_prevista, alunos(nome_aluno, telefone), exemplares(livros(titulo))')
        .eq('status', 'Ativo');

    if (error) {
        console.error('Erro ao buscar empréstimos:', error.message);
        return;
    }

    if (!emprestimos || emprestimos.length === 0) {
        console.log('  Nenhum empréstimo ativo.');
        return;
    }

    let enviados = 0;

    for (const emp of emprestimos) {
        const diasPassados = diffDias(emp.data_prevista);

        for (const regra of REGRAS_NOTIFICACAO) {
            let deveEnviar = false;

            if (regra.diasAntes !== undefined) {
                deveEnviar = diasPassados === -regra.diasAntes;
            } else if (regra.diasApos !== undefined) {
                deveEnviar = diasPassados === regra.diasApos;
            }

            if (!deveEnviar) continue;

            const jaFoi = await jaEnviou(emp.id, regra.tipo);
            if (jaFoi) continue;

            await enviarNotificacao(client, emp, regra.tipo, salvarHistorico);
            enviados++;

            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log(`📊 ${enviados} notificação(ões) enviada(s).\n`);
}

async function processarFilaPendente(client, estado, salvarHistorico) {
    if (estado !== 'conectado' || filaPendente.length === 0) return;

    console.log(`🔄 Processando ${filaPendente.length} notificação(ões) pendente(s)...`);
    const fila = [...filaPendente];
    filaPendente = [];

    for (const item of fila) {
        await enviarNotificacao(client, item.emp, item.tipo, salvarHistorico);
        await new Promise(r => setTimeout(r, 2000));
    }
}

function iniciar(client, getEstado, salvarHistorico) {
    // Todo dia às 8h
    cron.schedule('0 8 * * *', async () => {
        console.log(`\n⏰ [${new Date().toLocaleString('pt-BR')}] Cron de notificações disparado.`);
        await processarNotificacoes(client, getEstado(), salvarHistorico);
    });

    // Verificação extra às 14h para pegar lembretes do mesmo dia
    cron.schedule('0 14 * * *', async () => {
        console.log(`\n⏰ [${new Date().toLocaleString('pt-BR')}] Verificação extra de notificações.`);
        await processarNotificacoes(client, getEstado(), salvarHistorico);
    });

    console.log('📅 Cron de notificações automáticas ativado (8h e 14h).');
}

function aoReconectar(client, getEstado, salvarHistorico) {
    processarFilaPendente(client, getEstado(), salvarHistorico);
}

async function verificarPrimeiroEmprestimo(alunoRa) {
    const { data, error } = await supabase
        .from('emprestimos')
        .select('id')
        .eq('aluno_ra', alunoRa)
        .limit(2);

    if (error) return false;
    return !data || data.length <= 1;
}

module.exports = {
    iniciar,
    aoReconectar,
    processarNotificacoes,
    verificarPrimeiroEmprestimo,
    supabase
};
