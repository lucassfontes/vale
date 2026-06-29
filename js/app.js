/**
 * ARQUIVO PRINCIPAL DO SISTEMA DE EMPRÉSTIMOS
 * ------------------------------------------------
 * Este arquivo controla todo o funcionamento do sistema:
 * - banco de dados local usando localStorage;
 * - cadastro, edição e exclusão de clientes;
 * - cadastro, edição, impressão e envio de VALLES;
 * - cálculo do dashboard financeiro;
 * - geração de PDF;
 * - backup/restauração;
 * - modo escuro e navegação entre abas.
 *
 * ATENÇÃO: o sistema funciona 100% no navegador.
 * Os dados ficam salvos no localStorage do aparelho/navegador.
 */

// Chave principal onde todo o banco do sistema é salvo no localStorage.
const LS = 'emprestimos_pro_v2';

// Configurações financeiras salvas também em chaves separadas no localStorage,
// para você poder alterar direto pelo console se quiser.
const LS_CAPITAL_INVESTIDO = 'capitalInvestido';
const LS_PERCENTUAL_JUROS_50 = 'percentualJuros50';

// Objeto principal em memória. Tudo que aparece na tela vem daqui.
let db = load();
// Quando está editando um vale, guarda aqui o ID dele. Se for null, é vale novo.
let editLoanId = null;
// Atalho para buscar elementos HTML pelo ID. Exemplo: $('loanValor').
const $ = (id) => document.getElementById(id);

/**
 * Cria a estrutura padrão do banco local quando o sistema é aberto pela primeira vez ou quando os dados são apagados.
 */
function seed() {
  return { settings: { theme: 'light', seq: 1, capitalInvestido: 0, percentualJuros50: 50 }, clientes: [], vales: [] };
}

/**
 * Carrega os dados salvos no localStorage e normaliza a estrutura para evitar erros com versões antigas.
 */
function load() {
  try {
    return normalizeDb(JSON.parse(localStorage.getItem(LS)) || seed());
  } catch (e) {
    return seed();
  }
}

/**
 * Corrige, completa e migra os dados do sistema. Garante que clientes, vales e configurações tenham sempre o formato esperado.
 */
function normalizeDb(obj) {
  const base = seed();
  obj = obj && typeof obj === 'object' ? obj : base;
  obj.settings = { ...base.settings, ...(obj.settings || {}) };
  obj.settings.seq = Number(obj.settings.seq || 1);

  // Migração: se existir a configuração antiga, mantém o valor.
  if (obj.settings.percentualJuros50 === undefined && obj.settings.percentualJuros !== undefined) {
    obj.settings.percentualJuros50 = obj.settings.percentualJuros;
  }

  // Prioridade:
  // 1) valores separados do localStorage, se existirem;
  // 2) valores dentro do backup/db.settings;
  // 3) padrão do sistema.
  const capitalLS = localStorage.getItem(LS_CAPITAL_INVESTIDO);
  const juros50LS = localStorage.getItem(LS_PERCENTUAL_JUROS_50);

  obj.settings.capitalInvestido = capitalLS !== null
    ? Number(capitalLS || 0)
    : Number(obj.settings.capitalInvestido || 0);

  obj.settings.percentualJuros50 = juros50LS !== null
    ? Number(juros50LS || 50)
    : Number(obj.settings.percentualJuros50 || 50);

  // Evita valor inválido.
  if (Number.isNaN(obj.settings.capitalInvestido)) obj.settings.capitalInvestido = 0;
  if (Number.isNaN(obj.settings.percentualJuros50)) obj.settings.percentualJuros50 = 50;

  // Mantém compatibilidade com versões antigas do backup.
  delete obj.settings.percentualJuros;
  obj.clientes = Array.isArray(obj.clientes) ? obj.clientes : [];
  obj.vales = Array.isArray(obj.vales) ? obj.vales : [];

  obj.clientes = obj.clientes.map((c) => {
    if (typeof c === 'string') c = { nome: c };
    return {
      id: c.id || ('C' + Date.now() + Math.random().toString(16).slice(2)),
      nome: upper(c.nome || c.name || ''),
      telefone: phoneMask(c.telefone || c.phone || ''),
      cpf: cpfMask(c.cpf || ''),
      obs: upper(c.obs || c.observacao || '')
    };
  }).filter(c => c.nome);

  obj.vales = obj.vales.map((v) => ({
    id: v.id || ('V' + Date.now() + Math.random().toString(16).slice(2)),
    numero: Number(v.numero || 0),
    clienteId: v.clienteId || '',
    cliente: upper(v.cliente || ''),
    telefone: phoneMask(v.telefone || ''),
    cpf: cpfMask(v.cpf || ''),
    valor: Number(v.valor || 0),
    juros: Number(v.juros || 0),
    total: Number(v.total || 0),
    dataInicial: v.dataInicial || '',
    dataFinal: v.dataFinal || '',
    observacao: upper(v.observacao || ''),
    status: v.status === 'PAGO' ? 'PAGO' : 'ABERTO',
    criadoEm: v.criadoEm || new Date().toISOString(),
    editadoEm: v.editadoEm || ''
  })).filter(v => v.cliente);

  const maiorNumero = obj.vales.reduce((m, v) => Math.max(m, Number(v.numero || 0)), 0);
  obj.vales.forEach(v => {
    if (!v.numero) v.numero = ++obj.settings.seq;
  });
  obj.settings.seq = Math.max(Number(obj.settings.seq || 1), maiorNumero + 1);
  return obj;
}

/**
 * Salva o banco principal no localStorage e também salva capital investido e percentual de juros em chaves separadas.
 */
function save() {
  db = normalizeDb(db);
  localStorage.setItem(LS, JSON.stringify(db));
  localStorage.setItem(LS_CAPITAL_INVESTIDO, String(Number(db.settings.capitalInvestido || 0)));
  localStorage.setItem(LS_PERCENTUAL_JUROS_50, String(Number(db.settings.percentualJuros50 || 50)));
}

/**
 * Escapa textos antes de inserir no HTML, evitando quebra de layout e problemas com caracteres especiais.
 */
