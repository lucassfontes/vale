(function(){
  'use strict';

  const ACTIONS = new Set(['CRIAR_VALE','QUITAR_VALE','PAGAMENTO_PARCIAL','PAGAMENTO_JUROS']);
  const PAYMENT_ACTIONS = new Set(['QUITAR_VALE','PAGAMENTO_PARCIAL','PAGAMENTO_JUROS']);
  const state = { entries: [], loading: false, loadedAt: 0, bound: false };

  const el = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const numberValue = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const moneyBR = value => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(numberValue(value));
  const monthRange = () => {
    if (window.VallePeriod?.currentMonth) return window.VallePeriod.currentMonth();
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { from:iso(first), to:iso(now) };
  };
  function applyDefaultPeriod(force=false){
    const range=monthRange();
    const from=el('lancamentosDataInicial');
    const to=el('lancamentosDataFinal');
    if(from && (force || !from.value)) from.value=range.from;
    if(to && (force || !to.value)) to.value=range.to;
    return range;
  }

  const dateTimeBR = value => {
    const d = new Date(value || Date.now());
    return Number.isNaN(d.getTime()) ? { date:'—', time:'—', iso:'' } : {
      date:d.toLocaleDateString('pt-BR'),
      time:d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
      iso:d.toISOString().slice(0,10)
    };
  };

  function remainingBalance(data){
    const total = numberValue(data?.totalOriginal ?? data?.total);
    const received = numberValue(data?.principalRecebido) + numberValue(data?.jurosRecebidos);
    return Math.max(0, total - received);
  }

  function entryAmount(log){
    const details = log?.details || {};
    const explicit = numberValue(details.valor_pago ?? details.valor_lancamento);
    if (explicit > 0) return explicit;
    if (log.action === 'CRIAR_VALE') return numberValue(log.new_data?.valor ?? log.new_data?.valorOriginal);
    if (log.action === 'QUITAR_VALE') return remainingBalance(log.old_data || log.new_data || {});
    return 0;
  }

  function actionMeta(action){
    const map = {
      CRIAR_VALE: { category:'vales', label:'NOVO VALE', icon:'bi-file-earmark-plus', tone:'purple' },
      QUITAR_VALE: { category:'pagamentos', label:'PAGAMENTO TOTAL', icon:'bi-check-circle-fill', tone:'green' },
      PAGAMENTO_PARCIAL: { category:'pagamentos', label:'PAGAMENTO PARCIAL', icon:'bi-cash-stack', tone:'orange' },
      PAGAMENTO_JUROS: { category:'pagamentos', label:'PAGAMENTO DE JUROS', icon:'bi-percent', tone:'cyan' }
    };
    return map[action] || { category:'outros', label:String(action || 'LANÇAMENTO').replaceAll('_',' '), icon:'bi-journal-text', tone:'gray' };
  }

  function extractObservation(log, source){
    const details = log?.details || {};
    const direct = details.observacao ?? details.observacao_pagamento ?? details.payment_observation ?? details.obs ?? details.observation;
    if (String(direct ?? '').trim()) return String(direct).trim();
    const raw = String(source?.observacao ?? source?.obs ?? '').trim();
    if (!raw) return '';
    const action = String(log?.action || '').toUpperCase();
    if (action === 'PAGAMENTO_PARCIAL' || action === 'PAGAMENTO_JUROS') {
      const lines = raw.split(/\n+/).map(line => line.trim()).filter(Boolean);
      return lines.at(-1) || '';
    }
    return raw;
  }

  function normalizeLog(log){
    const meta = actionMeta(log.action);
    const dt = dateTimeBR(log.created_at);
    const source = log.new_data || log.old_data || {};
    return {
      id:String(log.id || log.signature || `${log.action}-${log.created_at}`),
      signature:String(log.signature || ''),
      action:String(log.action || '').toUpperCase(),
      category:meta.category,
      label:meta.label,
      icon:meta.icon,
      tone:meta.tone,
      amount:entryAmount(log),
      originalPrincipal:numberValue(source.valorOriginal ?? source.valor ?? log.old_data?.valorOriginal ?? log.old_data?.valor),
      principalAmount:numberValue(log.details?.valor_principal_pago),
      interestAmount:numberValue(log.details?.valor_juros_pago),
      client:String(log.client_name || source.cliente || source.nome || 'SEM CLIENTE'),
      vale:String(log.vale_number || source.numero || ''),
      valeId:String(log.entity_id || source.id || ''),
      observation:extractObservation(log, source),
      actorId:String(log.actor_user_id || ''),
      actorName:String(log.actor_role || '').toLowerCase() === 'service'
        ? String(log.actor_name || 'USUÁRIO').toLocaleUpperCase('pt-BR')
        : String(log.actor_name || 'USUÁRIO'),
      actorRole:String(log.actor_role || ''),
      description:String(log.description || ''),
      date:dt.date,
      time:dt.time,
      day:dt.iso,
      createdAt:String(log.created_at || ''),
      raw:log
    };
  }


  function enrichPaymentBreakdown(entries){
    const groups=new Map();
    entries.forEach(item=>{
      const key=item.valeId || item.vale || item.id;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(item);
    });
    groups.forEach(items=>{
      items.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
      const original=Math.max(0,...items.map(item=>numberValue(item.originalPrincipal)));
      let principalPaid=0;
      items.forEach(item=>{
        if(!PAYMENT_ACTIONS.has(item.action)) return;
        const explicitPrincipal=numberValue(item.principalAmount);
        const explicitInterest=numberValue(item.interestAmount);
        if(explicitPrincipal>0 || explicitInterest>0 || item.action==='PAGAMENTO_JUROS'){
          item.principalAmount=explicitPrincipal;
          item.interestAmount=item.action==='PAGAMENTO_JUROS' && explicitInterest<=0 ? item.amount : explicitInterest;
          principalPaid+=explicitPrincipal;
          return;
        }
        if(item.action==='PAGAMENTO_JUROS'){
          item.principalAmount=0;
          item.interestAmount=item.amount;
          return;
        }
        const principalRemaining=Math.max(0, original-principalPaid);
        const principalPart=Math.min(item.amount,principalRemaining);
        item.principalAmount=principalPart;
        item.interestAmount=Math.max(0,item.amount-principalPart);
        principalPaid+=principalPart;
      });
    });
    return entries.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  }

  function currentFilters(){
    return {
      search:String(el('lancamentosSearch')?.value || '').trim().toLowerCase(),
      type:String(el('lancamentosTipo')?.value || 'todos'),
      user:String(el('lancamentosUsuario')?.value || ''),
      from:String(el('lancamentosDataInicial')?.value || ''),
      to:String(el('lancamentosDataFinal')?.value || '')
    };
  }

  function filteredEntries(){
    const f = currentFilters();
    return state.entries.filter(item => {
      const haystack = [item.client,item.vale,item.actorName,item.label,item.description,item.observation].join(' ').toLowerCase();
      return (!f.search || haystack.includes(f.search)) &&
        (f.type === 'todos'
          || (f.type === 'pagamentos' && item.category === 'pagamentos')
          || (f.type === 'vales' && item.category === 'vales')
          || (f.type === 'quitados' && item.action === 'QUITAR_VALE')
          || (f.type === 'parciais' && item.action === 'PAGAMENTO_PARCIAL')
          || (f.type === 'juros' && item.action === 'PAGAMENTO_JUROS')) &&
        (!f.user || item.actorId === f.user) &&
        (!f.from || item.day >= f.from) &&
        (!f.to || item.day <= f.to);
    });
  }

  function fillUsers(){
    const select = el('lancamentosUsuario');
    if (!select) return;
    const current = select.value;
    const users = [...new Map(state.entries.map(item => [item.actorId, item.actorName]).filter(([id]) => id)).entries()]
      .sort((a,b) => a[1].localeCompare(b[1], 'pt-BR'));
    select.innerHTML = '<option value="">TODOS OS USUÁRIOS</option>' + users.map(([id,name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
    if (users.some(([id]) => id === current)) select.value = current;
  }

  function renderSummary(entries){
    const payments=entries.filter(item=>item.category==='pagamentos');
    const quitados=entries.filter(item=>item.action==='QUITAR_VALE');
    const parciais=entries.filter(item=>item.action==='PAGAMENTO_PARCIAL');
    const juros=entries.filter(item=>item.action==='PAGAMENTO_JUROS');
    const vales=entries.filter(item=>item.action==='CRIAR_VALE');
    const total=value=>value.reduce((sum,item)=>sum+numberValue(item.amount),0);
    const totalReceived=total(payments);
    const totalProfit=payments.reduce((sum,item)=>sum+numberValue(item.interestAmount),0);
    const setText=(id,value)=>{const node=el(id);if(node)node.textContent=value;};
    const countText=(items)=>`${items.length} LANÇAMENTO${items.length===1?'':'S'}`;
    setText('lancamentosLucroMes',moneyBR(totalProfit));
    setText('lancamentosLucroMesQtd',`${payments.length} PAGAMENTO${payments.length===1?'':'S'} NO PERÍODO`);
    setText('lancamentosTotalRecebido',moneyBR(totalReceived));
    setText('lancamentosQtdPagamentos',countText(payments));
    setText('lancamentosQuitadosValor',moneyBR(total(quitados)));
    setText('lancamentosQuitadosQtd',countText(quitados));
    setText('lancamentosParciaisValor',moneyBR(total(parciais)));
    setText('lancamentosParciaisQtd',countText(parciais));
    setText('lancamentosJurosValor',moneyBR(total(juros)));
    setText('lancamentosJurosQtd',countText(juros));
    setText('lancamentosQtdVales',String(vales.length));
    setText('lancamentosTotalVales',`${moneyBR(total(vales))} LIBERADOS`);
  }
  function currentDatabase(){
    return window.getValleDatabase?.() || window.db || { vales:[] };
  }

  function currentVale(item){
    const vales = currentDatabase()?.vales || [];
    return vales.find(v => String(v.id || '') === String(item.valeId || ''))
      || vales.find(v => item.vale && String(v.numero || '') === String(item.vale));
  }

  function actionAccess(item){
    const profile = window.ValleCloud?.profile || {};
    const permissions = window.VALLE_PERMISSIONS || {};
    const vale = currentVale(item);
    const service = profile.role === 'service';
    return {
      vale,
      canOpen:!!vale && (!service || permissions.can_receive_payment !== false),
      canEdit:!!vale && (!service || permissions.can_edit_vale !== false)
    };
  }

  function multiline(value){
    return escapeHtml(value).replace(/\r?\n/g, '<br>');
  }

  function entryHtml(item){
    const amountLabel = item.category === 'vales' ? 'VALOR LIBERADO' : 'VALOR PAGO';
    const access = actionAccess(item);
    const disabledOpen = access.canOpen ? '' : ' disabled aria-disabled="true"';
    const disabledEdit = access.canEdit ? '' : ' disabled aria-disabled="true"';
    const unavailableTitle = access.vale ? 'Permissão não concedida para esta ação.' : 'Este vale não existe mais no histórico atual.';
    const openTitle = access.canOpen ? 'Abrir os detalhes deste vale.' : unavailableTitle;
    const editTitle = access.canEdit ? 'Editar este vale.' : unavailableTitle;
    const observation = String(item.observation || '').trim();
    return `<article class="lancamento-item lancamento-${item.tone}" data-lancamento-id="${escapeHtml(item.id)}">
      <div class="lancamento-type-icon" aria-hidden="true"><i class="bi ${item.icon}"></i></div>
      <div class="lancamento-main">
        <div class="lancamento-head">
          <div class="lancamento-topline">
            <span class="lancamento-type-badge">${escapeHtml(item.label)}</span>
            ${item.vale ? `<span class="lancamento-vale-number"><i class="bi bi-receipt"></i> VALE #${escapeHtml(item.vale)}</span>` : ''}
          </div>
          <div class="lancamento-head-grid">
            <div class="lancamento-head-copy">
              <h3>${escapeHtml(item.client)}</h3>
              <div class="lancamento-meta">
                <span><i class="bi bi-person-check"></i><b>REALIZADO POR:</b> ${escapeHtml(item.actorName)}</span>
                <span><i class="bi bi-calendar3"></i><b>DATA:</b> ${escapeHtml(item.date)}</span>
              </div>
            </div>
            <div class="lancamento-value">
              <small>${amountLabel}</small>
              <strong>${moneyBR(item.amount)}</strong>
            </div>
          </div>
        </div>
        <div class="lancamento-footer-row">
          <div class="lancamento-observacao${observation ? '' : ' is-empty'}">
            <span class="lancamento-observacao-title"><i class="bi bi-chat-left-text"></i> OBSERVAÇÕES</span>
            <p>${observation ? multiline(observation) : 'SEM OBSERVAÇÕES NESTE LANÇAMENTO.'}</p>
          </div>
          <div class="lancamento-actions">
            <button type="button" class="btn lancamento-open-btn" data-lancamento-open="${escapeHtml(item.id)}" title="${escapeHtml(openTitle)}"${disabledOpen}>
              <i class="bi bi-folder2-open"></i><span>ABRIR VALE</span>
            </button>
            <button type="button" class="btn lancamento-edit-btn" data-lancamento-edit="${escapeHtml(item.id)}" title="${escapeHtml(editTitle)}"${disabledEdit}>
              <i class="bi bi-pencil-square"></i><span>EDITAR</span>
            </button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function draw(){
    const list = el('lancamentosLista');
    if (!list) return;
    const entries = filteredEntries();
    renderSummary(entries);
    const info = el('lancamentosResultInfo');
    if (info) {
      const f=currentFilters();
      const fmt=value=>value?value.split('-').reverse().join('/'):'—';
      info.textContent = `${entries.length} LANÇAMENTO${entries.length === 1 ? '' : 'S'} · PERÍODO ${fmt(f.from)} A ${fmt(f.to)} · MAIS RECENTES PRIMEIRO`;
    }
    list.innerHTML = entries.length ? entries.map(entryHtml).join('') : `<div class="lancamentos-empty"><i class="bi bi-journal-x"></i><strong>NENHUM LANÇAMENTO ENCONTRADO</strong><span>AJUSTE OS FILTROS OU AGUARDE UM NOVO PAGAMENTO/VALE.</span></div>`;
  }

  function showError(error){
    const list = el('lancamentosLista');
    if (!list) return;
    list.innerHTML = `<div class="lancamentos-empty lancamentos-error"><i class="bi bi-shield-exclamation"></i><strong>NÃO FOI POSSÍVEL CARREGAR</strong><span>${escapeHtml(error?.message || 'Verifique a conexão e a permissão do usuário.')}</span></div>`;
    const info = el('lancamentosResultInfo');
    if (info) info.textContent = 'LANÇAMENTOS INDISPONÍVEIS';
  }

  async function load(force=false){
    const list = el('lancamentosLista');
    if (!list || state.loading) return;
    const profile = window.ValleCloud?.profile;
    if (!profile) return;
    if (!force && state.entries.length && Date.now() - state.loadedAt < 5000) { draw(); return; }
    state.loading = true;
    list.innerHTML = '<div class="lancamentos-loading"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> CARREGANDO LANÇAMENTOS...</div>';
    try {
      const logs = await window.ValleCloud.listAuditLogs(2000);
      state.entries = enrichPaymentBreakdown((logs || [])
        .filter(log => ACTIONS.has(String(log.action || '').toUpperCase()))
        .map(normalizeLog));
      state.loadedAt = Date.now();
      fillUsers();
      draw();
    } catch (error) {
      console.error('Erro ao carregar lançamentos:', error);
      showError(error);
    } finally {
      state.loading = false;
    }
  }

  function findEntry(id){
    return state.entries.find(item => String(item.id) === String(id));
  }

  function notify(message, type='info'){
    if (typeof window.toast === 'function') window.toast(message, type);
  }

  function openValeFromEntry(item){
    const access = actionAccess(item);
    if (!access.vale) { notify('ESTE VALE NÃO EXISTE MAIS NO HISTÓRICO'); return; }
    if (!access.canOpen) { notify('USUÁRIO SEM PERMISSÃO PARA ABRIR ESTE VALE'); return; }
    const id = access.vale.id;
    if (String(access.vale.status || '').toUpperCase() === 'PAGO' && typeof window.abrirValeHistorico === 'function') {
      window.abrirValeHistorico(id);
      return;
    }
    if (typeof window.openReceiveModal === 'function') {
      window.openReceiveModal(id);
      return;
    }
    notify('NÃO FOI POSSÍVEL ABRIR O VALE');
  }

  function editValeFromEntry(item){
    const access = actionAccess(item);
    if (!access.vale) { notify('ESTE VALE NÃO EXISTE MAIS NO HISTÓRICO'); return; }
    if (!access.canEdit) { notify('USUÁRIO SEM PERMISSÃO PARA EDITAR ESTE VALE'); return; }
    if (typeof window.editLoan === 'function') window.editLoan(access.vale.id, 'lancamentos');
    else notify('NÃO FOI POSSÍVEL EDITAR O VALE');
  }

  function bind(){
    if (state.bound) return;
    state.bound = true;
    applyDefaultPeriod();
    el('lancamentosLista')?.addEventListener('click', event => {
      const openButton = event.target.closest('[data-lancamento-open]');
      if (openButton && !openButton.disabled) {
        const item = findEntry(openButton.dataset.lancamentoOpen);
        if (item) openValeFromEntry(item);
        return;
      }
      const editButton = event.target.closest('[data-lancamento-edit]');
      if (editButton && !editButton.disabled) {
        const item = findEntry(editButton.dataset.lancamentoEdit);
        if (item) editValeFromEntry(item);
      }
    });
    ['lancamentosSearch'].forEach(id => el(id)?.addEventListener('input', draw));
    ['lancamentosTipo','lancamentosUsuario','lancamentosDataInicial','lancamentosDataFinal'].forEach(id => el(id)?.addEventListener('change', draw));
    el('lancamentosRefreshBtn')?.addEventListener('click', () => load(true));
    el('lancamentosLimparBtn')?.addEventListener('click', () => {
      if (el('lancamentosSearch')) el('lancamentosSearch').value = '';
      if (el('lancamentosTipo')) el('lancamentosTipo').value = 'todos';
      if (el('lancamentosUsuario')) el('lancamentosUsuario').value = '';
      applyDefaultPeriod(true);
      draw();
    });
    window.addEventListener('valle-audit-recorded', event => {
      const log = event.detail;
      if (!log || !ACTIONS.has(String(log.action || '').toUpperCase())) return;
      const normalized = normalizeLog(log);
      state.entries = enrichPaymentBreakdown([normalized, ...state.entries.filter(item => item.signature !== normalized.signature && item.id !== normalized.id)]);
      state.loadedAt = Date.now();
      fillUsers();
      if (document.querySelector('.screen.active')?.id === 'lancamentos') draw();
    });
  }

  window.renderLancamentos = function(force=false){ bind(); return load(force); };
  document.addEventListener('DOMContentLoaded', bind);
})();
