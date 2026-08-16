(function(){
  'use strict';
  const el=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dateTime=v=>{const d=new Date(v||Date.now());return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR')};
  const statusMeta={
    pending:{label:'AGUARDANDO CONFERÊNCIA',cls:'warning',icon:'bi-hourglass-split'},
    confirmed:{label:'CONFIRMADO',cls:'success',icon:'bi-check-circle-fill'},
    rejected:{label:'NÃO CONFIRMADO',cls:'danger',icon:'bi-x-circle-fill'}
  };
  let loading=false;
  let pendingReceiveRequest=null;
  let currentLancamentosSection='movimentacao';

  function setLancamentosSection(section='movimentacao'){
    currentLancamentosSection = section === 'pix' ? 'pix' : 'movimentacao';
    const movePanel=el('lancamentosMovimentacaoPanel');
    const pixPanel=el('lancamentosPixPanel');
    if(movePanel) movePanel.classList.toggle('hidden', currentLancamentosSection!=='movimentacao');
    if(pixPanel) pixPanel.classList.toggle('hidden', currentLancamentosSection!=='pix');
    document.querySelectorAll('[data-lancamentos-section]').forEach(btn=>{
      const active=String(btn.dataset.lancamentosSection||'')===currentLancamentosSection;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
  window.setLancamentosSection=setLancamentosSection;


  function beginReceiveRequest(req,vale){
    pendingReceiveRequest={requestId:String(req.id||''),valeId:String(vale.id||''),clientName:String(req.client_name||''),valeNumero:String(req.vale_numero||'')};
  }
  function clearReceiveRequest(){ pendingReceiveRequest=null; }
  async function completeReceiveRequest(valeId,method='',amount=0){
    const ctx=pendingReceiveRequest;
    if(!ctx||String(ctx.valeId)!==String(valeId||''))return false;
    pendingReceiveRequest=null;
    try{
      const detalhe=method?`Recebimento registrado no VALLE: ${method}${Number(amount)>0?` • ${money(amount)}`:''}.`:'Recebimento registrado no VALLE.';
      await ValleCloud.updateClientPaymentRequestStatus(ctx.requestId,'confirmed',detalhe);
      notify('PAGAMENTO PIX CONFIRMADO E RECEBIMENTO REGISTRADO','success');
      await load(true);
      return true;
    }catch(e){
      notify(e.message||'RECEBIMENTO SALVO, MAS O PEDIDO PIX NÃO FOI ATUALIZADO','error');
      return false;
    }
  }
  window.valleCompleteClientPaymentReceive=completeReceiveRequest;
  window.valleCancelClientPaymentReceive=clearReceiveRequest;

  function notify(msg,type='info'){
    if(typeof window.toast==='function') return window.toast(msg,type);
    const t=el('toast');if(!t)return;t.textContent=msg;t.className=`toast ${type} show`;setTimeout(()=>t.classList.remove('show'),3500);
  }
  function currentVale(req){
    const database=window.getValleDatabase?window.getValleDatabase():window.db;
    return database?.vales?.find(v=>String(v.id||'')===String(req.vale_id||''))||null;
  }
  function updateLancamentosPendingBadge(pending=0){
    const total=Math.max(0, Number(pending)||0);
    const label=total>99?'99+':String(total);
    document.querySelectorAll('[data-screen="lancamentos"],.tab[data-screen="lancamentos"]').forEach(btn=>{
      if(!btn) return;
      btn.classList.toggle('has-notify', total>0);
      let badge=btn.querySelector('.tab-notify-badge');
      if(total<=0){ if(badge) badge.remove(); }
      else {
        if(!badge){ badge=document.createElement('span'); badge.className='tab-notify-badge'; btn.appendChild(badge); }
        badge.textContent=label;
        badge.setAttribute('aria-label', `${total} pagamento${total===1?'':'s'} PIX pendente${total===1?'':'s'}`);
        badge.title=`${total} pagamento${total===1?'':'s'} PIX pendente${total===1?'':'s'}`;
      }
    });
    const sectionBtn=el('lancamentosPixSectionBtn');
    const sectionBadge=el('lancamentosPixSectionBadge');
    if(sectionBtn){ sectionBtn.classList.toggle('has-notify', total>0); }
    if(sectionBadge){
      if(total>0){ sectionBadge.textContent=label; sectionBadge.classList.remove('hidden'); }
      else { sectionBadge.classList.add('hidden'); }
    }
  }
  async function ask(message,opts){
    if(typeof window.appConfirm==='function')return window.appConfirm(message,opts);
    return window.confirm(message);
  }
  function draw(rows){
    const list=el('clientPaymentRequestsList');if(!list)return;
    const pending=rows.filter(r=>String(r.status||'pending')==='pending').length;
    const badge=el('clientPaymentRequestsPendingBadge');if(badge)badge.textContent=`${pending} PENDENTE${pending===1?'':'S'}`;
    updateLancamentosPendingBadge(pending);
    if(!rows.length){list.innerHTML='<div class="client-payment-request-empty"><i class="bi bi-check2-circle"></i><strong>NENHUM PAGAMENTO INFORMADO</strong><span>Os pedidos enviados pelos clientes aparecerão aqui.</span></div>';return}
    list.innerHTML=rows.map(r=>{
      const status=String(r.status||'pending').toLowerCase();const meta=statusMeta[status]||statusMeta.pending;const vale=currentVale(r);const valePaid=vale&&['PAGO','QUITADO'].includes(String(vale.status||'').toUpperCase());
      return `<article class="client-payment-request-item ${status}">
        <div class="client-payment-request-main">
          <div class="client-payment-request-ident"><span class="client-payment-request-icon"><i class="bi bi-qr-code-scan"></i></span><div><small>VALE #${esc(String(r.vale_numero||'').padStart(4,'0'))}${r.parcela_numero?` • PARCELA ${esc(r.parcela_numero)}/${esc(r.parcela_total||'?')}`:''}</small><h4>${esc(r.client_name||'CLIENTE')}</h4><p>${dateTime(r.created_at)}</p></div></div>
          <span class="badge text-bg-${meta.cls}"><i class="bi ${meta.icon}"></i> ${meta.label}</span>
        </div>
        <div class="client-payment-request-details">
          <div><span>VALOR INFORMADO</span><strong>${money(r.amount)}</strong></div>
          <div><span>VALE NO SISTEMA</span><strong>${vale?valePaid?'QUITADO':'EM ABERTO':'NÃO LOCALIZADO'}</strong></div>
          ${r.client_message?`<div class="wide"><span>OBSERVAÇÃO DO CLIENTE</span><strong>${esc(r.client_message)}</strong></div>`:''}
          ${r.review_note?`<div class="wide"><span>RETORNO</span><strong>${esc(r.review_note)}</strong></div>`:''}
        </div>
        ${status==='pending'?`<div class="client-payment-request-actions"><button type="button" class="btn btn-success btn-sm" data-pix-confirm="${esc(r.id)}"><i class="bi bi-check2-circle"></i><span>CONFIRMAR</span></button><button type="button" class="btn btn-outline-danger btn-sm" data-pix-reject="${esc(r.id)}"><i class="bi bi-x-circle"></i><span>RECUSAR</span></button></div>`:''}
      </article>`;
    }).join('');
    list.querySelectorAll('[data-pix-confirm]').forEach(btn=>btn.onclick=async()=>{
      const req=rows.find(r=>String(r.id)===String(btn.dataset.pixConfirm));if(!req)return;
      const vale=currentVale(req);
      if(!vale)return notify('VALE NÃO LOCALIZADO','error');
      const valePaid=['PAGO','QUITADO'].includes(String(vale.status||'').toUpperCase());
      if(valePaid){
        const ok=await ask('ESTE VALE JÁ ESTÁ QUITADO NO SISTEMA. DESEJA APENAS CONFIRMAR O PEDIDO PIX DO CLIENTE?',{title:'Confirmar pagamento informado?',icon:'✅',confirmText:'Confirmar',cancelText:'Cancelar'});if(!ok)return;
        btn.disabled=true;try{await ValleCloud.updateClientPaymentRequestStatus(req.id,'confirmed','Pagamento conferido. O vale já estava quitado no VALLE.');notify('PAGAMENTO INFORMADO CONFIRMADO','success');await load(true)}catch(e){notify(e.message||'ERRO AO CONFIRMAR','error')}finally{btn.disabled=false}
        return;
      }
      const ok=await ask('O PIX FOI CONFERIDO NO BANCO? AO CONTINUAR, O VALLE ABRIRÁ O RECEBIMENTO DESTE VALE/PARCELA. O PEDIDO SÓ SERÁ CONFIRMADO DEPOIS QUE O RECEBIMENTO FOR REGISTRADO.',{title:'Pagamento confirmado?',icon:'💳',confirmText:'Abrir recebimento',cancelText:'Cancelar'});if(!ok)return;
      beginReceiveRequest(req,vale);
      if(typeof window.openReceiveModal==='function')window.openReceiveModal(vale.id);else{clearReceiveRequest();notify('NÃO FOI POSSÍVEL ABRIR O RECEBIMENTO','error')}
    });
    list.querySelectorAll('[data-pix-reject]').forEach(btn=>btn.onclick=async()=>{
      const req=rows.find(r=>String(r.id)===String(btn.dataset.pixReject));if(!req)return;
      const ok=await ask('O CLIENTE VERÁ ESTE PEDIDO COMO NÃO CONFIRMADO E PODERÁ INFORMAR O PAGAMENTO NOVAMENTE.',{title:'Não confirmar pagamento?',icon:'⚠️',confirmText:'Recusar',cancelText:'Cancelar'});if(!ok)return;
      btn.disabled=true;try{await ValleCloud.updateClientPaymentRequestStatus(req.id,'rejected','Pagamento não localizado ou não confirmado.');notify('PEDIDO MARCADO COMO NÃO CONFIRMADO','success');await load(true)}catch(e){notify(e.message||'ERRO AO ATUALIZAR','error')}finally{btn.disabled=false}
    });
  }
  async function load(force=false){
    const card=el('clientPaymentRequestsCard');if(!card)return;
    const pixBtn=el('lancamentosPixSectionBtn');
    const p=window.ValleCloud?.profile;if(!p||p.role!=='service'){card.classList.add('hidden');el('lancamentosPixPanel')?.classList.add('hidden');if(pixBtn) pixBtn.classList.add('hidden');updateLancamentosPendingBadge(0);setLancamentosSection('movimentacao');return}
    card.classList.remove('hidden');if(pixBtn) pixBtn.classList.remove('hidden');if(loading&&!force)return;loading=true;
    const list=el('clientPaymentRequestsList');if(list&&force)list.innerHTML='<div class="client-payment-request-empty"><span class="spinner-border spinner-border-sm"></span> ATUALIZANDO...</div>';
    try{const rows=await ValleCloud.listClientPaymentRequests(80);draw(rows)}catch(e){updateLancamentosPendingBadge(0);if(list)list.innerHTML=`<div class="client-payment-request-empty danger"><i class="bi bi-exclamation-triangle"></i><strong>NÃO FOI POSSÍVEL CARREGAR</strong><span>${esc(e.message||'Erro')}</span></div>`}finally{loading=false}
  }
  function bind(){
    document.querySelectorAll('[data-lancamentos-section]').forEach(btn=>btn.addEventListener('click',()=>setLancamentosSection(btn.dataset.lancamentosSection||'movimentacao')));
    document.querySelectorAll('[data-screen="lancamentos"],.tab[data-screen="lancamentos"]').forEach(btn=>btn.addEventListener('click',()=>{ setLancamentosSection('movimentacao'); setTimeout(()=>load(false),120); }));
    setLancamentosSection('movimentacao');
    setTimeout(()=>load(false),900);
    setInterval(()=>{if(document.querySelector('.screen.active')?.id==='lancamentos')load(false)},30000);
  }
  window.renderClientPaymentRequests=load;
  document.addEventListener('DOMContentLoaded',bind);
})();