function h(s) {
  return String(s ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

/**
 * Mostra uma mensagem rápida na parte inferior da tela para avisar o usuário sobre ações e erros.
 */
function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.style.display = 'none', 2300);
}

/**
 * Converte texto para maiúsculas e remove espaços extras no começo/fim.
 */
function upper(s) { return String(s || '').toUpperCase().trim(); }
/**
 * Remove tudo que não for número. Usado em telefone, CPF e valores monetários.
 */
function onlyNum(s) { return String(s || '').replace(/\D/g, ''); }
/**
 * Converte um texto formatado como moeda em número. Exemplo: R$ 1.500,00 vira 1500.
 */
/**
 * Formata um número para moeda brasileira. Exemplo: 1500 vira R$ 1.500,00.
 */
function moneyNum(s) { return Number(onlyNum(s)) / 100; }
function money(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
/**
 * Converte uma data no formato do input HTML (AAAA-MM-DD) para o formato brasileiro (DD/MM/AAAA).
 */
function brDate(s) { if (!s) return '--/--/----'; const p = String(s).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '--/--/----'; }
/**
 * Converte um objeto Date do JavaScript para o formato usado em input type=date (AAAA-MM-DD).
 */
function inputDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
/**
 * Calcula a diferença em dias entre duas datas.
 */
function days(a, b) { if (!a || !b) return 0; return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
/**
 * Converte taxa de juros digitada com % ou vírgula para número. Exemplo: 30% vira 30.
 */
function taxaNum(s) { return parseFloat(String(s || '').replace('%', '').replace(',', '.')) || 0; }
/**
 * Aplica máscara de telefone brasileiro. Exemplo: 94991182247 vira (94) 99118-2247.
 */
function phoneMask(v) { const n = onlyNum(v).slice(0, 11); if (n.length <= 2) return n; if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`; if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`; return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`; }
/**
 * Aplica máscara de CPF. Exemplo: 12345678900 vira 123.456.789-00.
 */
function cpfMask(v) { const n = onlyNum(v).slice(0, 11); return n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
/**
 * Aplica máscara de CEP. Mantido como utilitário caso você queira usar CEP no futuro.
 */
function cepMask(v) { const n = onlyNum(v).slice(0, 8); return n.replace(/(\d{5})(\d)/, '$1-$2'); }
/**
 * Prepara o número de telefone para abrir no WhatsApp. Adiciona o código 55 quando necessário.
 */
function whatsNumber(t) { let n = onlyNum(t); if (n.length === 10 || n.length === 11) n = '55' + n; return n; }
/**
 * Busca um cliente pelo nome em maiúsculas.
 */
function clienteByName(name) { return db.clientes.find(c => c.nome === upper(name)); }
/**
 * Busca um cliente pelo ID interno.
 */
function clienteById(id) { return db.clientes.find(c => c.id === id); }
/**
 * Retorna a situação visual de um vale: pago, atrasado ou aberto.
 */
function loanStatus(v) { if (v.status === 'PAGO') return 'pago'; const today = inputDate(new Date()); return v.dataFinal && v.dataFinal < today ? 'atrasado' : 'aberto'; }

/**
 * Aplica o modo claro ou escuro na tela conforme a configuração salva.
 */
function applyTheme() {
  document.body.classList.toggle('dark', db.settings.theme === 'dark');
  if ($('themeBtn')) $('themeBtn').textContent = db.settings.theme === 'dark' ? '☀️ MODO CLARO' : '🌙 MODO ESCURO';
}

/**
 * Troca a aba/tela visível do sistema e atualiza todos os dados renderizados.
 */
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if ($(id)) $(id).classList.add('active');

  // Atualiza o botão ativo do menu e, no celular, centraliza o botão selecionado na barra horizontal.
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.screen === id));
  const activeTab = document.querySelector(`.tab[data-screen="${id}"]`);
  if (activeTab && window.innerWidth <= 780) {
    activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  renderAll();
}

/**
 * Limpa o formulário de novo empréstimo e coloca as datas padrão: hoje e +30 dias.
 */
function clearLoan() {
  editLoanId = null;
  $('loanCliente').value = '';
  $('loanValor').value = '';
  $('loanJuros').value = '30%';
  $('loanTotal').value = '';
  $('loanObs').value = '';
  const hoje = new Date();
  $('loanInicio').value = inputDate(hoje);
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + 30);
  $('loanFinal').value = inputDate(fim);
  calcLoan();
}

/**
 * Calcula o total com juros e atualiza o badge de dias entre data inicial e final.
 */
function calcLoan() {
  const valor = moneyNum($('loanValor').value);
  const juros = taxaNum($('loanJuros').value);
  const total = Math.max(0, valor + (valor * juros / 100));
  $('loanTotal').value = money(total);
  $('diasBadge').textContent = days($('loanInicio').value, $('loanFinal').value) || 0;
}

/**
 * Lê os campos do formulário de empréstimo e monta um objeto vale pronto para salvar.
 */
function currentLoan() {
  const nome = upper($('loanCliente').value);
  const c = clienteByName(nome);
  const old = editLoanId ? db.vales.find(v => v.id === editLoanId) : null;
  return {
    id: editLoanId || ('V' + Date.now()),
    numero: old ? old.numero : null,
    clienteId: c?.id || '',
    cliente: nome,
    telefone: c?.telefone || '',
    cpf: c?.cpf || '',
    valor: moneyNum($('loanValor').value),
    juros: taxaNum($('loanJuros').value),
    total: moneyNum($('loanTotal').value),
    dataInicial: $('loanInicio').value,
    dataFinal: $('loanFinal').value,
    observacao: upper($('loanObs').value),
    status: old?.status || 'ABERTO',
    criadoEm: old?.criadoEm || new Date().toISOString()
  };
}

/**
 * Valida se o vale possui cliente, valor e datas corretas antes de salvar.
 */
function validateLoan(v) {
  if (!v.cliente) return 'INFORME O CLIENTE';
  if (v.valor <= 0) return 'INFORME O VALOR';
  if (!v.dataInicial || !v.dataFinal) return 'INFORME AS DATAS';
  if (days(v.dataInicial, v.dataFinal) < 0) return 'DATA FINAL MENOR QUE A INICIAL';
  return '';
}

/**
 * Garante que o cliente informado no empréstimo exista no cadastro. Se não existir, cria automaticamente.
 */
function ensureClientByLoan(v) {
  let c = clienteByName(v.cliente);
  if (!c) {
    c = { id: 'C' + Date.now(), nome: v.cliente, telefone: '', cpf: '', obs: '' };
    db.clientes.push(c);
  }
  v.clienteId = c.id;
  return c;
}

/**
 * Salva um vale novo ou atualiza um vale em edição. Também atualiza cliente, histórico e localStorage.
 */
function saveLoan() {
  const v = currentLoan();
  const err = validateLoan(v);
  if (err) { toast(err); return null; }
  const c = ensureClientByLoan(v);
  v.telefone = c.telefone;
  v.cpf = c.cpf;

  if (editLoanId) {
    const i = db.vales.findIndex(x => x.id === editLoanId);
    if (i < 0) { toast('VALE NÃO ENCONTRADO'); return null; }
    db.vales[i] = { ...db.vales[i], ...v, editadoEm: new Date().toISOString() };
    toast('VALE ALTERADO');
  } else {
    v.numero = db.settings.seq++;
    db.vales.unshift(v);
    toast('VALLE SALVO');
  }
  editLoanId = null;
  save();
  renderAll();
  return v;
}

/**
 * Salva o vale e abre a impressão.
 */
function savePrint() { const v = saveLoan(); if (v) { printLoan(v); clearLoan(); } }
/**
 * Salva o vale e inicia o compartilhamento do PDF pelo celular/navegador.
 */
async function saveSendPdf() { const v = saveLoan(); if (v) { await sharePdf(v); clearLoan(); } }
/**
 * Salva o vale sem imprimir e leva o usuário para o histórico.
 */
function saveOnly() { const v = saveLoan(); if (v) { clearLoan(); switchScreen('historico'); } }

/**
 * Limpa o formulário de cadastro/edição de cliente.
 */
function clearClient() {
  ['clienteId', 'cliNome', 'cliTelefone', 'cliCpf', 'cliObs'].forEach(id => $(id).value = '');
}


/**
 * Lê um arquivo selecionado e transforma em Base64. Mantido para futuras fotos/anexos.
 */
function readFileData(file) {
  return new Promise((res, rej) => {
    if (!file) return res('');
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/**
 * Salva um cliente novo ou edita um cliente existente. Também atualiza os vales ligados a esse cliente.
 */
function saveClient() {
  const id = $('clienteId').value || ('C' + Date.now());
  const c = {
    id,
    nome: upper($('cliNome').value),
    telefone: phoneMask($('cliTelefone').value),
    cpf: cpfMask($('cliCpf').value),
    obs: upper($('cliObs').value)
  };
  if (!c.nome) { toast('DIGITE O NOME'); return; }
  const duplicated = db.clientes.find(x => x.nome === c.nome && x.id !== id);
  if (duplicated) { toast('JÁ EXISTE CLIENTE COM ESSE NOME'); return; }
  const idx = db.clientes.findIndex(x => x.id === id);
  if (idx >= 0) {
    const oldName = db.clientes[idx].nome;
    db.clientes[idx] = c;
    db.vales.forEach(v => {
      if (v.clienteId === id || v.cliente === oldName) {
        v.clienteId = id; v.cliente = c.nome; v.telefone = c.telefone; v.cpf = c.cpf;
      }
    });
    toast('CLIENTE ALTERADO');
  } else {
    db.clientes.push(c);
    toast('CLIENTE SALVO');
  }
  save();
  clearClient();
  renderAll();
}


/**
 * Carrega os dados de um cliente no formulário para edição.
 */
function editClient(id) {
  const c = clienteById(id);
  if (!c) return;
  $('clienteId').value = c.id;
  $('cliNome').value = c.nome;
  $('cliTelefone').value = c.telefone || '';
  $('cliCpf').value = c.cpf || '';
  $('cliObs').value = c.obs || '';
  switchScreen('clientes');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


/**
 * Usa um cliente cadastrado no formulário de novo empréstimo.
 */
function useClient(id) {
  const c = clienteById(id);
  if (c) $('loanCliente').value = c.nome;
  switchScreen('emprestimo');
}

/**
 * Remove o cliente do cadastro, mantendo os vales antigos no histórico.
 */
function deleteClient(id) {
  if (!confirm('EXCLUIR CLIENTE? OS VALES ANTIGOS CONTINUAM NO HISTÓRICO.')) return;
  db.clientes = db.clientes.filter(c => c.id !== id);
  save(); renderAll();
}

/**
 * Carrega um vale do histórico no formulário de empréstimo para edição.
 */
function editLoan(id) {
  const v = db.vales.find(x => x.id === id);
  if (!v) return;
  editLoanId = id;
  $('loanCliente').value = v.cliente;
  $('loanValor').value = money(v.valor);
  $('loanJuros').value = String(v.juros).replace('.', ',') + '%';
  $('loanTotal').value = money(v.total);
  $('loanInicio').value = v.dataInicial;
  $('loanFinal').value = v.dataFinal;
  $('loanObs').value = v.observacao || '';
  calcLoan();
  switchScreen('emprestimo');
  toast('EDITANDO VALE');
}

/**
 * Exclui um vale do histórico após confirmação.
 */
function deleteLoan(id) { if (confirm('EXCLUIR VALE?')) { db.vales = db.vales.filter(v => v.id !== id); save(); renderAll(); } }
/**
 * Alterna o status do vale entre ABERTO e PAGO/RECEBIDO.
 */
function togglePaid(id) { const v = db.vales.find(x => x.id === id); if (v) { v.status = v.status === 'PAGO' ? 'ABERTO' : 'PAGO'; save(); renderAll(); } }
/**
 * Abre o discador do celular para ligar para o cliente.
 */
function callClient(id) { const c = clienteById(id); const n = whatsNumber(c?.telefone); if (!n) { toast('SEM TELEFONE'); return; } location.href = 'tel:+' + n; }
/**
 * Abre uma conversa do WhatsApp com o cliente.
 */
function openWhatsClient(id) { const c = clienteById(id); const n = whatsNumber(c?.telefone); if (!n) { toast('SEM TELEFONE'); return; } window.open(`https://wa.me/${n}`, '_blank'); }
/**
 * Cria o círculo com a primeira letra do nome do cliente.
 */
function avatar(c) { return `<div class="avatar">${h((c?.nome || '?').slice(0, 1))}</div>`; }


/**
 * Monta a lista de clientes na tela, aplicando a pesquisa digitada.
 */
function renderClients() {
  const q = upper($('searchClientes').value || '');
  const arr = db.clientes.filter(c => [c.nome, c.telefone, c.cpf, c.obs].join(' ').includes(q));
  $('clientesContainer').innerHTML = arr.length ? arr.map(c => `
    <div class="item">
      <div class="item-top"><div style="display:flex;gap:10px">${avatar(c)}<div><h3>${h(c.nome)}</h3><p>${h(c.telefone || 'SEM TELEFONE')}<br>CPF: ${h(c.cpf || 'NÃO INFORMADO')}</p></div></div></div>
      ${c.obs ? `<p>${h(c.obs)}</p>` : ''}
      <div class="row-btns">
        <button onclick="useClient('${c.id}')">USAR</button>
        <button onclick="editClient('${c.id}')">EDITAR</button>
        <button onclick="openWhatsClient('${c.id}')">WHATSAPP</button>
        <button onclick="callClient('${c.id}')">LIGAR</button>
        <button onclick="deleteClient('${c.id}')">EXCLUIR</button>
      </div>
    </div>`).join('') : '<p class="empty">NENHUM CLIENTE ENCONTRADO.</p>';
}


/**
 * Monta a lista do histórico de vales, com botões de editar, imprimir, PDF, WhatsApp, recebido e excluir.
 */
function renderHistory() {
  const q = upper($('searchHistorico').value || '');
  const arr = db.vales.filter(v => v.cliente.includes(q) || String(v.numero).includes(q));
  $('historicoContainer').innerHTML = arr.length ? arr.map(v => {
    const c = clienteById(v.clienteId) || clienteByName(v.cliente) || {};
    const st = loanStatus(v);
    const dias = days(inputDate(new Date()), v.dataFinal);
    const statusTxt = v.status === 'PAGO' ? 'PAGO' : st === 'atrasado' ? 'ATRASADO' : 'ABERTO';
    return `<div class="item">
      <div class="item-top"><div style="display:flex;gap:10px">${avatar({ ...c, nome: v.cliente })}<div><h3>#${String(v.numero).padStart(4, '0')} - ${h(v.cliente)}</h3><p>${h(v.telefone || c.telefone || 'SEM TELEFONE')}<br>VALOR: <b>${money(v.valor)}</b> | TOTAL: <b>${money(v.total)}</b><br>VENCIMENTO: ${brDate(v.dataFinal)} | ${dias} DIAS</p></div></div><span class="status ${st}">${statusTxt}</span></div>
      <div class="row-btns"><button onclick="editLoan('${v.id}')">EDITAR</button><button onclick="printLoanById('${v.id}')">IMPRIMIR</button><button onclick="downloadLoanPdf('${v.id}')">PDF</button><button onclick="sharePdfById('${v.id}')">WHATSAPP</button><button onclick="togglePaid('${v.id}')">${v.status === 'PAGO' ? 'ABRIR' : 'RECEBIDO'}</button><button onclick="deleteLoan('${v.id}')">EXCLUIR</button></div>
    </div>`;
  }).join('') : '<p>NENHUM VALE.</p>';
}

/**
 * Calcula e mostra todos os valores do Dashboard: caixa, emprestado, juros, recebido e vencimentos.
 */
function renderDashboard() {
  const vales = db.vales;
  const aberto = vales.filter(v => v.status !== 'PAGO');
  const pagos = vales.filter(v => v.status === 'PAGO');
  const today = inputDate(new Date());
  const week = new Date();
  week.setDate(week.getDate() + 7);
  const weekS = inputDate(week);

  const capitalInvestido = Number(db.settings.capitalInvestido || 0);
  const percentualJuros50 = Number(db.settings.percentualJuros50 || 50);

  // LÓGICA PRINCIPAL DO DASHBOARD:
  // Valor emprestado = soma somente dos vales EM ABERTO.
  // Caixa = capital investido - valor emprestado.
  // Total de juros = total a pagar - principal, somente dos vales em aberto.
  const valorEmprestado = aberto.reduce((s, v) => s + Number(v.valor || 0), 0);
  const totalJuros = aberto.reduce((s, v) => {
    const principal = Number(v.valor || 0);
    const total = Number(v.total || 0);
    return s + Math.max(0, total - principal);
  }, 0);
  const jurosPercentual = totalJuros * (percentualJuros50 / 100);
  const totalComJuros = valorEmprestado + totalJuros;
  const totalComJurosPercentual = valorEmprestado + jurosPercentual;
  const valorEmCaixa = capitalInvestido - valorEmprestado;
  const totalRecebido = pagos.reduce((s, v) => s + Number(v.total || 0), 0);
  const rentabilidade = capitalInvestido > 0 ? (totalJuros / capitalInvestido) * 100 : 0;

  // Mantém a aba Configuração sincronizada sem atrapalhar o usuário enquanto digita.
  if ($('configCapitalInvestido') && document.activeElement !== $('configCapitalInvestido')) $('configCapitalInvestido').value = money(capitalInvestido);
  if ($('configPercentualJuros') && document.activeElement !== $('configPercentualJuros')) $('configPercentualJuros').value = String(percentualJuros50).replace('.', ',') + '%';

  // Atualiza os cards principais do Dashboard.
  if ($('dashCaixa')) $('dashCaixa').textContent = money(valorEmCaixa);
  if ($('dashInvestido')) $('dashInvestido').textContent = money(capitalInvestido);
  if ($('dashEmprestado')) $('dashEmprestado').textContent = money(valorEmprestado);
  if ($('dashReceber')) $('dashReceber').textContent = money(totalComJuros);
  if ($('dashTotalJuros')) $('dashTotalJuros').textContent = money(totalJuros);
  if ($('dashJurosPercentual')) $('dashJurosPercentual').textContent = money(jurosPercentual);
  if ($('dashTotalJurosPercentual')) $('dashTotalJurosPercentual').textContent = money(totalComJurosPercentual);
  if ($('dashRecebido')) $('dashRecebido').textContent = money(totalRecebido);
  if ($('dashClientes')) $('dashClientes').textContent = db.clientes.length;
  if ($('dashPctLabel')) $('dashPctLabel').textContent = String(percentualJuros50).replace('.', ',') + '%';
  if ($('dashAtualizacao')) {
    const agora = new Date();
    $('dashAtualizacao').textContent = `${brDate(inputDate(agora))} às ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  }

  // Contador da aba Notificações.
  const vencidosLista = aberto.filter(v => v.dataFinal < today);
  const hojeLista = aberto.filter(v => v.dataFinal === today);
  const semanaLista = aberto.filter(v => v.dataFinal >= today && v.dataFinal <= weekS);
  if ($('notifCount')) {
    const qtdNotif = vencidosLista.length + hojeLista.length + semanaLista.length;
    $('notifCount').textContent = qtdNotif > 99 ? '99+' : qtdNotif;
    $('notifCount').style.display = qtdNotif ? 'inline-flex' : 'none';
  }

  // Gráfico estilo rosca com a distribuição entre caixa, emprestado e a receber.
  if ($('capitalChart')) {
    const base = Math.max(capitalInvestido, valorEmprestado + totalComJuros, 1);
    const pctCaixa = Math.max(0, Math.min(100, (valorEmCaixa / base) * 100));
    const pctEmprestado = Math.max(0, Math.min(100, (valorEmprestado / base) * 100));
    const pctReceber = Math.max(0, Math.min(100, (totalComJuros / base) * 100));
    const totalGeral = Math.max(0, valorEmCaixa) + valorEmprestado + totalComJuros;
    const pctCaixaTotal = totalGeral > 0 ? (Math.max(0, valorEmCaixa) / totalGeral) * 100 : 0;
    const pctEmprestadoTotal = totalGeral > 0 ? (valorEmprestado / totalGeral) * 100 : 0;
    const pctReceberTotal = totalGeral > 0 ? (totalComJuros / totalGeral) * 100 : 0;

    $('capitalChart').innerHTML = `
      <div class="donut-pro-wrap">
        <div class="donut-pro" style="--caixa:${pctCaixaTotal};--emprestado:${pctEmprestadoTotal};--receber:${pctReceberTotal}">
          <div><span>Total geral</span><strong>${money(totalGeral)}</strong></div>
        </div>
        <div class="donut-legend-pro">
          <div><i class="leg-caixa"></i><span>Em caixa</span><strong>${money(valorEmCaixa)}</strong><em>${pctCaixa.toFixed(1).replace('.', ',')}%</em></div>
          <div><i class="leg-emprestado"></i><span>Emprestado</span><strong>${money(valorEmprestado)}</strong><em>${pctEmprestado.toFixed(1).replace('.', ',')}%</em></div>
          <div><i class="leg-receber"></i><span>A receber c/ juros</span><strong>${money(totalComJuros)}</strong><em>${pctReceber.toFixed(1).replace('.', ',')}%</em></div>
          <div><i class="leg-capital"></i><span>Total do capital</span><strong>${money(capitalInvestido)}</strong><em>100%</em></div>
        </div>
      </div>`;
  }

  // Tabela dos últimos vales no Dashboard.
  if ($('ultimosVales')) {
    const ultimos = [...db.vales].sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))).slice(0, 5);
    $('ultimosVales').innerHTML = ultimos.length ? `
      <div class="loan-row loan-head"><span>Cliente</span><span>Valor</span><span>Vencimento</span><span>Status</span></div>
      ${ultimos.map(v => {
        const st = loanStatus(v);
        const txt = v.status === 'PAGO' ? 'Pago' : st === 'atrasado' ? 'Atrasado' : (v.dataFinal === today ? 'Vence hoje' : 'Em aberto');
        const c = clienteById(v.clienteId) || clienteByName(v.cliente) || { nome: v.cliente };
        return `<div class="loan-row">
          <span class="loan-client">${avatar(c)}<b>${h(v.cliente)}</b><small>${h(v.telefone || c.telefone || '')}</small></span>
          <span>${money(v.valor)}</span>
          <span>${brDate(v.dataFinal)}</span>
          <span><em class="status ${st}">${txt}</em></span>
        </div>`;
      }).join('')}` : '<p class="empty-dashboard">Nenhum vale cadastrado ainda.</p>';
  }
}

/**
 * Salva capital investido e percentual dos juros configurável no localStorage.
 */
function saveDashboardConfig() {
  db.settings.capitalInvestido = moneyNum($('configCapitalInvestido').value);
  db.settings.percentualJuros50 = taxaNum($('configPercentualJuros').value);
  save();
  renderDashboard();
  toast('CONFIGURAÇÃO SALVA');
}

/**
 * Calcula e mostra relatórios: cliente que mais pegou, maior devedor, total em aberto e recebido.
 */
function renderReports() {
  const aberto = db.vales.filter(v => v.status !== 'PAGO');
  const pagos = db.vales.filter(v => v.status === 'PAGO');
  const por = {};
  db.vales.forEach(v => {
    por[v.cliente] = por[v.cliente] || { q: 0, total: 0, aberto: 0 };
    por[v.cliente].q++;
    por[v.cliente].total += v.total;
    if (v.status !== 'PAGO') por[v.cliente].aberto += v.total;
  });
  const arr = Object.entries(por).map(([nome, o]) => ({ nome, ...o }));
  const top = [...arr].sort((a, b) => b.q - a.q)[0];
  const dev = [...arr].sort((a, b) => b.aberto - a.aberto)[0];
  $('relTopCliente').textContent = top ? `${top.nome} (${top.q})` : '-';
  $('relMaiorDevedor').textContent = dev ? `${dev.nome} ${money(dev.aberto)}` : '-';
  $('relAberto').textContent = money(aberto.reduce((s, v) => s + v.total, 0));
  $('relRecebido').textContent = money(pagos.reduce((s, v) => s + v.total, 0));
  $('relDividas').innerHTML = arr.length ? arr.sort((a, b) => b.aberto - a.aberto).map(x => `<div class="item"><b>${h(x.nome)}</b><p>VALES: ${x.q} | EM ABERTO: ${money(x.aberto)} | TOTAL: ${money(x.total)}</p></div>`).join('') : '<p>SEM DADOS.</p>';
}

/**
 * Atualiza todas as áreas visuais do sistema de uma vez.
 */

/**
 * Monta a aba Notificações no estilo WhatsApp.
 * Ela mostra somente cobranças que precisam de atenção: atrasadas, vencendo hoje e próximas 7 dias.
 */
function renderNotifications() {
  if (!$('notificacoesContainer')) return;

  const today = inputDate(new Date());
  const abertos = db.vales.filter(v => v.status !== 'PAGO');
  const notificacoes = abertos
    .map(v => ({ ...v, diasRestantes: days(today, v.dataFinal) }))
    .filter(v => v.diasRestantes <= 7)
    .sort((a, b) => {
      if (a.diasRestantes !== b.diasRestantes) return a.diasRestantes - b.diasRestantes;
      return String(a.cliente).localeCompare(String(b.cliente));
    });

  const atrasados = notificacoes.filter(v => v.diasRestantes < 0);
  const hoje = notificacoes.filter(v => v.diasRestantes === 0);
  const semana = notificacoes.filter(v => v.diasRestantes > 0);
  const total = notificacoes.reduce((s, v) => s + Number(v.total || 0), 0);

  if ($('notificacoesResumo')) {
    $('notificacoesResumo').innerHTML = notificacoes.length ? `
      <span class="notif-chip danger">🔴 ${atrasados.length} ATRASADO${atrasados.length === 1 ? '' : 'S'}</span>
      <span class="notif-chip warn">🟠 ${hoje.length} HOJE</span>
      <span class="notif-chip week">🟡 ${semana.length} PRÓXIMOS</span>
      <strong>${money(total)}</strong>` :
      '<span class="notif-chip ok">✅ NENHUMA COBRANÇA URGENTE</span>';
  }

  if ($('notifCount')) {
    $('notifCount').textContent = notificacoes.length > 99 ? '99+' : notificacoes.length;
    $('notifCount').style.display = notificacoes.length ? 'inline-flex' : 'none';
  }

  if (!notificacoes.length) {
    $('notificacoesContainer').innerHTML = `
      <div class="whatsapp-empty card">
        <div class="wa-icon">✅</div>
        <h3>Tudo certo por aqui</h3>
        <p>Não existem vales atrasados ou próximos do vencimento.</p>
      </div>`;
    return;
  }

  $('notificacoesContainer').innerHTML = notificacoes.map(v => {
    const dias = Number(v.diasRestantes || 0);
    let cls = 'week', titulo = `VENCE EM ${dias} DIAS`, icone = '🟡';
    if (dias < 0) { cls = 'danger'; titulo = `${Math.abs(dias)} DIA${Math.abs(dias) === 1 ? '' : 'S'} ATRASADO`; icone = '🔴'; }
    else if (dias === 0) { cls = 'today'; titulo = 'VENCE HOJE'; icone = '🚨'; }
    else if (dias === 1) { cls = 'tomorrow'; titulo = 'VENCE AMANHÃ'; icone = '🟠'; }

    return `
      <div class="wa-notification ${cls}">
        <div class="wa-avatar">${icone}</div>
        <div class="wa-bubble">
          <div class="wa-top">
            <strong>${h(v.cliente)}</strong>
            <small>${brDate(v.dataFinal)}</small>
          </div>
          <div class="wa-title">${titulo}</div>
          <p><b>${money(v.total)}</b> para receber • VALE Nº ${String(v.numero || '').padStart(4, '0')}</p>
          <div class="wa-actions">
            <button onclick="sharePdfById('${v.id}')">WHATSAPP</button>
            <button onclick="togglePaid('${v.id}')">RECEBIDO</button>
            <button onclick="printLoanById('${v.id}')">IMPRIMIR</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderAll() { renderClients(); renderHistory(); renderDashboard(); renderNotifications(); renderReports(); }

/**
 * Limpa textos para colocar dentro do PDF manual sem quebrar a estrutura do arquivo.
 */
function pdfEscape(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
/**
 * Gera o PDF profissional do vale usando comandos internos do formato PDF.
 */
function makePdf(v) {
  const W = 595, H = 842, ops = [];
  const rgb = h => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16) / 255).join(' ');
  const fill = h => ops.push(rgb(h) + ' rg');
  const stroke = h => ops.push(rgb(h) + ' RG');
  const txt = (t, x, y, s = 11, b = 0, color = '#111827') => {
    fill(color);
    ops.push(`BT /${b ? 'F2' : 'F1'} ${s} Tf ${x} ${y} Td (${pdfEscape(t)}) Tj ET`);
  };
  const line = (x1, y1, x2, y2, color = '#111827', w = 1) => {
    stroke(color);
    ops.push(`${w} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const rect = (x, y, w, h, fillHex = null, strokeHex = '#111827', lw = 1) => {
    stroke(strokeHex);
    ops.push(`${lw} w`);
    if (fillHex) {
      fill(fillHex);
      ops.push(`${x} ${y} ${w} ${h} re B`);
    } else {
      ops.push(`${x} ${y} ${w} ${h} re S`);
    }
  };
  const dot = (x1, y1, x2, y2, color = '#9ca3af') => {
    stroke(color);
    ops.push(`1 w [2 4] 0 d ${x1} ${y1} m ${x2} ${y2} l S [] 0 d`);
  };
  const clean = t => String(t || '').toUpperCase();
  const prazo = days(v.dataInicial, v.dataFinal);
  const numero = String(v.numero || '').padStart(4, '0');
  const cliente = clean(v.cliente || 'NAO INFORMADO');
  const telefone = clean(v.telefone || 'NAO INFORMADO');
  const cpf = clean(v.cpf || 'NAO INFORMADO');
  const obs = clean(v.observacao || 'NENHUMA');

  // Fundo e moldura principal
  rect(28, 28, W - 56, H - 56, '#ffffff', '#d1d5db', 1.2);
  rect(42, 42, W - 84, H - 84, null, '#0f3b78', 1.4);

  // Cabeçalho
  txt('VALE', 62, 744, 56, 1, '#0b2f63');
  rect(260, 758, 112, 44, '#1d5fbf', '#1d5fbf', 1);
  txt(`${prazo} DIAS`, 282, 773, 19, 1, '#ffffff');
  txt('COMPROVANTE DE EMPRESTIMO', 64, 725, 16, 1, '#4b5563');
  txt('VALE No ' + numero, 438, 782, 12, 1, '#0b2f63');
  txt('CONFIANCA E COMPROMISSO', 405, 760, 9, 1, '#0b2f63');
  line(58, 707, W - 58, 707, '#0b2f63', 2);

  // Cliente e telefone
  txt('CLIENTE', 70, 665, 11, 1, '#0b2f63');
  txt(cliente.slice(0, 28), 70, 638, 27, 1, '#111827');
  txt('TELEFONE / WHATSAPP', 350, 665, 11, 1, '#166534');
  txt(telefone.slice(0, 22), 350, 640, 20, 1, '#111827');
  txt('CPF', 70, 613, 10, 1, '#64748b');
  txt(cpf.slice(0, 20), 105, 613, 12, 1, '#111827');
  dot(58, 594, W - 58, 594);

  // Cartões de valores
  const cy = 470, ch = 92;
  rect(62, cy, 150, ch, '#f0f7ff', '#93c5fd', 1);
  txt('VALOR DO', 82, cy + 61, 12, 1, '#0b3b78');
  txt('EMPRESTIMO', 82, cy + 44, 12, 1, '#0b3b78');
  dot(82, cy + 28, 192, cy + 28, '#6b7280');
  txt(money(v.valor), 82, cy + 13, 25, 1, '#0b3b78');

  rect(232, cy, 170, ch, '#f0fdf4', '#86efac', 1);
  txt('TOTAL A PAGAR', 254, cy + 55, 13, 1, '#166534');
  dot(254, cy + 28, 380, cy + 28, '#6b7280');
  txt(money(v.total), 254, cy + 13, 25, 1, '#166534');

  rect(422, cy, 112, ch, '#fffbeb', '#fde68a', 1);
  txt('TAXA DE', 446, cy + 61, 12, 1, '#854d0e');
  txt('JUROS', 446, cy + 44, 12, 1, '#854d0e');
  dot(446, cy + 28, 510, cy + 28, '#6b7280');
  txt(String(v.juros).replace('.', ',') + '%', 462, cy + 13, 24, 1, '#854d0e');

  // Status
  rect(62, 410, W - 124, 42, '#faf5ff', '#c084fc', 1);
  txt('STATUS', 84, 435, 11, 1, '#6b21a8');
  txt(v.status || 'ABERTO', 84, 416, 19, 1, '#6b21a8');

  // Datas
  rect(62, 330, W - 124, 58, '#f8fbff', '#bfdbfe', 1);
  txt('DATA INICIAL', 84, 362, 11, 1, '#0b3b78');
  txt(brDate(v.dataInicial), 84, 340, 20, 1, '#111827');
  line(W / 2, 340, W / 2, 374, '#94a3b8', .8);
  txt('DATA FINAL', 330, 362, 11, 1, '#0b3b78');
  txt(brDate(v.dataFinal), 330, 340, 20, 1, '#dc2626');

  // Observação
  rect(62, 220, W - 124, 86, '#ffffff', '#d1d5db', 1);
  txt('OBSERVACAO', 84, 284, 11, 1, '#4b5563');
  const o1 = obs.slice(0, 72);
  const o2 = obs.slice(72, 144);
  txt(o1 || 'NENHUMA', 84, 262, 12, 1, '#111827');
  dot(84, 252, W - 86, 252);
  txt(o2 || ' ', 84, 235, 11, 0, '#111827');
  dot(84, 226, W - 86, 226);

  // Assinatura
  rect(62, 116, W - 124, 74, '#ffffff', '#d1d5db', 1);
  txt('ASSINATURA DO CLIENTE', 84, 166, 11, 1, '#4b5563');
  line(122, 132, W - 122, 132, '#111827', 1.1);

  // Rodapé
  line(58, 88, W - 58, 88, '#0b2f63', 2);
  txt('Vale gerado pelo sistema de controle de clientes.', 82, 62, 10, 0, '#334155');
  txt('VALE No ' + numero, 418, 62, 13, 1, '#0b2f63');

  const stream = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n', pos = [0];
  objs.forEach((o, i) => { pos.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i < pos.length; i++) pdf += String(pos[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 255;
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Cria o nome do arquivo PDF com número do vale e nome do cliente.
 */
function pdfName(v) { return `VALE-${String(v.numero).padStart(4, '0')}-${pdfEscape(v.cliente).replace(/\s+/g, '-')}.pdf`; }
/**
 * Força o download de um arquivo Blob, usado para PDF e backup.
 */
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
/**
 * Baixa o PDF de um vale específico do histórico.
 */
function downloadLoanPdf(id) { const v = db.vales.find(x => x.id === id); if (v) downloadBlob(makePdf(v), pdfName(v)); }
/**
 * Busca um vale pelo ID e chama a função de impressão.
 */
/**
 * Abre uma janela de impressão com o vale em formato imprimível.
 */
function printLoanById(id) { const v = db.vales.find(x => x.id === id); if (v) printLoan(v); }

function printLoan(v) {
  const w = window.open('', '_blank', 'width=420,height=650');
  if (!w) { toast('PERMITA POP-UPS PARA IMPRIMIR'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Vale</title><style>@page{size:A6;margin:8mm}*{box-sizing:border-box;font-family:Arial;text-transform:uppercase}body{margin:0}.vale{border:2px solid #111;border-radius:10px;padding:14px}.top{text-align:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}h1{font-size:38px;margin:0}.line{margin:10px 0}.rot{font-size:11px;font-weight:bold;color:#555}.val{font-size:18px;font-weight:bold;border-bottom:1px solid #999;padding:5px 0}.duo{display:grid;grid-template-columns:1fr 1fr;gap:12px}.obs{min-height:55px}.ass{margin-top:34px;text-align:center;border-top:1px solid #111;padding-top:8px;font-weight:bold}</style></head><body onload="print();setTimeout(()=>close(),600)"><div class="vale"><div class="top"><h1>VALE</h1><b>${days(v.dataInicial, v.dataFinal)} DIAS</b></div><div class="line"><div class="rot">Cliente</div><div class="val">${h(v.cliente)}</div></div><div class="line"><div class="rot">CPF / Telefone</div><div class="val">${h((v.cpf || '') + ' ' + (v.telefone || ''))}</div></div><div class="duo"><div class="line"><div class="rot">Valor</div><div class="val">${money(v.valor)}</div></div><div class="line"><div class="rot">Total</div><div class="val">${money(v.total)}</div></div></div><div class="duo"><div class="line"><div class="rot">Juros</div><div class="val">${String(v.juros).replace('.', ',')}%</div></div><div class="line"><div class="rot">Vale Nº</div><div class="val">${String(v.numero).padStart(4, '0')}</div></div></div><div class="duo"><div class="line"><div class="rot">Data inicial</div><div class="val">${brDate(v.dataInicial)}</div></div><div class="line"><div class="rot">Data final</div><div class="val">${brDate(v.dataFinal)}</div></div></div><div class="line"><div class="rot">Observação</div><div class="val obs">${h(v.observacao || 'NENHUMA')}</div></div><div class="ass">ASSINATURA DO CLIENTE</div></div></body></html>`);
  w.document.close();
}

/**
 * Gera o PDF e tenta compartilhar pelo recurso nativo do celular; se não der, baixa o PDF e abre WhatsApp.
 */
async function sharePdf(v) {
  const c = clienteByName(v.cliente);
  const fone = whatsNumber(v.telefone || c?.telefone);
  const blob = makePdf(v);
  const file = new File([blob], pdfName(v), { type: 'application/pdf' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'VALE DE EMPRÉSTIMO' });
      toast('ESCOLHA O WHATSAPP');
    } else {
      downloadBlob(blob, pdfName(v));
      if (fone) window.open(`https://wa.me/${fone}`, '_blank');
      toast('PDF BAIXADO. ANEXE NO WHATSAPP');
    }
  } catch (e) { toast('ENVIO CANCELADO'); }
}
/**
 * Compartilha o PDF de um vale existente no histórico.
 */
function sharePdfById(id) { const v = db.vales.find(x => x.id === id); if (v) sharePdf(v); }

/**
 * Baixa todos os dados do sistema em arquivo JSON.
 */
function backupJson() { downloadBlob(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }), 'backup-emprestimos-pro.json'); }
/**
 * Restaura os dados do sistema a partir de um arquivo JSON de backup.
 */
function restore(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { db = normalizeDb(JSON.parse(r.result)); save(); renderAll(); toast('BACKUP RESTAURADO'); } catch (err) { toast('ARQUIVO INVÁLIDO'); } };
  r.readAsText(f);
}
/**
 * Apaga todos os dados salvos após confirmação.
 */
