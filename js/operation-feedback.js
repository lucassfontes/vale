(function(){
  'use strict';
  let state='hidden';
  let successText='Operação concluída com sucesso!';
  let hideTimer=null;
  let pendingCount=0;

  function ensure(){
    if(document.getElementById('valleOperationOverlay')) return;
    const style=document.createElement('style');
    style.id='valleOperationOverlayStyle';
    style.textContent=`
      html.valle-operation-locked,html.valle-operation-locked body{overflow:hidden!important}
      #valleOperationOverlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(10,14,22,.38);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);opacity:0;visibility:hidden;transition:opacity .18s ease,visibility .18s ease;touch-action:none}
      #valleOperationOverlay.is-visible{opacity:1;visibility:visible}
      #valleOperationOverlay .valle-operation-card{width:116px;height:116px;border-radius:25px;background:rgba(25,25,27,.94);box-shadow:0 18px 55px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;transform:scale(.96);transition:transform .18s ease}
      #valleOperationOverlay.is-visible .valle-operation-card{transform:scale(1)}
      #valleOperationOverlay .valle-operation-spinner{width:42px;height:42px;border-radius:50%;border:4px solid rgba(255,255,255,.2);border-top-color:#fff;animation:valleOperationSpin .72s linear infinite}
      #valleOperationOverlay .valle-operation-result{display:none;width:54px;height:54px;border-radius:50%;align-items:center;justify-content:center;font-size:35px;font-weight:800;line-height:1}
      #valleOperationOverlay.is-success .valle-operation-spinner,#valleOperationOverlay.is-error .valle-operation-spinner{display:none}
      #valleOperationOverlay.is-success .valle-operation-result,#valleOperationOverlay.is-error .valle-operation-result{display:flex;animation:valleOperationPop .22s ease-out}
      #valleOperationOverlay.is-success .valle-operation-result{background:#21c45a;color:#fff}
      #valleOperationOverlay.is-error .valle-operation-result{background:#ef4444;color:#fff}
      #valleOperationOverlay .valle-operation-message{position:absolute;top:calc(50% + 78px);left:50%;transform:translateX(-50%);max-width:min(88vw,360px);padding:9px 14px;border-radius:13px;background:rgba(25,25,27,.94);color:#fff;font:600 14px/1.3 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center;box-shadow:0 8px 26px rgba(0,0,0,.22);opacity:0;transition:opacity .16s ease;pointer-events:none}
      #valleOperationOverlay.is-success .valle-operation-message,#valleOperationOverlay.is-error .valle-operation-message{opacity:1}
      @keyframes valleOperationSpin{to{transform:rotate(360deg)}}
      @keyframes valleOperationPop{0%{transform:scale(.65);opacity:.2}100%{transform:scale(1);opacity:1}}
      @media (prefers-reduced-motion:reduce){#valleOperationOverlay,#valleOperationOverlay .valle-operation-card{transition:none}.valle-operation-spinner{animation-duration:1.4s!important}}
    `;
    document.head.appendChild(style);
    const overlay=document.createElement('div');
    overlay.id='valleOperationOverlay';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.setAttribute('aria-label','Processando operação');
    overlay.innerHTML='<div class="valle-operation-card"><div class="valle-operation-spinner" aria-hidden="true"></div><div class="valle-operation-result" aria-hidden="true"></div></div><div class="valle-operation-message"></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('pointerdown',e=>{if(state==='loading'){e.preventDefault();e.stopPropagation()}},true);
  }
  function resetVisual(){
    ensure(); clearTimeout(hideTimer);
    const o=document.getElementById('valleOperationOverlay');
    o.classList.remove('is-success','is-error');
    o.querySelector('.valle-operation-result').textContent='';
    o.querySelector('.valle-operation-message').textContent='';
  }
  function begin(){
    ensure();
    if(pendingCount===0){resetVisual();successText='Operação concluída com sucesso!';try{document.activeElement?.blur?.()}catch(_){}}
    pendingCount++;
    state='loading';
    const o=document.getElementById('valleOperationOverlay');
    o.classList.remove('is-success','is-error');
    o.classList.add('is-visible'); document.documentElement.classList.add('valle-operation-locked');
  }
  function setSuccessMessage(message){ if(message) successText=String(message).trim()||successText; if(state==='success'){const el=document.querySelector('#valleOperationOverlay .valle-operation-message');if(el)el.textContent=successText;} }
  function complete(message){
    ensure(); clearTimeout(hideTimer);
    pendingCount=Math.max(0,pendingCount-1);
    if(message)setSuccessMessage(message);
    if(pendingCount>0){
      state='loading';
      const o=document.getElementById('valleOperationOverlay');
      o.classList.add('is-visible');o.classList.remove('is-success','is-error');
      return;
    }
    // Pequena janela de união: se a mesma ação precisar de duas gravações
    // sequenciais (ex.: usuário + permissões), o spinner continua sem piscar.
    state='loading';
    const o=document.getElementById('valleOperationOverlay');
    o.classList.add('is-visible');o.classList.remove('is-success','is-error');
    hideTimer=setTimeout(()=>{
      if(pendingCount>0||state==='error')return;
      state='success';
      const text=String(successText||'Operação concluída com sucesso!');
      o.querySelector('.valle-operation-result').textContent='✓';
      o.querySelector('.valle-operation-message').textContent=text;
      o.classList.add('is-visible','is-success'); o.classList.remove('is-error');
      hideTimer=setTimeout(hide,1050);
    },70);
  }
  function fail(message){
    ensure(); clearTimeout(hideTimer); pendingCount=0; state='error';
    const o=document.getElementById('valleOperationOverlay');
    o.querySelector('.valle-operation-result').textContent='×';
    o.querySelector('.valle-operation-message').textContent=String(message||'Não foi possível confirmar a operação no banco de dados.');
    o.classList.add('is-visible','is-error'); o.classList.remove('is-success');
    hideTimer=setTimeout(hide,2200);
  }
  function hide(){
    ensure(); pendingCount=0; state='hidden';
    const o=document.getElementById('valleOperationOverlay');
    o.classList.remove('is-visible','is-success','is-error');
    document.documentElement.classList.remove('valle-operation-locked');
  }
  document.addEventListener('keydown',e=>{if(state==='loading'){e.preventDefault();e.stopPropagation()}},true);
  function isPending(){return state==='loading'}
  function isHandlingFeedback(){return state==='loading'||state==='success'||state==='error'}
  window.ValleOperationUI={begin,complete,fail,hide,setSuccessMessage,isPending,isHandlingFeedback,get state(){return state}};
})();