function wipe() { if (confirm('APAGAR TODOS OS DADOS?')) { db = seed(); save(); clearLoan(); renderAll(); } }

/**
 * Inicializa o sistema: normaliza dados, aplica tema, configura eventos dos botões e renderiza a tela.
 */
function init() {
  db = normalizeDb(db); save(); applyTheme(); clearLoan(); renderAll();
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => switchScreen(b.dataset.screen));
  $('themeBtn').onclick = () => { db.settings.theme = db.settings.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };
  if ($('configCapitalInvestido')) $('configCapitalInvestido').oninput = e => { e.target.value = money(moneyNum(e.target.value)); };
  if ($('configPercentualJuros')) $('configPercentualJuros').onblur = e => { e.target.value = String(taxaNum(e.target.value)).replace('.', ',') + '%'; };
  if ($('saveConfigBtn')) $('saveConfigBtn').onclick = saveDashboardConfig;
  $('loanValor').oninput = e => { e.target.value = money(moneyNum(e.target.value)); calcLoan(); };
  $('loanJuros').oninput = calcLoan;
  $('loanJuros').onblur = e => { e.target.value = String(taxaNum(e.target.value)).replace('.', ',') + '%'; calcLoan(); };
  $('loanInicio').onchange = () => { const d = new Date($('loanInicio').value + 'T00:00:00'); if (!isNaN(d)) { d.setDate(d.getDate() + 30); $('loanFinal').value = inputDate(d); } calcLoan(); };
  $('loanFinal').onchange = calcLoan;
  ['loanCliente', 'loanObs', 'cliNome', 'cliObs'].forEach(id => $(id).oninput = e => { const p = e.target.selectionStart; e.target.value = upper(e.target.value); try { e.target.setSelectionRange(p, p); } catch (_) {} });
  $('cliTelefone').oninput = e => e.target.value = phoneMask(e.target.value);
  $('cliCpf').oninput = e => e.target.value = cpfMask(e.target.value);
  $('savePrintBtn').onclick = savePrint;
  $('sendPdfBtn').onclick = saveSendPdf;
  $('saveOnlyBtn').onclick = saveOnly;
  $('clearLoanBtn').onclick = clearLoan;
  $('saveClientBtn').onclick = saveClient;
  $('clearClientBtn').onclick = clearClient;
  $('searchClientes').oninput = renderClients;
  $('searchHistorico').oninput = renderHistory;
  $('backupJsonBtn').onclick = backupJson;
  $('restoreInput').onchange = restore;
  $('wipeBtn').onclick = wipe;
}

init();
