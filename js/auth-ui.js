
(function(){
'use strict';
const PERMS = [
 ['can_view_dashboard','Dashboard'],['can_create_client','Criar cliente'],['can_edit_client','Editar cliente'],
 ['can_delete_client','Excluir cliente'],['can_create_vale','Criar VALLE'],['can_edit_vale','Editar VALLE'],
 ['can_delete_vale','Excluir VALLE'],['can_receive_payment','Receber pagamento'],['can_view_history','Ver histórico'],
 ['can_view_reports','Ver relatórios'],['can_view_transactions','Ver lançamentos'],['can_manage_backup','Backup'],
 ['can_view_session_data','Ver dados da sessão']
];

function htmlEscape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function el(id){return document.getElementById(id)}
function currentMonthPeriod(){
 const now=new Date();const first=new Date(now.getFullYear(),now.getMonth(),1);
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 return window.VallePeriod?.currentMonth?.()||{from:iso(first),to:iso(now)};
}
function applyAuditMonthPeriod(force=false){
 const range=currentMonthPeriod();const from=el('auditDateFrom'),to=el('auditDateTo');
 if(from&&(force||!from.value))from.value=range.from;
 if(to&&(force||!to.value))to.value=range.to;
 return range;
}

function setMsg(msg, error=true){const x=el('authMessage'); if(x){x.textContent=msg||'';x.classList.toggle('error',error)}}
function loginIsVisible(){const gate=el('authGate');return !!gate&&!gate.classList.contains('hidden')}
// O indicador Online/Offline foi removido da tela de login.
function updateSyncBadge(){const b=document.getElementById('valleSyncBadge');if(b)b.remove()}
function connectionToast(message,type='info'){if(typeof window.toast==='function'){window.toast(message,type);return}const t=el('toast');if(!t)return;t.textContent=message;t.className=`toast ${type} show`;t.style.display='block';clearTimeout(connectionToast.timer);connectionToast.timer=setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.style.display='none',300)},4000)}
function whatsappLink(phone){const p=String(phone||'').replace(/\D/g,'');return p?`https://wa.me/${p}`:'#';}
function roleLabel(role){
 const map={admin:'Administrador',session:'Usuário de sessão',service:'Usuário de serviço'};
 return map[String(role||'').toLowerCase()]||'Usuário';
}

function themePickerMarkup(scope,variant=''){
 const login=variant.includes('login');
 const trigger=`<button type="button" class="valle-theme-trigger" data-theme-trigger aria-haspopup="true" aria-expanded="false" aria-label="Choose theme"><i class="bi bi-moon-stars-fill" data-theme-current-icon aria-hidden="true"></i><span class="valle-theme-trigger-label" data-theme-current-label>Auto</span><i class="bi bi-chevron-down valle-theme-chevron" aria-hidden="true"></i></button>`;
 return `<div class="valle-theme-picker ${variant}" data-theme-picker="${scope}">${trigger}<div class="valle-theme-popover hidden" data-theme-popover role="radiogroup" aria-label="Select theme"><button type="button" class="valle-theme-option" data-theme-mode="light" role="radio" aria-checked="false"><i class="bi bi-sun-fill valle-theme-option-icon" aria-hidden="true"></i><span>Light</span><i class="bi bi-check-lg valle-theme-check" aria-hidden="true"></i></button><button type="button" class="valle-theme-option" data-theme-mode="dark" role="radio" aria-checked="false"><i class="bi bi-moon-stars-fill valle-theme-option-icon" aria-hidden="true"></i><span>Dark</span><i class="bi bi-check-lg valle-theme-check" aria-hidden="true"></i></button><button type="button" class="valle-theme-option" data-theme-mode="auto" role="radio" aria-checked="false"><i class="bi bi-circle-half valle-theme-option-icon" aria-hidden="true"></i><span>Auto</span><i class="bi bi-check-lg valle-theme-check" aria-hidden="true"></i></button></div></div>`;
}
function ensureRoleBadge(info,role){
 if(!info)return;
 let badge=info.querySelector('.user-role-badge');
 if(!badge){badge=document.createElement('span');badge.className='user-role-badge';info.appendChild(badge)}
 badge.textContent=roleLabel(role);
}

function inject(){
 document.documentElement.classList.add('valle-auth-active');
 document.body.classList.add('valle-auth-active');
 const loadingScreen=document.getElementById('valleLoadingScreen');
 const mountTarget=loadingScreen||document.body;
 mountTarget.insertAdjacentHTML(loadingScreen?'afterend':'afterbegin', `
 <section id="authGate" class="auth-gate">
  <div class="auth-card">
   <img src="icons/icon-valle.png" alt="VALLE" class="auth-logo">
   <h1>VALLE</h1><p>Entre para acessar sua conta</p>
   <form id="loginForm"><label>E-mail<input id="loginEmail" type="email" required autocomplete="username"></label>
   <label>Senha<input id="loginPassword" type="password" required autocomplete="current-password"></label>
   <button class="btn primary" type="submit">Entrar</button></form>
   <div id="authMessage" class="auth-message"></div>
   <a id="authWhatsapp" class="auth-whatsapp hidden" target="_blank" rel="noopener">FALAR COM O ADMINISTRADOR</a>
   <small class="auth-setup ${ValleCloud.configured?'hidden':''}">Configure o Supabase em <b>js/supabase-config.js</b>.</small>
  </div>
  
  ${themePickerMarkup('auth','valle-theme-picker--login')}
 </section>
 <section id="managementPanel" class="management-panel hidden">
   <header class="management-top"><div><img src="icons/icon-valle.png"><div><h1>VALLE</h1><p id="managementSubtitle"></p></div></div><div class="management-top-actions"><div class="management-user-menu"><button type="button" class="management-user-trigger" id="managementUserTrigger" aria-expanded="false"><span class="management-trigger-avatar">U</span><span class="management-trigger-copy"><strong id="managementUserName">Usuário</strong><small id="managementUserPanelLabel">Painel</small></span><span class="dashboard-user-chevron" aria-hidden="true">⌄</span></button><div class="management-user-dropdown hidden" id="managementUserDropdown"><div class="dashboard-user-info"><strong id="managementUserDropdownName">Usuário</strong><small id="managementUserDropdownEmail"></small></div>${themePickerMarkup('management','valle-theme-picker--embedded')}<button type="button" id="logoutBtn" class="user-logout-menu-btn">↪ Sair</button></div></div></div></header>
   <main class="management-content"><section id="usersPanel" class="management-card"><div class="management-head"><div><h2 id="managementTitle">Usuários</h2><p id="managementHelp"></p></div><div class="management-head-actions"><button id="adminMessageBtn" class="btn admin-message-btn hidden" type="button"><i class="bi bi-megaphone-fill"></i> MSG ADM</button><button id="newManagedUserBtn" class="btn primary">NOVO USUÁRIO</button></div></div><div id="managedUsers"></div></section><section id="auditPanel" class="management-card hidden"><div class="management-head"><div><h2>Auditoria dos usuários de serviço</h2><p>Histórico permanente de criações, edições, exclusões, pagamentos e quitações.</p></div><span class="badge text-bg-success"><i class="bi bi-broadcast-pin"></i> TEMPO REAL</span></div><div class="audit-filters"><div class="audit-search"><i class="bi bi-search"></i><input id="auditSearch" type="search" placeholder="Buscar usuário, cliente, vale ou ação..."></div><select id="auditUserFilter"><option value="">Todos os usuários</option></select><select id="auditModuleFilter"><option value="">Todos os módulos</option><option>CLIENTES</option><option>VALES</option><option>PAGAMENTOS</option><option>USUARIOS</option><option>SISTEMA</option></select><select id="auditActionFilter"><option value="">Todas as ações</option></select><input id="auditDateFrom" type="date" title="Data inicial"><input id="auditDateTo" type="date" title="Data final"><button id="clearAuditFilters" class="btn audit-clear-btn" type="button"><i class="bi bi-eraser"></i><span>LIMPAR</span></button></div><div id="auditSummary" class="audit-summary"></div><div id="auditLogs"></div><div class="text-center mt-3"><button id="loadMoreAudit" class="btn btn-outline-primary hidden">CARREGAR MAIS</button></div></section></main>
 </section>
 <div id="userModal" class="user-modal hidden" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
   <div class="user-modal-card">
     <header class="user-modal-header">
       <span class="user-modal-header-icon" aria-hidden="true"><i class="bi bi-person-plus-fill"></i></span>
       <div class="user-modal-header-copy">
         <h2 id="userModalTitle">Novo usuário</h2>
         <p id="userModalSubtitle">Cadastre os dados e defina as permissões de acesso.</p>
       </div>
       <button type="button" class="modal-x" id="closeUserModal" aria-label="Fechar">×</button>
     </header>
     <form id="userForm" class="user-modal-body user-modal-layout">
       <div class="user-modal-scroll">
       <input id="managedId" type="hidden">
       <label>Nome<input id="managedName" required autocomplete="name"></label>
       <label>E-mail<input id="managedEmail" type="email" required autocomplete="email"></label>
       <label id="managedPasswordLabel">Senha inicial<input id="managedPassword" type="password" minlength="6" autocomplete="new-password"></label>
       <label id="managedValidityWrap">Validade da sessão<input id="managedValidity" type="date"></label>
       <label id="managedWhatsappWrap" hidden>WhatsApp do administrador<input id="managedWhatsapp" inputmode="tel" placeholder="Ex: 5594999999999" autocomplete="tel"></label>
       <fieldset id="serviceFinancialBox" class="service-financial-box">
         <legend><i class="bi bi-percent"></i> Configuração financeira individual</legend>
         <label for="managedInterestPercent" class="financial-field">
           <span>Juros configurável (%)</span>
           <input id="managedInterestPercent" type="number" inputmode="decimal" min="0" step="0.01" value="30" placeholder="Ex: 30">
         </label>
         <small>Este percentual será usado somente por este usuário de serviço.</small>
       </fieldset>
       <fieldset id="permissionsBox" class="permissions-box">
         <legend><i class="bi bi-shield-check"></i> Permissões do usuário de serviço</legend>
         ${PERMS.map(([k,n])=>`<label><input type="checkbox" data-perm="${k}" checked><span>${n}</span></label>`).join('')}
       </fieldset>
       </div>
       <div class="modal-actions">
         <button type="button" id="cancelUserModal" class="btn light"><i class="bi bi-x-circle"></i><span>CANCELAR</span></button>
         <button class="btn primary" type="submit"><i class="bi bi-check-circle"></i><span>SALVAR</span></button>
       </div>
     </form>
   </div>
 </div>
 <div id="adminMessageModal" class="admin-message-modal hidden" role="dialog" aria-modal="true" aria-labelledby="adminMessageModalTitle">
   <div class="admin-message-backdrop" data-admin-message-close></div>
   <div class="admin-message-card admin-message-compose-card">
     <header class="admin-message-confirm-header">
       <span class="admin-message-confirm-icon" aria-hidden="true"><i class="bi bi-megaphone-fill"></i></span>
       <div class="admin-message-confirm-titles"><h2 id="adminMessageModalTitle">MSG ADM</h2><p>Envie uma atualização para todas ou apenas uma sessão.</p></div>
       <button type="button" class="admin-message-x" data-admin-message-close aria-label="Fechar">×</button>
     </header>
     <div class="admin-message-confirm-body">
       <form id="adminMessageForm">
         <label for="adminMessageSession">SESSÃO DESTINATÁRIA
           <div class="admin-message-input-group"><span><i class="bi bi-people-fill"></i></span><select id="adminMessageSession"><option value="">TODAS AS SESSÕES</option></select></div>
         </label>
         <label for="adminMessageTitle">TÍTULO
           <div class="admin-message-input-group"><span><i class="bi bi-type"></i></span><input id="adminMessageTitle" maxlength="80" value="ATUALIZAÇÃO DO SISTEMA" required></div>
         </label>
         <label for="adminMessageText">MENSAGEM<textarea id="adminMessageText" maxlength="1500" rows="5" placeholder="DIGITE A MENSAGEM DA ATUALIZAÇÃO..." required></textarea></label>
         <div id="adminMessageStatus" class="admin-message-status"></div>
         <div class="admin-message-actions"><button type="button" class="btn light" data-admin-message-close>CANCELAR</button><button type="submit" class="btn primary"><i class="bi bi-send-fill"></i> ENVIAR MENSAGEM</button></div>
       </form>
       <div class="admin-message-history-wrap"><div class="admin-message-history-title"><i class="bi bi-clock-history"></i> MENSAGENS RECENTES</div><div id="adminMessageHistory" class="admin-message-history"></div></div>
     </div>
   </div>
 </div>
 <div id="systemUpdateMessageModal" class="admin-message-modal hidden" role="dialog" aria-modal="true" aria-labelledby="systemUpdateMessageTitle">
   <div class="admin-message-backdrop"></div>
   <div class="admin-message-card system-update-message-card">
     <header class="admin-message-confirm-header system-update-message-header">
       <span class="admin-message-confirm-icon" aria-hidden="true"><i class="bi bi-megaphone-fill"></i></span>
       <div class="admin-message-confirm-titles"><h2 id="systemUpdateMessageTitle">ATUALIZAÇÃO DO SISTEMA</h2></div>
       <button type="button" class="admin-message-x" id="systemUpdateMessageClose" aria-label="Fechar">×</button>
     </header>
     <div class="system-update-message-meta" aria-label="Data da mensagem">
       <small class="system-update-message-date"><i class="bi bi-calendar3" aria-hidden="true"></i><span id="systemUpdateMessageDate"></span></small>
     </div>
     <div class="admin-message-confirm-body system-update-message-body">
       <div id="systemUpdateMessageText" class="system-update-message-text form-text mt-2"></div>
     </div>
     <footer class="system-update-message-footer">
       <strong class="system-update-message-author">Ass: Administrador</strong>
     </footer>
   </div>
 </div>`);
 const userModalNode=el('userModal');
 if(userModalNode&&userModalNode.parentElement!==document.body)document.body.appendChild(userModalNode);
 // v3.6.98: os modais de MSG ADM ficam diretamente no body para garantir
 // que nenhuma camada da interface possa ficar acima deles ou receber foco/clique.
 ['adminMessageModal','systemUpdateMessageModal'].forEach(id=>{
  const node=el(id);
  if(node&&node.parentElement!==document.body)document.body.appendChild(node);
 });
 syncUserModalViewport();
 if(!window.__valleUserModalViewportBound){
  window.__valleUserModalViewportBound=true;
  const refresh=()=>syncUserModalViewport();
  window.addEventListener('resize',refresh,{passive:true});
  window.addEventListener('orientationchange',refresh,{passive:true});
  window.visualViewport?.addEventListener('resize',refresh,{passive:true});
 }
}

function syncUserModalViewport(){
 const modal=el('userModal');if(!modal)return;
 const viewportHeight=Math.max(320,Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||720));
 modal.style.setProperty('--user-modal-viewport-height',`${viewportHeight}px`);
}


const THEME_MODES=['auto','light','dark'];
const THEME_STORAGE_KEY='valle_theme_mode';
const systemThemeMedia=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
function normalizeThemeMode(theme){return THEME_MODES.includes(theme)?theme:'auto'}
function resolveThemeMode(theme){const mode=normalizeThemeMode(theme);return mode==='auto'?(systemThemeMedia?.matches?'dark':'light'):mode}
function themeStorageKey(profile){ return THEME_STORAGE_KEY; }
function readStoredTheme(profile){
 try{
  const value=localStorage.getItem(themeStorageKey(profile));
  return THEME_MODES.includes(value)?value:null;
 }catch(_){return null}
}
function writeStoredTheme(theme,profile=null){
 const mode=normalizeThemeMode(theme);
 try{localStorage.setItem(themeStorageKey(profile),mode)}catch(_){}
 return mode;
}
function themeModeLabel(mode){return mode==='light'?'LIGHT':(mode==='dark'?'DARK':'AUTO')}
function themeModeIcon(mode,resolvedTheme){return mode==='light'?'bi bi-sun-fill':(mode==='dark'?'bi bi-moon-stars-fill':'bi bi-circle-half')}
function updateThemeButtons(themeMode,resolvedTheme=resolveThemeMode(themeMode)){
 const mode=normalizeThemeMode(themeMode);
 document.querySelectorAll('[data-theme-picker]').forEach(picker=>{
  picker.dataset.themeMode=mode;
  picker.querySelectorAll('[data-theme-mode]').forEach(option=>{
   const selected=option.dataset.themeMode===mode;
   option.classList.toggle('is-selected',selected);
   option.setAttribute('aria-checked',String(selected));
  });
  const icon=picker.querySelector('[data-theme-current-icon]');
  if(icon)icon.className=themeModeIcon(mode,resolvedTheme);
  const label=picker.querySelector('[data-theme-current-label]');
  if(label)label.textContent=themeModeLabel(mode);
 });
 document.documentElement.dataset.valleThemeMode=mode;
}
function closeThemePickers(except=null){
 document.querySelectorAll('[data-theme-picker]').forEach(picker=>{
  if(picker===except)return;
  picker.querySelector('[data-theme-popover]')?.classList.add('hidden');
  picker.querySelector('[data-theme-trigger]')?.setAttribute('aria-expanded','false');
 });
}
function bindThemePicker(picker,onSelect){
 if(!picker||picker.dataset.bound==='1')return;
 picker.dataset.bound='1';
 const trigger=picker.querySelector('[data-theme-trigger]');
 const popover=picker.querySelector('[data-theme-popover]');
 if(trigger){
  trigger.addEventListener('click',ev=>{
   ev.stopPropagation();
   const opening=popover?.classList.contains('hidden');
   closeThemePickers(picker);
   popover?.classList.toggle('hidden',!opening);
   trigger.setAttribute('aria-expanded',String(opening));
  });
 }
 picker.querySelectorAll('[data-theme-mode]').forEach(option=>{
  option.addEventListener('click',async ev=>{
   ev.preventDefault();ev.stopPropagation();
   const mode=normalizeThemeMode(option.dataset.themeMode);
   await onSelect(mode);
   if(trigger){popover?.classList.add('hidden');trigger.setAttribute('aria-expanded','false')}
  });
 });
}
function applyResolvedTheme(resolvedTheme){
 const value=resolvedTheme==='dark'?'dark':'light';
 window.VALLE_ACTIVE_THEME=value;
 window.VALLE_PENDING_THEME=value;
 updateThemeButtons(window.VALLE_THEME_MODE||'auto',value);

 // Enquanto o loading está aberto, não altere body/html/theme-color.
 // Isso evita a troca de cor na área inferior do iPhone.
 if(document.documentElement.classList.contains('valle-loading-active')) return value;

 window.VALLE_PENDING_THEME=null;
 document.body.classList.toggle('dark',value==='dark');
 document.documentElement.classList.toggle('dark',value==='dark');
 document.documentElement.setAttribute('data-bs-theme',value);
 document.documentElement.style.colorScheme=value;
 const themeMeta=document.querySelector('meta[name="theme-color"]');
 if(themeMeta)themeMeta.setAttribute('content',value==='dark'?'#070b18':'#f4f2ff');
 if(window.applyTheme) window.applyTheme();
 return value;
}
function applyUserTheme(theme,profile=null){
 const mode=normalizeThemeMode(theme);
 const resolved=resolveThemeMode(mode);
 window.VALLE_THEME_MODE=mode;
 applyResolvedTheme(resolved);
 return mode;
}
async function persistUserTheme(theme){
 const profile=ValleCloud.profile;
 const mode=applyUserTheme(theme,profile);
 // O tema é uma das duas únicas preferências persistidas neste aparelho.
 writeStoredTheme(mode,profile);
 // Mantém a sincronização remota quando houver perfil/conexão, sem depender dela
 // para lembrar o tema localmente.
 if(profile && navigator.onLine!==false){
  try{await ValleCloud.setMyTheme(mode)}catch(err){console.warn('Tema salvo no aparelho; não foi possível sincronizar com o perfil agora.',err)}
 }
 return mode;
}
async function toggleUserTheme(){
 const current=normalizeThemeMode(window.VALLE_THEME_MODE);
 const next=current==='auto'?'light':(current==='light'?'dark':'auto');
 return persistUserTheme(next);
}
async function activateProfileTheme(profile){
 const localTheme=readStoredTheme(profile);
 const profileTheme=THEME_MODES.includes(profile?.user_theme)?profile.user_theme:'auto';
 const theme=localTheme||profileTheme;
 writeStoredTheme(theme,profile);
 return applyUserTheme(theme,profile);
}
function handleSystemThemeChange(){
 if(normalizeThemeMode(window.VALLE_THEME_MODE)==='auto') applyResolvedTheme(resolveThemeMode('auto'));
}
if(systemThemeMedia){
 if(typeof systemThemeMedia.addEventListener==='function')systemThemeMedia.addEventListener('change',handleSystemThemeChange);
 else if(typeof systemThemeMedia.addListener==='function')systemThemeMedia.addListener(handleSystemThemeChange);
}
window.ValleUserTheme={apply:applyUserTheme,set:persistUserTheme,toggle:toggleUserTheme,activate:activateProfileTheme,resolve:resolveThemeMode,get mode(){return normalizeThemeMode(window.VALLE_THEME_MODE)}};
 document.addEventListener('click',()=>closeThemePickers());
 document.addEventListener('click',e=>{if(e.target?.id==='refreshAuditBtn')renderAuditLogs()});
 document.addEventListener('input',e=>{if(['auditSearch','auditUserFilter','auditModuleFilter','auditActionFilter','auditDateFrom','auditDateTo'].includes(e.target?.id)){auditPageSize=50;drawAuditLogs()}});
 document.addEventListener('change',e=>{if(['auditUserFilter','auditModuleFilter','auditActionFilter','auditDateFrom','auditDateTo'].includes(e.target?.id)){auditPageSize=50;drawAuditLogs()}});
 document.addEventListener('click',e=>{if(e.target?.id==='clearAuditFilters'){['auditSearch','auditUserFilter','auditModuleFilter','auditActionFilter'].forEach(id=>{if(el(id))el(id).value=''});applyAuditMonthPeriod(true);auditPageSize=50;drawAuditLogs()}if(e.target?.id==='loadMoreAudit'){auditPageSize+=50;drawAuditLogs()}});

function setupDashboardUserMenu(profile){
 const name=String(profile?.name||profile?.email||'Usuário').trim();
 const email=String(profile?.email||'').trim();
 const nameEl=el('dashboardUserName');
 const dropName=el('dashboardUserDropdownName');
 const dropEmail=el('dashboardUserDropdownEmail');
 if(nameEl) nameEl.textContent=name;
 if(dropName) dropName.textContent=name;
 if(dropEmail) dropEmail.textContent=email;
 const info=dropName?.closest('.dashboard-user-info');
 if(info){info.dataset.initial=(name.charAt(0)||'U').toUpperCase();info.querySelector('.user-role-badge')?.remove()}
 const trigger=el('dashboardUserTrigger');
 const mobile=el('dashboardUserMobile');
 const initial=(name.charAt(0)||'U').toUpperCase();
 if(trigger){const avatar=trigger.querySelector('.management-trigger-avatar');if(avatar)avatar.textContent=initial}
 if(mobile)mobile.textContent=initial;
 const dropdown=el('dashboardUserDropdown');
 const logout=el('dashboardLogoutBtn');
 let themePicker=document.querySelector('[data-theme-picker="dashboard"]');
 const oldThemeBtn=el('dashboardThemeBtn');
 if(!themePicker && oldThemeBtn){oldThemeBtn.insertAdjacentHTML('beforebegin', themePickerMarkup('dashboard','valle-theme-picker--embedded')); oldThemeBtn.remove(); themePicker=document.querySelector('[data-theme-picker="dashboard"]');}
 const pushNoticesBtn=el('dashboardPushNoticesBtn');
 // Mantém o menu fora do cabeçalho/section para evitar deslocamento por overflow,
 // transformações e grids responsivos do Dashboard.
 if(dropdown && dropdown.parentElement!==document.body) document.body.appendChild(dropdown);
 const positionDashboardMenu=source=>{
   if(!dropdown||!source) return;
   const rect=source.getBoundingClientRect?.();
   if(!rect) return;
   const menuWidth=Math.min(224,window.innerWidth-24);
   const menuHeight=dropdown.offsetHeight||224;
   const left=Math.max(12,Math.min(window.innerWidth-menuWidth-12,rect.right-menuWidth));
   const isMobile=window.innerWidth<760;
   const roomBelow=window.innerHeight-rect.bottom-12;
   // No celular, o card do menu deve abrir sempre logo abaixo do botão.
   // No desktop, mantém o ajuste automático quando não houver espaço abaixo.
   const top=isMobile ? rect.bottom+8 : (roomBelow>=menuHeight ? rect.bottom+8 : Math.max(12,rect.top-menuHeight-8));
   dropdown.style.setProperty('max-height',isMobile ? Math.max(140,window.innerHeight-top-12)+'px' : 'none','important');
   dropdown.style.setProperty('overflow-y',isMobile ? 'auto' : 'visible','important');
   dropdown.style.setProperty('position','fixed','important');
   dropdown.style.setProperty('left',left+'px','important');
   dropdown.style.setProperty('right','auto','important');
   dropdown.style.setProperty('top',top+'px','important');
   dropdown.style.setProperty('bottom','auto','important');
   dropdown.style.setProperty('transform','none','important');
   dropdown.style.setProperty('z-index','2147483000','important');
 };
 const toggle=ev=>{
   ev?.stopPropagation();
   if(!dropdown) return;
   const opening=dropdown.classList.contains('hidden');
   dropdown.classList.toggle('hidden',!opening);
   trigger?.setAttribute('aria-expanded',String(opening));
   mobile?.setAttribute('aria-expanded',String(opening));
   if(opening){
     const source=ev?.currentTarget || (window.innerWidth<760?mobile:trigger) || trigger || mobile;
     requestAnimationFrame(()=>positionDashboardMenu(source));
   }
 };
 if(trigger && !trigger.dataset.bound){trigger.dataset.bound='1';trigger.addEventListener('click',toggle)}
 if(mobile && !mobile.dataset.bound){mobile.dataset.bound='1';mobile.addEventListener('click',toggle)}
 if(!document.documentElement.dataset.dashboardMenuViewportBound){
   document.documentElement.dataset.dashboardMenuViewportBound='1';
   const refresh=()=>{
     if(!dropdown||dropdown.classList.contains('hidden')) return;
     const source=window.innerWidth<760?(mobile||trigger):(trigger||mobile);
     positionDashboardMenu(source);
   };
   window.addEventListener('resize',refresh,{passive:true});
   window.addEventListener('orientationchange',refresh,{passive:true});
   window.addEventListener('scroll',refresh,{passive:true,capture:true});
 }
 if(pushNoticesBtn && !pushNoticesBtn.dataset.bound){
   pushNoticesBtn.dataset.bound='1';
   pushNoticesBtn.addEventListener('click',ev=>{
     ev.stopPropagation();
     dropdown?.classList.add('hidden');
     trigger?.setAttribute('aria-expanded','false');
     mobile?.setAttribute('aria-expanded','false');
     const modalEl=el('avisosCelularModal');
     if(modalEl && window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(modalEl).show();
   });
 }
 bindThemePicker(themePicker,persistUserTheme);
 if(logout && !logout.dataset.bound){logout.dataset.bound='1';logout.addEventListener('click',async()=>{await ValleCloud.signOut();location.reload()})}
 updateThemeButtons(window.VALLE_THEME_MODE||'auto',window.VALLE_ACTIVE_THEME||resolveThemeMode('auto'));
 if(!document.documentElement.dataset.userMenuBound){
   document.documentElement.dataset.userMenuBound='1';
   document.addEventListener('click',ev=>{
     if(dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(ev.target) && !ev.target.closest('.dashboard-user-menu') && !ev.target.closest('#dashboardUserMobile')){
       dropdown.classList.add('hidden');
       trigger?.setAttribute('aria-expanded','false');
       mobile?.setAttribute('aria-expanded','false');
     }
   });
 }
}



function setupManagementUserMenu(profile){
 const name=String(profile?.name||profile?.email||'Usuário').trim();
 const email=String(profile?.email||'').trim();
 ['managementUserName','managementUserDropdownName'].forEach(id=>{const x=el(id);if(x)x.textContent=name});
 const emailEl=el('managementUserDropdownEmail');if(emailEl)emailEl.textContent=email;
 const panelLabel=el('managementUserPanelLabel');
 if(panelLabel)panelLabel.textContent=profile?.role==='admin'?'Painel administrativo':'Painel de sessão';
 const info=el('managementUserDropdownName')?.closest('.dashboard-user-info');
 if(info){info.dataset.initial=(name.charAt(0)||'U').toUpperCase();info.querySelector('.user-role-badge')?.remove()}
 const trigger=el('managementUserTrigger');
 const initial=(name.charAt(0)||'U').toUpperCase();
 if(trigger){const avatar=trigger.querySelector('span:first-child');if(avatar)avatar.textContent=initial}
 const dropdown=el('managementUserDropdown');
 const themePicker=document.querySelector('[data-theme-picker="management"]');
 const logout=el('logoutBtn');
 // Mantém o menu fora dos cards para que sempre abra por cima do conteúdo.
 if(dropdown && dropdown.parentElement!==document.body) document.body.appendChild(dropdown);
 const positionDropdown=()=>{
  if(!dropdown||!trigger)return;
  const rect=trigger.getBoundingClientRect();
  const mobile=window.matchMedia('(max-width:720px)').matches;
  const menuWidth=Math.min(mobile?216:Math.max(280,rect.width),window.innerWidth-24);
  // No celular, usa um card compacto e alinha a borda direita exatamente com o botão.
  // O mesmo posicionamento é aplicado aos painéis Administrador e Sessão.
  const preferredLeft=rect.right-menuWidth;
  const left=Math.max(12,Math.min(window.innerWidth-menuWidth-12,preferredLeft));
  const top=rect.bottom+(mobile?8:10);
  dropdown.style.setProperty('position','fixed','important');
  dropdown.style.setProperty('width',menuWidth+'px','important');
  dropdown.style.setProperty('max-width','calc(100vw - 24px)','important');
  dropdown.style.setProperty('left',left+'px','important');
  dropdown.style.setProperty('right','auto','important');
  dropdown.style.setProperty('top',top+'px','important');
  dropdown.style.setProperty('bottom','auto','important');
  dropdown.style.setProperty('transform','none','important');
  dropdown.style.setProperty('z-index','2147483000','important');
};
 const toggle=ev=>{ev?.stopPropagation();if(!dropdown)return;const opening=dropdown.classList.contains('hidden');dropdown.classList.toggle('hidden',!opening);trigger?.setAttribute('aria-expanded',String(opening));if(opening)positionDropdown();};
 if(trigger&&!trigger.dataset.bound){trigger.dataset.bound='1';trigger.addEventListener('click',toggle)}
 bindThemePicker(themePicker,persistUserTheme);
 if(logout&&!logout.dataset.bound){logout.dataset.bound='1';logout.addEventListener('click',async()=>{await ValleCloud.signOut();location.reload()})}
 updateThemeButtons(window.VALLE_THEME_MODE||'auto',window.VALLE_ACTIVE_THEME||resolveThemeMode('auto'));
 if(!document.documentElement.dataset.managementMenuBound){
  document.documentElement.dataset.managementMenuBound='1';
  document.addEventListener('click',ev=>{if(dropdown&&!dropdown.classList.contains('hidden')&&!trigger?.contains(ev.target)&&!dropdown.contains(ev.target)){dropdown.classList.add('hidden');trigger?.setAttribute('aria-expanded','false')}});window.addEventListener('resize',()=>{if(dropdown&&!dropdown.classList.contains('hidden'))positionDropdown()});window.addEventListener('scroll',()=>{if(dropdown&&!dropdown.classList.contains('hidden'))positionDropdown()},{passive:true});
 }
}

function setupSessionPanelTabs(){
 if(ValleCloud.profile?.role!=='session')return;
 const content=document.querySelector('.management-content');
 const usersPanel=el('usersPanel');
 const auditPanel=el('auditPanel');
 const settingsSection=el('configuracoes');
 const configCard=settingsSection?.querySelector('.config-card');
 const backupCard=settingsSection?.querySelector('.backup-card');
 if(!content||!usersPanel||!auditPanel||!settingsSection||!configCard||!backupCard)return;

 settingsSection.style.setProperty('display','contents','important');
 configCard.id='sessionConfigPanel';
 backupCard.id='sessionBackupPanel';

 const panels={users:usersPanel,audit:auditPanel,config:configCard,backup:backupCard};
 Object.entries(panels).forEach(([name,panel])=>{
  panel.classList.add('session-panel-tab-card');
  panel.dataset.sessionPanel=name;
 });

 let nav=content.querySelector('.session-panel-tabs');
 if(!nav){
  nav=document.createElement('nav');
  nav.className='session-panel-tabs';
  nav.setAttribute('role','tablist');
  nav.setAttribute('aria-label','Áreas do painel de sessão');
  nav.innerHTML=`
   <button type="button" class="session-panel-tab" data-session-panel-tab="users" role="tab" aria-label="Usuários" title="Usuários"><i class="bi bi-people-fill" aria-hidden="true"></i><span>USUÁRIOS</span></button>
   <button type="button" class="session-panel-tab" data-session-panel-tab="audit" role="tab" aria-label="Auditoria" title="Auditoria"><i class="bi bi-clock-history" aria-hidden="true"></i><span>AUDITORIA</span></button>
   <button type="button" class="session-panel-tab" data-session-panel-tab="config" role="tab" aria-label="Configuração" title="Configuração"><i class="bi bi-gear-fill" aria-hidden="true"></i><span>CONFIGURAÇÃO</span></button>
   <button type="button" class="session-panel-tab" data-session-panel-tab="backup" role="tab" aria-label="Backup" title="Backup"><i class="bi bi-cloud-arrow-down-fill" aria-hidden="true"></i><span>BACKUP</span></button>`;
  content.insertBefore(nav,content.firstChild);
 }

 const centerSessionTab=(button,smooth=true)=>{
  if(!button || window.matchMedia('(min-width: 761px)').matches)return;
  const targetLeft=button.offsetLeft-(nav.clientWidth-button.offsetWidth)/2;
  const maxLeft=Math.max(0,nav.scrollWidth-nav.clientWidth);
  const left=Math.max(0,Math.min(maxLeft,targetLeft));
  try{nav.scrollTo({left,behavior:smooth?'smooth':'auto'});}catch(_){nav.scrollLeft=left;}
 };

 const activate=(name,{center=true,smooth=true}={})=>{
  const next=panels[name]?name:'users';
  window.__valleSessionPanelTab=next;
  let activeButton=null;
  Object.entries(panels).forEach(([key,panel])=>{
   const active=key===next;
   panel.classList.toggle('session-panel-tab-card-active',active);
   panel.setAttribute('aria-hidden',active?'false':'true');
  });
  nav.querySelectorAll('[data-session-panel-tab]').forEach(button=>{
   const active=button.dataset.sessionPanelTab===next;
   button.classList.toggle('active',active);
   button.setAttribute('aria-selected',active?'true':'false');
   button.tabIndex=active?0:-1;
   if(active)activeButton=button;
  });
  if(center && activeButton) requestAnimationFrame(()=>centerSessionTab(activeButton,smooth));
  if(next==='audit' && !(window.__valleAuditLogs||[]).length) renderAuditLogs();
 };

 const buttons=[...nav.querySelectorAll('[data-session-panel-tab]')];
 buttons.forEach((button,index)=>{
  button.onclick=()=>activate(button.dataset.sessionPanelTab,{center:true,smooth:true});
  button.onkeydown=event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   let next=index;
   if(event.key==='ArrowLeft')next=(index-1+buttons.length)%buttons.length;
   if(event.key==='ArrowRight')next=(index+1)%buttons.length;
   if(event.key==='Home')next=0;
   if(event.key==='End')next=buttons.length-1;
   const target=buttons[next];
   activate(target.dataset.sessionPanelTab,{center:true,smooth:true});
   target.focus({preventScroll:true});
  };
 });

 const recenterActiveTab=()=>{
  const active=nav.querySelector('[data-session-panel-tab].active,[data-session-panel-tab][aria-selected="true"]');
  if(active) requestAnimationFrame(()=>centerSessionTab(active,false));
 };
 window.addEventListener('resize',recenterActiveTab,{passive:true});
 window.addEventListener('orientationchange',()=>setTimeout(recenterActiveTab,120));

 activate(window.__valleSessionPanelTab||'users',{center:true,smooth:false});
}
function mountSessionSettings(){
 const section=el('configuracoes');
 const content=document.querySelector('.management-content');
 if(!section||!content)return;
 section.classList.add('session-settings-panel','active');
 content.appendChild(section);
 const title=section.querySelector('.config-card h2');
 if(title) title.textContent='⚙️ Configurações da sessão';
 const help=section.querySelector('.backup-help');
 if(help) help.textContent='As configurações e dados desta sessão são compartilhados online com os usuários vinculados. Não há armazenamento offline no aparelho.';
 setupSessionPanelTabs();
}
function hideServiceSettingsTab(){
 const tab=document.querySelector('.tab[data-screen="configuracoes"]');
 if(tab) tab.style.display='none';
}
async function loadSharedWorkspaceForSession(profile,options={}){
 installSaveHook();
 const snapshot=await ValleCloud.loadWorkspaceSnapshot(options);
 let current=snapshot?.data||null;
 if(current&&window.normalizeDb){
   current=window.replaceValleDatabase?window.replaceValleDatabase(current):normalizeDb(current);
 }else{
   const theme='auto';
   current={settings:{theme,seq:1,capitalInvestido:0,percentualJuros50:50,taxaAtrasoDiario:0,tipoTaxaAtrasoDiario:'percentual'},clientes:[],vales:[]};
   if(window.replaceValleDatabase)current=window.replaceValleDatabase(current);
   await ValleCloud.saveWorkspace(current);
 }
 window.db=current;
 if(window.renderAll)renderAll();
 mountSessionSettings();
}
function applyServiceFinancialSettings(settings){
 const p=settings||{};
 window.VALLE_SERVICE_FINANCIAL_SETTINGS={
  interest_percent:Number(p.interest_percent??30),
  late_fee_type:p.late_fee_type==='reais'?'reais':'percentual',
  late_fee_value:Number(p.late_fee_value||0)
 };
 const current=window.getValleDatabase?window.getValleDatabase():window.db;
 if(current?.settings){
  current.settings.percentualJuros50=window.VALLE_SERVICE_FINANCIAL_SETTINGS.interest_percent;
  current.settings.taxaAtrasoDiario=window.VALLE_SERVICE_FINANCIAL_SETTINGS.late_fee_value;
  current.settings.tipoTaxaAtrasoDiario=window.VALLE_SERVICE_FINANCIAL_SETTINGS.late_fee_type;
  window.db=current;
 }
}


let adminMessageSessionNames=new Map();
let adminMessageHistoryItems=new Map();
function adminMessageTargetLabel(item){
 const id=String(item?.target_session_user_id||'');
 return id?(adminMessageSessionNames.get(id)||'SESSÃO SELECIONADA'):'TODAS AS SESSÕES';
}
async function loadAdminMessageSessions(){
 const select=el('adminMessageSession');if(!select)return [];
 const current=select.value;
 const items=(await ValleCloud.listManagedUsers()).filter(item=>item.role==='session');
 adminMessageSessionNames=new Map(items.map(item=>[String(item.id),String(item.name||item.email||'SESSÃO').toUpperCase()]));
 select.innerHTML='<option value="">TODAS AS SESSÕES</option>'+items.map(item=>`<option value="${htmlEscape(item.id)}">${htmlEscape(String(item.name||item.email||'SESSÃO').toUpperCase())}</option>`).join('');
 if(current&&adminMessageSessionNames.has(String(current)))select.value=current;
 return items;
}
function formatAdminMessageDate(value){
 const date=new Date(value||Date.now());
 return Number.isNaN(date.getTime())?'':date.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function closeAdminMessageComposer(){el('adminMessageModal')?.classList.add('hidden')}
async function renderAdminMessageHistory(){
 const box=el('adminMessageHistory');if(!box)return;
 box.innerHTML='<div class="admin-message-history-loading"><span class="spinner-border spinner-border-sm"></span> CARREGANDO...</div>';
 try{
  const items=await ValleCloud.listAdminMessages(12);
  adminMessageHistoryItems=new Map((items||[]).map(item=>[String(item.id),item]));
  box.innerHTML=items.length?items.map(item=>`<article class="admin-message-history-item${item.active?'':' is-inactive'}"><div class="admin-message-history-copy"><strong>${htmlEscape(item.title)}</strong><small>${formatAdminMessageDate(item.published_at||item.created_at)} · ${htmlEscape(adminMessageTargetLabel(item))} · ${item.active?'ATIVA':'DESATIVADA'}</small></div><div class="admin-message-history-actions"><button type="button" class="admin-message-history-use" data-admin-message-use="${htmlEscape(item.id)}" title="Usar o conteúdo desta mensagem" aria-label="Usar o conteúdo desta mensagem"><i class="bi bi-arrow-repeat"></i><span>USAR</span></button>${item.active?`<button type="button" class="admin-message-history-disable" data-admin-message-disable="${htmlEscape(item.id)}" title="Desativar mensagem" aria-label="Desativar mensagem"><i class="bi bi-eye-slash"></i><span>DESATIVAR</span></button>`:''}<button type="button" class="admin-message-history-delete" data-admin-message-delete="${htmlEscape(item.id)}" title="Excluir mensagem" aria-label="Excluir mensagem"><i class="bi bi-trash"></i><span>EXCLUIR</span></button></div></article>`).join(''):'<div class="admin-message-history-empty">NENHUMA MENSAGEM ENVIADA.</div>';
 }catch(err){adminMessageHistoryItems=new Map();box.innerHTML=`<div class="admin-message-history-empty">${htmlEscape(err.message||'Não foi possível carregar.')}</div>`}
}

function usePreviousAdminMessage(messageId){
 const item=adminMessageHistoryItems.get(String(messageId||''));
 if(!item){connectionToast('MENSAGEM NÃO ENCONTRADA.','error');return}
 const session=el('adminMessageSession');
 const target=String(item.target_session_user_id||'');
 if(session){
  const exists=[...session.options].some(option=>String(option.value)===target);
  session.value=exists?target:'';
 }
 if(el('adminMessageTitle'))el('adminMessageTitle').value=String(item.title||'ATUALIZAÇÃO DO SISTEMA');
 if(el('adminMessageText'))el('adminMessageText').value=String(item.message||'');
 const status=el('adminMessageStatus');
 if(status){status.textContent='CONTEÚDO DA MENSAGEM CARREGADO.';status.className='admin-message-status success'}
 el('adminMessageForm')?.scrollIntoView({behavior:'smooth',block:'start'});
 window.setTimeout(()=>el('adminMessageText')?.focus(),250);
}
async function openAdminMessageComposer(){
 const modal=el('adminMessageModal');if(!modal)return;
 el('adminMessageStatus').textContent='';
 modal.classList.remove('hidden');
 await loadAdminMessageSessions();
 await renderAdminMessageHistory();
 requestAnimationFrame(()=>el('adminMessageSession')?.focus());
}
async function submitAdminMessage(event){
 event.preventDefault();const status=el('adminMessageStatus');const submit=event.currentTarget.querySelector('[type="submit"]');
 status.textContent='ENVIANDO...';status.className='admin-message-status';submit.disabled=true;
 try{
  await ValleCloud.createAdminMessage({title:el('adminMessageTitle').value,message:el('adminMessageText').value,targetSessionId:el('adminMessageSession').value||null});
  status.textContent='';status.className='admin-message-status';
  el('adminMessageText').value='';await renderAdminMessageHistory();
 }catch(err){status.textContent=String(err.message||'Não foi possível enviar a mensagem.').toUpperCase();status.className='admin-message-status error'}
 finally{submit.disabled=false}
}
let adminMessageCheckRunning=false;
let adminMessageWatchInstalled=false;
let adminMessageRealtimeInstalled=false;
let systemUpdateMessageLastFocus=null;
let systemUpdateMessageScrollY=0;
function lockSystemUpdateMessageBackground(modal){
 if(!modal||document.body.classList.contains('valle-system-message-open'))return;
 systemUpdateMessageLastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
 systemUpdateMessageScrollY=Math.max(0,window.scrollY||window.pageYOffset||0);
 document.documentElement.classList.add('valle-system-message-open');
 document.body.classList.add('valle-system-message-open');
 document.body.style.setProperty('--valle-system-message-scroll-y',`${systemUpdateMessageScrollY}px`);
 // Como o modal está diretamente no body, os demais filhos podem ficar inert.
 // Isso bloqueia clique, toque e navegação por teclado no fundo.
 Array.from(document.body.children).forEach(node=>{
  if(node===modal)return;
  if(node.hasAttribute('inert'))node.dataset.valleHadInert='1';
  else node.dataset.valleMessageInert='1';
  node.inert=true;
 });
 requestAnimationFrame(()=>{
  const focusTarget=el('systemUpdateMessageClose')||modal.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
  focusTarget?.focus?.({preventScroll:true});
 });
}
function unlockSystemUpdateMessageBackground(modal){
 document.documentElement.classList.remove('valle-system-message-open');
 document.body.classList.remove('valle-system-message-open');
 document.body.style.removeProperty('--valle-system-message-scroll-y');
 Array.from(document.body.children).forEach(node=>{
  if(node===modal)return;
  if(node.dataset.valleMessageInert==='1'){
   node.inert=false;
   delete node.dataset.valleMessageInert;
  }
  delete node.dataset.valleHadInert;
 });
 window.scrollTo({top:systemUpdateMessageScrollY,left:0,behavior:'auto'});
 const restore=systemUpdateMessageLastFocus;
 systemUpdateMessageLastFocus=null;
 requestAnimationFrame(()=>restore?.focus?.({preventScroll:true}));
}
function trapSystemUpdateMessageFocus(event){
 const modal=el('systemUpdateMessageModal');
 if(!modal||modal.classList.contains('hidden')||event.key!=='Tab')return;
 const focusable=Array.from(modal.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
  .filter(node=>node.offsetParent!==null);
 if(!focusable.length){event.preventDefault();modal.focus?.();return}
 const first=focusable[0],last=focusable[focusable.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
async function checkAdminMessageForUser(profile){
 // A mensagem administrativa aparece para o usuário de sessão e para os usuários de serviço vinculados a ela.
 if(!profile||!['session','service'].includes(profile.role)||!ValleCloud.isOnline()||adminMessageCheckRunning)return;
 installAdminMessageRealtime();
 const modal=el('systemUpdateMessageModal');
 if(!modal||!modal.classList.contains('hidden'))return;
 adminMessageCheckRunning=true;
 try{
  const item=await ValleCloud.getUnreadAdminMessage();if(!item)return;
  el('systemUpdateMessageTitle').textContent=item.title||'ATUALIZAÇÃO DO SISTEMA';
  el('systemUpdateMessageText').textContent=item.message||'';
  el('systemUpdateMessageDate').textContent=formatAdminMessageDate(item.published_at||item.created_at);
  modal.dataset.messageId=String(item.id);
  modal.classList.remove('hidden');
  lockSystemUpdateMessageBackground(modal);
  const textBox=el('systemUpdateMessageText');
  if(textBox)textBox.scrollTop=0;
 }catch(err){console.warn('Mensagem do administrador indisponível:',err)}
 finally{adminMessageCheckRunning=false}
}
async function closeSystemUpdateMessage(){
 const modal=el('systemUpdateMessageModal');if(!modal)return;
 const messageId=String(modal.dataset.messageId||'');
 modal.classList.add('hidden');
 unlockSystemUpdateMessageBackground(modal);
 delete modal.dataset.messageId;
 if(messageId){
  try{await ValleCloud.markAdminMessageSeen(messageId)}
  catch(err){console.warn('Não foi possível registrar a leitura da MSG ADM:',err)}
 }
}
function installAdminMessageRealtime(){
 const profile=ValleCloud.profile;
 if(adminMessageRealtimeInstalled||!['session','service'].includes(profile?.role))return;
 const channel=ValleCloud.subscribeAdminMessageChanges?.(()=>{ void checkAdminMessageForUser(ValleCloud.profile); });
 ValleCloud.subscribeAdminMessageReadChanges?.(row=>{
  const modal=el('systemUpdateMessageModal');
  if(row&&modal&&!modal.classList.contains('hidden')&&String(modal.dataset.messageId||'')===String(row.message_id||''))void closeSystemUpdateMessage();
 });
 if(channel)adminMessageRealtimeInstalled=true;
}
function installAdminMessageWatcher(){
 if(adminMessageWatchInstalled)return;
 adminMessageWatchInstalled=true;
 document.addEventListener('keydown',trapSystemUpdateMessageFocus,true);
 const check=()=>{
  const profile=ValleCloud.profile;
  if(['session','service'].includes(profile?.role)&&ValleCloud.isOnline()){
   installAdminMessageRealtime();
   void checkAdminMessageForUser(profile);
  }
 };
 // Sem polling: verifica no início/retorno da conexão e depois reage aos eventos
 // reais de INSERT/UPDATE publicados por admin_messages.
 window.addEventListener('online',()=>setTimeout(check,400),{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
 window.addEventListener('valle-app-ready',check,{once:true});
 setTimeout(check,600);
}


let clientPortalSnapshot=null;
let clientPortalRealtimeInstalledFor='';
let clientPortalRealtimeRefreshRunning=false;
let clientPortalRealtimeRefreshPending=false;
function clientPortalMoney(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function clientPortalDate(v){
 const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '—';
 const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;
}
function clientPortalPaid(v){const s=String(v?.status||'').toUpperCase();return s==='PAGO'||s==='QUITADO'}
function clientPortalOriginalPrincipal(v){
 const saved=Number(v?.valorOriginal);if(saved>0)return saved;
 const atual=Number(v?.valor||0),total=Number(v?.total||0),juros=Number(v?.juros||0),totalOriginal=Number(v?.totalOriginal||0);
 if(atual<=0&&total>0&&juros>0)return total/(juros/100);
 if(totalOriginal>0&&juros>0)return totalOriginal/(1+(juros/100));
 return Math.max(0,atual);
}
function clientPortalOriginalTotal(v){
 const principal=clientPortalOriginalPrincipal(v),juros=Number(v?.juros||0),calc=principal+(principal*juros/100);
 if(calc>0)return calc;const saved=Number(v?.totalOriginal);return saved>0?saved:Math.max(0,Number(v?.total||0));
}
function clientPortalDaysLate(date){
 const s=String(date||'').slice(0,10);if(!s)return 0;const due=new Date(`${s}T12:00:00`);const now=new Date();now.setHours(12,0,0,0);
 return Math.max(0,Math.floor((now-due)/86400000));
}
function clientPortalLateFee(v){
 if(clientPortalPaid(v)||!v?.dataFinal)return 0;const days=clientPortalDaysLate(v.dataFinal);if(!days)return 0;
 const baseTotal=Math.max(0,clientPortalOriginalTotal(v)-Number(v.parcialRecebido||0));
 const multa=baseTotal*(Math.max(0,Number(v.multaAtrasoPercentual||0))/100);
 const taxa=Math.max(0,Number(v.taxaAtrasoDiario||0));let diaria=0;
 if(taxa>0){if(v.tipoTaxaAtrasoDiario==='reais')diaria=days*taxa;else diaria=Math.max(0,clientPortalOriginalPrincipal(v)-Number(v.principalRecebido||0))*(taxa/100)*days}
 return multa+diaria;
}
function clientPortalBalance(v){return clientPortalPaid(v)?0:Math.max(0,clientPortalOriginalTotal(v)-Number(v.parcialRecebido||0)+clientPortalLateFee(v))}
function clientPortalStatus(v){
 if(clientPortalPaid(v))return {key:'pago',label:'PAGO',cls:'success'};
 const today=new Date().toISOString().slice(0,10);if(v?.dataFinal&&String(v.dataFinal).slice(0,10)<today)return {key:'atrasado',label:'ATRASADO',cls:'danger'};
 if(v?.dataFinal&&String(v.dataFinal).slice(0,10)===today)return {key:'hoje',label:'VENCE HOJE',cls:'warning'};
 return {key:'aberto',label:'EM ABERTO',cls:'primary'};
}
function clientPortalEsc(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

function clientPortalPixKey(data){return String(data?.payment?.pix_key||data?.session?.pix_key||'').trim()}
function clientPortalPixName(data){return String(data?.payment?.pix_name||'').trim()}
function clientPortalPixCity(data){return String(data?.payment?.pix_city||'').trim()}
function clientPixAscii(value,maxLen){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 .\-\/]/g,' ').replace(/\s+/g,' ').trim().slice(0,maxLen);
}
function clientPixField(id,value){const v=String(value??'');return `${id}${String(v.length).padStart(2,'0')}${v}`}
function clientPixCrc16(payload){
 let crc=0xFFFF;
 for(let i=0;i<payload.length;i++){
   crc^=payload.charCodeAt(i)<<8;
   for(let bit=0;bit<8;bit++) crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);
   crc&=0xFFFF;
 }
 return crc.toString(16).toUpperCase().padStart(4,'0');
}
function clientPortalPixPayload({key,name,city,amount,txid}){
 const cleanKey=String(key||'').trim();
 const merchantName=clientPixAscii(name||'VALLE',25)||'VALLE';
 const merchantCity=clientPixAscii(city||'BRASIL',15)||'BRASIL';
 const cleanTxid=clientPixAscii(txid||'VALLE',25).replace(/[^A-Z0-9]/g,'')||'***';
 const merchantAccount=clientPixField('00','br.gov.bcb.pix')+clientPixField('01',cleanKey);
 const additional=clientPixField('05',cleanTxid);
 let payload=clientPixField('00','01')+clientPixField('26',merchantAccount)+clientPixField('52','0000')+clientPixField('53','986');
 const n=Number(amount||0);if(n>0)payload+=clientPixField('54',n.toFixed(2));
 payload+=clientPixField('58','BR')+clientPixField('59',merchantName)+clientPixField('60',merchantCity)+clientPixField('62',additional)+'6304';
 return payload+clientPixCrc16(payload);
}
function ensureClientPixModal(){
 let modal=el('clientPixModal');
 if(modal)return modal;
 modal=document.createElement('div');
 modal.className='modal fade';
 modal.id='clientPixModal';
 modal.tabIndex=-1;
 modal.setAttribute('aria-hidden','true');
 modal.innerHTML=`<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content client-pix-modal"><div class="modal-header"><div><small>PAGAMENTO PIX</small><h2 class="h5 mb-0" id="clientPixTitle">Pagamento</h2></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div><div class="modal-body"><div id="clientPixCopyFeedback" class="client-pix-copy-feedback alert alert-success d-none" role="status" aria-live="polite"><i class="bi bi-check-circle-fill"></i><span>PIX COPIADO COM SUCESSO!</span></div><div class="client-pix-amount"><span>VALOR A PAGAR</span><strong id="clientPixAmount">R$ 0,00</strong></div><div class="client-pix-beneficiary"><span>BENEFICIÁRIO</span><strong id="clientPixBeneficiary">—</strong></div><div class="client-pix-qr-wrap"><div id="clientPixQr" class="client-pix-qr" aria-label="QR Code PIX"></div></div><div class="client-pix-key-box"><span>CHAVE PIX</span><strong id="clientPixKey">—</strong></div><div class="client-pix-message"><label for="clientPixMessage">OBSERVAÇÃO DO PAGAMENTO <small>(OPCIONAL)</small></label><textarea id="clientPixMessage" rows="2" maxlength="180" placeholder="Ex.: paguei pelo banco X"></textarea></div><p class="client-pix-help">Depois de pagar, toque em <strong>JÁ PAGUEI</strong>. O pagamento ficará aguardando conferência; o vale não é quitado automaticamente.</p></div><div class="modal-footer client-pix-footer"><button type="button" class="btn btn-outline-primary" id="clientPixCopyBtn"><i class="bi bi-copy"></i><span>COPIAR PIX</span></button><button type="button" class="btn btn-success" id="clientPixPaidBtn"><i class="bi bi-check2-circle"></i><span>JÁ PAGUEI</span></button></div></div></div>`;
 document.body.appendChild(modal);
 modal.addEventListener('show.bs.modal',()=>{
   requestAnimationFrame(()=>{
     const backdrops=[...document.querySelectorAll('.modal-backdrop')];
     const backdrop=backdrops[backdrops.length-1];
     if(backdrop){
       backdrop.classList.add('client-pix-backdrop');
       backdrop.style.zIndex='2147483608';
     }
     modal.style.zIndex='2147483609';
   });
 });
 modal.addEventListener('hidden.bs.modal',()=>{
   modal.style.zIndex='';
   document.querySelectorAll('.modal-backdrop.client-pix-backdrop').forEach((bd,i,arr)=>{
     if(i===arr.length-1){bd.style.zIndex='';bd.classList.remove('client-pix-backdrop');}
   });
 });
 el('clientPixCopyBtn').onclick=async()=>{
   const payload=modal.dataset.pixPayload||el('clientPixKey')?.textContent||'';
   if(!payload)return;
   const feedback=el('clientPixCopyFeedback');
   const showFeedback=(ok,message)=>{
     if(!feedback)return;
     clearTimeout(showFeedback.timer);
     clearTimeout(showFeedback.hideTimer);
     feedback.classList.remove('d-none','alert-success','alert-danger','is-visible');
     feedback.classList.add(ok?'alert-success':'alert-danger');
     feedback.innerHTML=`<i class="bi ${ok?'bi-check-circle-fill':'bi-x-circle-fill'}"></i><span>${message}</span>`;
     void feedback.offsetWidth;
     requestAnimationFrame(()=>feedback.classList.add('is-visible'));
     showFeedback.timer=setTimeout(()=>{
       feedback.classList.remove('is-visible');
       showFeedback.hideTimer=setTimeout(()=>feedback.classList.add('d-none'),220);
     },2400);
   };
   try{
     if(navigator.clipboard?.writeText){
       await navigator.clipboard.writeText(payload);
     }else{
       const area=document.createElement('textarea');
       area.value=payload;
       area.setAttribute('readonly','');
       area.style.position='fixed';area.style.opacity='0';area.style.pointerEvents='none';
       document.body.appendChild(area);
       area.focus();area.select();area.setSelectionRange(0,area.value.length);
       const copied=document.execCommand('copy');
       area.remove();
       if(!copied)throw new Error('copy_failed');
     }
     showFeedback(true,'PIX COPIADO COM SUCESSO!');
   }catch(_){
     showFeedback(false,'NÃO FOI POSSÍVEL COPIAR O PIX');
   }
 };
 el('clientPixPaidBtn').onclick=async()=>{
   const index=Number(modal.dataset.loanIndex);
   const data=clientPortalSnapshot||{};const vales=Array.isArray(data?.vales)?data.vales:[];const loan=vales[index];
   if(!loan)return;
   const btn=el('clientPixPaidBtn');btn.disabled=true;
   try{
     await ValleCloud.createClientPaymentRequest({valeId:loan.id,amount:clientPortalBalance(loan),message:el('clientPixMessage')?.value||''});
     bootstrap.Modal.getInstance(modal)?.hide();
     connectionToast('PAGAMENTO INFORMADO. AGUARDANDO CONFERÊNCIA.','success');
     await loadAndRenderClientPortal(ValleCloud.profile,true);
   }catch(err){connectionToast(err.message||'NÃO FOI POSSÍVEL INFORMAR O PAGAMENTO','error')}
   finally{btn.disabled=false}
 };
 return modal;
}
async function openClientPixPayment(loanIndex){
 const data=clientPortalSnapshot||{};
 const vales=Array.isArray(data?.vales)?data.vales:[];
 const loan=vales[Number(loanIndex)];
 if(!loan)return;
 const pixKey=clientPortalPixKey(data);
 if(!pixKey){connectionToast('A CHAVE PIX AINDA NÃO FOI CONFIGURADA PELA SESSÃO.','error');return}
 const modal=ensureClientPixModal();modal.dataset.loanIndex=String(loanIndex);
 const title=`VALE #${String(loan.numero||'').padStart(4,'0')}${loan.crediarioId?` • PARCELA ${Number(loan.parcelaNumero||0)}/${Number(loan.parcelaTotal||0)}`:''}`;
 const amount=clientPortalBalance(loan);const name=clientPortalPixName(data)||data?.session?.name||'VALLE';const city=clientPortalPixCity(data)||'BRASIL';
 const txid=`VALLE${String(loan.numero||loan.id||'').replace(/[^A-Za-z0-9]/g,'').slice(0,18)}`;
 const payload=clientPortalPixPayload({key:pixKey,name,city,amount,txid});
 el('clientPixTitle').textContent=title;el('clientPixAmount').textContent=clientPortalMoney(amount);el('clientPixKey').textContent=pixKey;el('clientPixBeneficiary').textContent=name;modal.dataset.pixPayload=payload;el('clientPixMessage').value='';
 const qrBox=el('clientPixQr');
 if(qrBox){
   qrBox.innerHTML='';
   try{
     if(window.QRCode){
       new window.QRCode(qrBox,{text:payload,width:200,height:200,correctLevel:window.QRCode.CorrectLevel?.M});
       const qrImg=qrBox.querySelector('img');if(qrImg)qrImg.alt=`QR Code PIX para ${title}`;
     }else qrBox.innerHTML=`<div class="client-pix-qr-fallback"><i class="bi bi-qr-code"></i><span>QR Code indisponível</span></div>`;
   }catch(_){qrBox.innerHTML=`<div class="client-pix-qr-fallback"><i class="bi bi-qr-code"></i><span>QR Code indisponível</span></div>`}
 }
 bootstrap.Modal.getOrCreateInstance(modal).show();
}

function setupClientPortalPullRefresh(portal){
 if(!portal||portal.dataset.pullRefreshReady==='1')return;
 portal.dataset.pullRefreshReady='1';
 const threshold=78;
 let startY=0,lastY=0,distance=0,tracking=false,refreshing=false;
 const scrollTop=()=>Math.max(0,window.scrollY||0,document.documentElement?.scrollTop||0,document.body?.scrollTop||0);
 const indicator=()=>el('clientPortalPullRefresh');
 const label=()=>el('clientPortalPullRefreshText');
 const setPullOffset=value=>{
   const offset=Math.max(0,Math.round(value||0));
   portal.style.setProperty('--client-pull-offset',`${offset}px`);
   portal.classList.toggle('is-pull-active',offset>0);
 };
 const reset=()=>{
   const box=indicator();
   if(box&&!refreshing){box.classList.remove('is-pulling','is-ready');box.style.removeProperty('--pull-distance')}
   setPullOffset(0);
   distance=0;tracking=false;
 };
 const beginAtTop=y=>{tracking=true;startY=y;distance=0;const box=indicator();if(box){box.classList.add('is-pulling');box.classList.remove('is-ready');box.style.setProperty('--pull-distance','0px')}setPullOffset(0);if(label())label().textContent='PUXE PARA ATUALIZAR'};
 portal.addEventListener('touchstart',ev=>{
   if(refreshing||portal.classList.contains('hidden')||document.querySelector('.modal.show'))return;
   const y=ev.touches?.[0]?.clientY??0;startY=y;lastY=y;distance=0;tracking=scrollTop()<=1;
   if(tracking)beginAtTop(y);
 },{passive:true});
 portal.addEventListener('touchmove',ev=>{
   if(refreshing||portal.classList.contains('hidden')||document.querySelector('.modal.show'))return;
   const y=ev.touches?.[0]?.clientY??lastY;
   const top=scrollTop();
   if(!tracking&&top<=1&&y>=lastY)beginAtTop(y);
   lastY=y;
   if(!tracking)return;
   if(top>1){reset();return}
   const dy=y-startY;
   if(dy<=0){distance=0;const box=indicator();if(box){box.classList.remove('is-ready');box.style.setProperty('--pull-distance','0px')}return}
   ev.preventDefault();
   distance=Math.min(118,dy*.62);
   setPullOffset(Math.min(84,distance*.78));
   const box=indicator();
   if(box){box.classList.add('is-pulling');box.style.setProperty('--pull-distance',`${distance}px`);box.classList.toggle('is-ready',distance>=threshold)}
   if(label())label().textContent=distance>=threshold?'SOLTE PARA ATUALIZAR':'PUXE PARA ATUALIZAR';
 },{passive:false});
 const finish=async()=>{
   if(!tracking||refreshing)return;
   const shouldRefresh=distance>=threshold&&scrollTop()<=1;
   if(!shouldRefresh){reset();return}
   refreshing=true;tracking=false;
   const box=indicator();
   setPullOffset(54);
   if(box){box.classList.remove('is-ready');box.classList.add('is-refreshing','is-pulling');box.style.setProperty('--pull-distance','58px')}
   if(label())label().textContent='ATUALIZANDO...';
   try{await loadAndRenderClientPortal(ValleCloud.profile,true)}finally{
     if(label())label().textContent='ATUALIZADO';
     if(box)box.classList.add('is-done');
     setTimeout(()=>{refreshing=false;if(box){box.classList.remove('is-refreshing','is-pulling','is-done');box.style.removeProperty('--pull-distance')}setPullOffset(0);if(label())label().textContent='PUXE PARA ATUALIZAR';distance=0},650);
   }
 };
 portal.addEventListener('touchend',()=>{void finish()},{passive:true});
 portal.addEventListener('touchcancel',reset,{passive:true});
}

function ensureClientPortal(){
 let portal=el('clientPortal');if(portal)return portal;
 portal=document.createElement('section');portal.id='clientPortal';portal.className='client-portal hidden';
 portal.innerHTML=`<header class="client-portal-top"><div class="client-portal-top-inner"><div class="client-portal-brand"><span class="client-portal-logo-shell"><img src="icons/icon-valle.png" alt="VALLE"></span><div class="client-portal-brand-copy"><strong>VALLE</strong><small><i class="bi bi-person-badge"></i> ÁREA DO CLIENTE</small></div></div><div class="client-portal-user"><div class="client-portal-user-copy"><small>MINHA CONTA</small><strong id="clientPortalUserName">Cliente</strong><span id="clientPortalUserEmail"></span></div><button id="clientPortalLogout" type="button" class="btn client-portal-logout" aria-label="Sair da Área do Cliente" title="Sair"><i class="bi bi-box-arrow-right"></i><span>SAIR</span></button></div></div></header><div id="clientPortalPullRefresh" class="client-pull-refresh" aria-live="polite"><span class="client-pull-refresh-icon"><i class="bi bi-arrow-down"></i></span><strong id="clientPortalPullRefreshText">PUXE PARA ATUALIZAR</strong></div><main class="client-portal-main"><section class="client-portal-hero"><div><small>MINHA CONTA</small><h1 id="clientPortalGreeting"><span class="client-greeting-hello">Olá</span><strong id="clientPortalGreetingName" class="client-greeting-name">Cliente</strong></h1><p>Acompanhe seus vales, crediários, parcelas e vencimentos.</p></div></section><div id="clientPortalMessage"></div><section id="clientPortalSummary" class="client-portal-summary"></section><section class="client-portal-section"><div class="client-portal-section-head"><div><small>CONTRATOS</small><h2>Meus crediários</h2></div></div><div id="clientPortalCrediarios" class="client-portal-contracts"></div></section><section class="client-portal-section"><div class="client-portal-section-head"><div><small>LANÇAMENTOS</small><h2>Meus vales</h2></div></div><div id="clientPortalVales" class="client-portal-vales"></div></section><section class="client-portal-section"><div class="client-portal-section-head"><div><small>PAGAMENTOS</small><h2>Pagamentos informados</h2></div></div><div id="clientPortalPaymentHistory" class="client-portal-payment-history"></div></section></main>`;
 document.body.appendChild(portal);
 el('clientPortalLogout').onclick=async()=>{document.body.classList.remove('client-portal-active');await ValleCloud.signOut();portal.classList.add('hidden');el('authGate').classList.remove('hidden');document.documentElement.classList.add('valle-auth-active');document.body.classList.add('valle-auth-active')};
 setupClientPortalPullRefresh(portal);
 return portal;
}
function clientPortalCrediarioName(items=[]){
 const explicit=items.find(v=>String(v?.crediarioNome||v?.crediario_nome||'').trim());
 if(explicit)return String(explicit.crediarioNome||explicit.crediario_nome||'').trim().toUpperCase();
 const code=items?.[0]?.crediarioCodigo||'CREDIÁRIO';
 return `CREDIÁRIO ${code}`.trim();
}
function clientPortalPaymentRequestMap(data){
 const map=new Map();
 const requests=Array.isArray(data?.payment_requests)?data.payment_requests:[];
 requests.forEach(r=>{
   const key=String(r?.vale_id||'');
   if(!key)return;
   const current=map.get(key);
   const currentTime=current?.created_at?new Date(current.created_at).getTime():0;
   const nextTime=r?.created_at?new Date(r.created_at).getTime():0;
   if(!current||nextTime>=currentTime)map.set(key,r);
 });
 return map;
}
function clientPortalContractFilterState(v,request){
 if(clientPortalPaid(v))return 'paid';
 const status=String(request?.status||'').toLowerCase();
 if(status==='confirmed')return 'paid';
 if(status==='pending')return 'informed';
 return 'to_pay';
}
function ensureClientCrediarioLaunchModal(){
 let modal=el('clientCrediarioLaunchModal');
 if(modal)return modal;
 modal=document.createElement('div');
 modal.className='modal fade client-crediario-launch-modal';
 modal.id='clientCrediarioLaunchModal';
 modal.tabIndex=-1;
 modal.setAttribute('aria-hidden','true');
 modal.innerHTML=`<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><div class="client-contract-modal-title"><small id="clientCrediarioLaunchCode">CREDIÁRIO</small><h2 class="h5 mb-0" id="clientCrediarioLaunchTitle">Lançamentos</h2></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button></div><div class="modal-body"><div id="clientCrediarioLaunchFilters" class="client-contract-filter-bar" role="tablist" aria-label="Filtrar lançamentos"><button type="button" class="client-contract-filter" data-client-contract-filter="paid"><i class="bi bi-check-circle-fill"></i><span>PAGOS</span><em id="clientCrediarioPaidCount">0</em></button><button type="button" class="client-contract-filter active" data-client-contract-filter="to_pay"><i class="bi bi-wallet2"></i><span>A PAGAR</span><em id="clientCrediarioToPayCount">0</em></button><button type="button" class="client-contract-filter" data-client-contract-filter="informed"><i class="bi bi-hourglass-split"></i><span>INFORMADOS</span><em id="clientCrediarioInformedCount">0</em></button></div><div id="clientCrediarioLaunchSummary" class="client-contract-launch-summary"></div><div id="clientCrediarioLaunchList" class="client-contract-launch-list"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary w-100" data-bs-dismiss="modal">FECHAR</button></div></div></div>`;
 document.body.appendChild(modal);
 modal.querySelectorAll('[data-client-contract-filter]').forEach(btn=>btn.onclick=()=>{
   modal.dataset.filter=btn.dataset.clientContractFilter||'to_pay';
   renderClientCrediarioLaunchModal();
 });
 modal.addEventListener('show.bs.modal',()=>{
   requestAnimationFrame(()=>{
     const backdrops=[...document.querySelectorAll('.modal-backdrop')];
     const backdrop=backdrops[backdrops.length-1];
     if(backdrop){backdrop.classList.add('client-contract-backdrop');backdrop.style.zIndex='2147483508'}
     modal.style.zIndex='2147483509';
   });
 });
 modal.addEventListener('hidden.bs.modal',()=>{
   modal.style.zIndex='';
   document.querySelectorAll('.modal-backdrop.client-contract-backdrop').forEach((bd,i,arr)=>{if(i===arr.length-1){bd.style.zIndex='';bd.classList.remove('client-contract-backdrop')}});
 });
 return modal;
}
function renderClientCrediarioLaunchModal(){
 const modal=ensureClientCrediarioLaunchModal();
 const data=clientPortalSnapshot||{};
 const vales=Array.isArray(data?.vales)?data.vales:[];
 const id=String(modal.dataset.crediarioId||'');
 const filter=modal.dataset.filter||'to_pay';
 const items=vales.filter(v=>String(v?.crediarioId||'')===id).sort((a,b)=>Number(a.parcelaNumero||0)-Number(b.parcelaNumero||0));
 if(!items.length)return;
 const reqMap=clientPortalPaymentRequestMap(data);
 const nome=clientPortalCrediarioName(items);
 const code=items[0]?.crediarioCodigo||'CREDIÁRIO';
 const buckets={paid:[],to_pay:[],informed:[]};
 items.forEach(v=>{
   const req=reqMap.get(String(v.id||''));
   const state=clientPortalContractFilterState(v,req);
   buckets[state].push(v);
   const reqStatus=String(req?.status||'').toLowerCase();
   if(reqStatus==='rejected'&&!clientPortalPaid(v))buckets.informed.push(v);
 });
 el('clientCrediarioLaunchTitle').textContent=nome;
 el('clientCrediarioLaunchCode').textContent=code;
 el('clientCrediarioPaidCount').textContent=buckets.paid.length;
 el('clientCrediarioToPayCount').textContent=buckets.to_pay.length;
 el('clientCrediarioInformedCount').textContent=buckets.informed.length;
 modal.querySelectorAll('[data-client-contract-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.clientContractFilter===filter));
 const visible=buckets[filter]||[];
 const sum=visible.reduce((s,v)=>s+(filter==='paid'?clientPortalOriginalTotal(v):clientPortalBalance(v)),0);
 const labels={paid:['PAGOS','Parcelas pagas ou com pagamento confirmado'],to_pay:['A PAGAR','Saldo das parcelas em aberto'],informed:['INFORMADOS','Pagamentos aguardando conferência ou recusados']};
 const meta=labels[filter]||labels.to_pay;
 el('clientCrediarioLaunchSummary').innerHTML=`<div><span>${meta[0]}</span><strong>${visible.length}</strong></div><div><span>${meta[1]}</span><strong>${clientPortalMoney(sum)}</strong></div>`;
 const list=el('clientCrediarioLaunchList');
 if(!visible.length){
   list.innerHTML=`<div class="client-contract-launch-empty"><i class="bi ${filter==='paid'?'bi-check-circle':filter==='informed'?'bi-hourglass-split':'bi-wallet2'}"></i><strong>NENHUM LANÇAMENTO</strong><span>Não existem lançamentos nesta situação.</span></div>`;
   return;
 }
 list.innerHTML=visible.map(v=>{
   const req=reqMap.get(String(v.id||''));
   const reqStatus=String(req?.status||'').toLowerCase();
   const originalIndex=vales.indexOf(v);
   const lateFee=clientPortalLateFee(v);
   let badge='';
   let action='';
   if(filter==='paid')badge=`<span class="badge text-bg-success"><i class="bi bi-check-circle-fill"></i> ${reqStatus==='confirmed'&&!clientPortalPaid(v)?'CONFIRMADO':'PAGO'}</span>`;
   else if(filter==='informed'){
     const informedMeta=reqStatus==='confirmed'
       ? {cls:'success',label:'CONFIRMADO',icon:'bi-check-circle-fill'}
       : reqStatus==='rejected'
         ? {cls:'danger',label:'RECUSADO',icon:'bi-x-circle-fill'}
         : {cls:'warning',label:'INFORMADO',icon:'bi-hourglass-split'};
     badge=`<span class="badge text-bg-${informedMeta.cls}"><i class="bi ${informedMeta.icon}"></i> ${informedMeta.label}</span>`;
   } else {
     const st=clientPortalStatus(v);
     badge=`<span class="badge text-bg-${st.cls}">${st.label}</span>`;
     action=`<button type="button" class="btn btn-success client-contract-launch-pay" data-client-contract-pay="${originalIndex}"><i class="bi bi-qr-code-scan"></i><span>PAGAR</span></button>`;
   }
   return `<article class="client-contract-launch-item ${filter}"><div class="client-contract-launch-head"><div><small>PARCELA ${Number(v.parcelaNumero||0)}/${Number(v.parcelaTotal||items.length)} • VALE #${String(v.numero||'').padStart(4,'0')}</small><strong>${clientPortalDate(v.dataFinal)}</strong></div>${badge}</div><div class="client-contract-launch-values"><div><span>VALOR</span><strong>${clientPortalMoney(clientPortalOriginalTotal(v))}</strong></div><div><span>${filter==='paid'?'PAGO':'A PAGAR'}</span><strong>${clientPortalMoney(filter==='paid'?clientPortalOriginalTotal(v):clientPortalBalance(v))}</strong>${lateFee>0&&filter!=='paid'?`<small>+ ${clientPortalMoney(lateFee)} atraso</small>`:''}</div></div>${req?.created_at&&filter==='informed'?`<div class="client-contract-launch-informed ${reqStatus==='rejected'?'is-rejected':''}"><i class="bi ${reqStatus==='rejected'?'bi-x-circle-fill':'bi-clock-history'}"></i><div><span>${reqStatus==='rejected'?'Recusado':'Informado'} em ${new Date(req.created_at).toLocaleString('pt-BR')}</span>${reqStatus==='rejected'&&req?.review_note?`<small>Motivo: ${clientPortalEsc(req.review_note)}</small>`:''}</div></div>`:''}${action?`<div class="client-contract-launch-actions">${action}</div>`:''}</article>`;
 }).join('');
 list.querySelectorAll('[data-client-contract-pay]').forEach(btn=>btn.onclick=()=>openClientPixPayment(btn.dataset.clientContractPay));
}
function openClientCrediarioLaunchModal(crediarioId){
 const modal=ensureClientCrediarioLaunchModal();
 modal.dataset.crediarioId=String(crediarioId||'');
 modal.dataset.filter='to_pay';
 renderClientCrediarioLaunchModal();
 bootstrap.Modal.getOrCreateInstance(modal,{backdrop:true,keyboard:true}).show();
}

function renderClientPortal(data,profile){
 clientPortalSnapshot=data;const portal=ensureClientPortal();const cliente=data?.cliente||{};const vales=Array.isArray(data?.vales)?data.vales:[];
 el('clientPortalUserName').textContent=cliente.nome||profile?.name||'Cliente';el('clientPortalUserEmail').textContent=profile?.email||data?.account?.email||'';
 el('clientPortalGreetingName').textContent=String(cliente.nome||profile?.name||'Cliente').toUpperCase();
 const open=vales.filter(v=>!clientPortalPaid(v));const paid=vales.filter(clientPortalPaid);const overdue=open.filter(v=>clientPortalStatus(v).key==='atrasado');
 const balance=open.reduce((s,v)=>s+clientPortalBalance(v),0);const late=overdue.reduce((s,v)=>s+clientPortalLateFee(v),0);
 const next=[...open].filter(v=>v.dataFinal).sort((a,b)=>String(a.dataFinal).localeCompare(String(b.dataFinal)))[0];
 el('clientPortalSummary').innerHTML=`<article><span><i class="bi bi-wallet2"></i>SALDO ATUAL</span><strong>${clientPortalMoney(balance)}</strong><small>${open.length} em aberto</small></article><article class="${overdue.length?'danger':''}"><span><i class="bi bi-exclamation-triangle"></i>EM ATRASO</span><strong>${overdue.length}</strong><small>${late>0?clientPortalMoney(late)+' em encargos':'Nenhum atraso'}</small></article><article class="success"><span><i class="bi bi-check-circle"></i>QUITADOS</span><strong>${paid.length}</strong><small>vales/parcelas pagos</small></article><article><span><i class="bi bi-calendar-event"></i>PRÓXIMO VENCIMENTO</span><strong>${next?clientPortalDate(next.dataFinal):'—'}</strong><small>${next?clientPortalMoney(clientPortalBalance(next)):'Nada em aberto'}</small></article>`;
 const groups=new Map();vales.filter(v=>v.crediarioId).forEach(v=>{if(!groups.has(v.crediarioId))groups.set(v.crediarioId,[]);groups.get(v.crediarioId).push(v)});
 const contracts=[...groups.entries()].map(([id,items])=>{items.sort((a,b)=>Number(a.parcelaNumero||0)-Number(b.parcelaNumero||0));const first=items[0]||{};const qtd=Number(first.parcelaTotal||items.length);const pg=items.filter(clientPortalPaid).length;const atras=items.filter(v=>clientPortalStatus(v).key==='atrasado').length;const saldo=items.reduce((s,v)=>s+clientPortalBalance(v),0);const pct=qtd?Math.min(100,(pg/qtd)*100):0;const nomeCrediario=clientPortalCrediarioName(items);return {id,items,first,qtd,pg,atras,saldo,pct,nomeCrediario}});
 el('clientPortalCrediarios').innerHTML=contracts.length?contracts.map(c=>`<article class="client-portal-contract client-portal-contract-clickable ${c.atras?'is-late':''}" data-client-crediario="${clientPortalEsc(c.id)}" role="button" tabindex="0" aria-label="Abrir lançamentos do crediário ${clientPortalEsc(c.nomeCrediario)}"><div class="client-portal-contract-head"><div><small>${clientPortalEsc(c.first.crediarioCodigo||'CREDIÁRIO')}</small><h3 title="${clientPortalEsc(c.nomeCrediario)}">${clientPortalEsc(c.nomeCrediario)}</h3></div><span class="badge text-bg-${c.saldo<=0?'success':c.atras?'danger':'primary'}">${c.saldo<=0?'QUITADO':c.atras?'ATRASADO':'EM DIA'}</span></div><div class="client-portal-progress-copy"><span>${c.pg}/${c.qtd} parcelas pagas</span><strong>${c.pct.toFixed(0)}%</strong></div><div class="progress"><div class="progress-bar" style="width:${c.pct}%"></div></div><div class="client-portal-contract-stats"><div><span>SALDO</span><strong>${clientPortalMoney(c.saldo)}</strong></div><div><span>PARCELAS</span><strong>${c.qtd}</strong></div><div><span>ATRASADAS</span><strong>${c.atras}</strong></div></div><div class="client-portal-contract-open"><i class="bi bi-eye"></i><span>VER LANÇAMENTOS</span></div></article>`).join(''):'<div class="client-portal-empty"><i class="bi bi-credit-card"></i><strong>NENHUM CREDIÁRIO</strong><span>Você não possui contratos de crediário.</span></div>';
 el('clientPortalCrediarios').querySelectorAll('[data-client-crediario]').forEach(card=>{
   const open=()=>openClientCrediarioLaunchModal(card.dataset.clientCrediario);
   card.onclick=open;
   card.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();open()}};
 });
 const paymentRequests=Array.isArray(data?.payment_requests)?data.payment_requests:[];
 const requestByVale=clientPortalPaymentRequestMap({payment_requests:paymentRequests});
 const valesById=new Map(vales.map(v=>[String(v?.id||''),v]));
 const paymentRequestsVales=paymentRequests.filter(r=>{const vale=valesById.get(String(r?.vale_id||''));return Boolean(vale&&!vale?.crediarioId)});
 const orderedVales=[...vales].filter(v=>!v?.crediarioId).sort((a,b)=>String(b.dataFinal||'').localeCompare(String(a.dataFinal||'')));
 el('clientPortalVales').innerHTML=orderedVales.length?orderedVales.map(v=>{const st=clientPortalStatus(v),lateFee=clientPortalLateFee(v);const originalIndex=vales.indexOf(v);const req=requestByVale.get(String(v.id||''));const reqStatus=String(req?.status||'').toLowerCase();let payButton='';if(!clientPortalPaid(v)){if(reqStatus==='pending')payButton='<button type="button" class="btn btn-outline-warning client-portal-pay-btn" disabled><i class="bi bi-hourglass-split"></i><span>PAGAMENTO INFORMADO</span></button>';else if(reqStatus==='confirmed')payButton='<button type="button" class="btn btn-outline-success client-portal-pay-btn" disabled><i class="bi bi-check-circle"></i><span>PAGAMENTO CONFIRMADO</span></button>';else payButton=`<button type="button" class="btn btn-success client-portal-pay-btn" data-client-pay-loan="${originalIndex}"><i class="bi bi-qr-code-scan"></i><span>PAGAR</span></button>`}return `<article class="client-portal-vale ${st.key}"><div class="client-portal-vale-main"><div><small>VALE #${String(v.numero||'').padStart(4,'0')}${v.crediarioId?` • PARCELA ${Number(v.parcelaNumero||0)}/${Number(v.parcelaTotal||0)}`:''}</small><strong>${clientPortalDate(v.dataFinal)}</strong></div><span class="badge text-bg-${st.cls}">${st.label}</span></div><div class="client-portal-vale-values"><div><span>VALOR</span><strong>${clientPortalMoney(clientPortalOriginalTotal(v))}</strong></div><div><span>A PAGAR</span><strong>${clientPortalMoney(clientPortalBalance(v))}</strong>${lateFee>0?`<small>+ ${clientPortalMoney(lateFee)} atraso</small>`:''}</div></div>${payButton?`<div class="client-portal-vale-actions">${payButton}</div>`:''}</article>`}).join(''):'<div class="client-portal-empty"><i class="bi bi-receipt"></i><strong>NENHUM VALE</strong><span>Não há vales avulsos vinculados à sua conta.</span></div>';
 el('clientPortalVales').querySelectorAll('[data-client-pay-loan]').forEach(btn=>btn.onclick=()=>openClientPixPayment(btn.dataset.clientPayLoan));
 const reqMeta={pending:{label:'AGUARDANDO CONFERÊNCIA',cls:'warning',icon:'bi-hourglass-split'},confirmed:{label:'CONFIRMADO',cls:'success',icon:'bi-check-circle-fill'},rejected:{label:'NÃO CONFIRMADO',cls:'danger',icon:'bi-x-circle-fill'}};
 el('clientPortalPaymentHistory').innerHTML=paymentRequestsVales.length?paymentRequestsVales.map(r=>{const meta=reqMeta[String(r.status||'pending').toLowerCase()]||reqMeta.pending;return `<article class="client-portal-payment-item"><div><small>VALE #${String(r.vale_numero||'').padStart(4,'0')}</small><strong>${clientPortalMoney(r.amount)}</strong><span>${new Date(r.created_at).toLocaleString('pt-BR')}</span>${r.client_message?`<em>${clientPortalEsc(r.client_message)}</em>`:''}${r.review_note?`<em>Retorno: ${clientPortalEsc(r.review_note)}</em>`:''}</div><span class="badge text-bg-${meta.cls}"><i class="bi ${meta.icon}"></i> ${meta.label}</span></article>`}).join(''):'<div class="client-portal-empty"><i class="bi bi-clock-history"></i><strong>NENHUM PAGAMENTO INFORMADO</strong><span>Os pagamentos informados dos crediários ficam no modal de cada crediário.</span></div>';
 portal.classList.remove('hidden');
}
async function loadAndRenderClientPortal(profile,manual=false,background=false){
 const portal=ensureClientPortal();const message=el('clientPortalMessage');
 if(message&&!background)message.innerHTML='<div class="alert alert-primary"><i class="bi bi-arrow-repeat me-2"></i>CARREGANDO SEUS DADOS...</div>';
 try{
  const data=await ValleCloud.loadClientPortal();
  if(message)message.innerHTML='';
  renderClientPortal(data,ValleCloud.profile||profile);
  return true;
 }catch(err){
  if(message)message.innerHTML=`<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>${clientPortalEsc(err.message||'Não foi possível carregar sua conta.')}</div>`;
  if(manual)console.warn(err);
  return false;
 }
}
async function refreshClientPortalFromRealtime(source='database'){
 if(ValleCloud.profile?.role!=='client'||!ValleCloud.isOnline())return;
 if(clientPortalRealtimeRefreshRunning){clientPortalRealtimeRefreshPending=true;return}
 clientPortalRealtimeRefreshRunning=true;
 try{await loadAndRenderClientPortal(ValleCloud.profile,true,true)}finally{
  clientPortalRealtimeRefreshRunning=false;
  if(clientPortalRealtimeRefreshPending){clientPortalRealtimeRefreshPending=false;queueMicrotask(()=>{void refreshClientPortalFromRealtime(source)})}
 }
}
function installClientPortalRealtime(profile){
 if(!profile||profile.role!=='client')return;
 const key=String(profile.id||'');
 if(!key||clientPortalRealtimeInstalledFor===key)return;
 const channel=ValleCloud.subscribeClientPortalChanges?.((_row,_payload,source)=>{
  const state=ValleCloud.accessState?.();
  if(state&&!state.allowed)connectionToast(String(state.reason||'ACESSO BLOQUEADO').toUpperCase(),'error');
  void refreshClientPortalFromRealtime(source||'database');
 },status=>{
  if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')connectionToast('TEMPO REAL DA ÁREA DO CLIENTE INDISPONÍVEL. EXECUTE O SQL REALTIME_TOTAL_V102 NO SUPABASE.','warn');
 });
 if(channel)clientPortalRealtimeInstalledFor=key;
}
async function showClientPortal(profile){
 const app=document.querySelector('.app'),panel=el('managementPanel'),portal=ensureClientPortal();app?.classList.add('hidden');panel?.classList.add('hidden');portal.classList.remove('hidden');document.body.classList.add('client-portal-active');await loadAndRenderClientPortal(profile);installClientPortalRealtime(profile);
}

let baseRealtimeInstalledFor='';
let realtimeUsersRefreshRunning=false;
let realtimeUsersRefreshPending=false;
let realtimeAuditRefreshRunning=false;
let realtimeAuditRefreshPending=false;
let realtimeAccessClosing=false;
let realtimeGlobalWarningShown=false;

async function refreshManagedUsersFromRealtime(){
 if(!['admin','session'].includes(ValleCloud.profile?.role))return;
 if(realtimeUsersRefreshRunning){realtimeUsersRefreshPending=true;return}
 realtimeUsersRefreshRunning=true;
 try{await renderUsers({background:true})}finally{
  realtimeUsersRefreshRunning=false;
  if(realtimeUsersRefreshPending){realtimeUsersRefreshPending=false;queueMicrotask(()=>{void refreshManagedUsersFromRealtime()})}
 }
}
async function refreshManagementAuditFromRealtime(){
 if(ValleCloud.profile?.role!=='session')return;
 if(realtimeAuditRefreshRunning){realtimeAuditRefreshPending=true;return}
 realtimeAuditRefreshRunning=true;
 try{await renderAuditLogs()}finally{
  realtimeAuditRefreshRunning=false;
  if(realtimeAuditRefreshPending){realtimeAuditRefreshPending=false;queueMicrotask(()=>{void refreshManagementAuditFromRealtime()})}
 }
}
async function enforceRealtimeAccess(){
 const state=ValleCloud.accessState?.();
 if(!state||state.allowed||realtimeAccessClosing)return;
 realtimeAccessClosing=true;
 connectionToast(String(state.reason||'ACESSO BLOQUEADO').toUpperCase(),'error');
 try{await ValleCloud.signOut()}catch(_){ }
 location.reload();
}
function updateRealtimeIdentityUI(){
 const p=ValleCloud.profile;if(!p)return;
 if(['admin','session'].includes(p.role))setupManagementUserMenu(p);
 else if(p.role==='service')setupDashboardUserMenu(p);
}
function realtimeStatusGuard(status){
 if((status==='CHANNEL_ERROR'||status==='TIMED_OUT')&&!realtimeGlobalWarningShown){
  realtimeGlobalWarningShown=true;
  connectionToast('SINCRONIZAÇÃO EM TEMPO REAL INDISPONÍVEL. EXECUTE O SQL REALTIME_TOTAL_V102 NO SUPABASE.','warn');
 }
}
window.addEventListener('valle-signed-out',()=>{
 baseRealtimeInstalledFor='';
 clientPortalRealtimeInstalledFor='';
 adminMessageRealtimeInstalled=false;
 continuousSyncInstalled=false;
 realtimeAccessClosing=false;
 realtimeGlobalWarningShown=false;
});
function installBaseRealtime(profile){
 if(!profile||profile.role==='client')return;
 const key=`${profile.role}:${profile.id}`;
 if(baseRealtimeInstalledFor===key)return;
 baseRealtimeInstalledFor=key;
 ValleCloud.subscribeProfileChanges?.((row)=>{
  if(!row)return;
  const current=ValleCloud.profile;
  if(String(row.id||'')===String(current?.id||'') || String(row.id||'')===String(current?.session_user_id||'')){
   updateRealtimeIdentityUI();
   void enforceRealtimeAccess();
  }
  if(['admin','session'].includes(current?.role)){
   void refreshManagedUsersFromRealtime();
   if(current.role==='admin'&&!el('adminMessageModal')?.classList.contains('hidden'))void loadAdminMessageSessions();
  }
 },realtimeStatusGuard);
 if(profile.role==='session'){
  ValleCloud.subscribePermissionChanges?.(()=>{void refreshManagedUsersFromRealtime()},realtimeStatusGuard);
  ValleCloud.subscribeAuditChanges?.(()=>{void refreshManagementAuditFromRealtime()},realtimeStatusGuard);
 }
 if(profile.role==='admin'){
  ValleCloud.subscribeAdminMessageChanges?.(()=>{
   if(!el('adminMessageModal')?.classList.contains('hidden'))void renderAdminMessageHistory();
  },realtimeStatusGuard);
 }
}

async function showRole(profile,options={}){
 const app=document.querySelector('.app'); const gate=el('authGate'); const panel=el('managementPanel');
 gate.classList.add('hidden');
 document.documentElement.classList.remove('valle-auth-active');
 document.body.classList.remove('valle-auth-active');
 updateSyncBadge();
 await activateProfileTheme(profile);
 installBaseRealtime(profile);
 if(profile.role==='client'){
   await showClientPortal(profile);
 } else if(profile.role==='service'){
   hideServiceSettingsTab();
   panel.classList.add('hidden'); app.classList.remove('hidden');
   setupDashboardUserMenu(profile);
   installSaveHook();
   const snapshot=await ValleCloud.loadWorkspaceSnapshot({preferCache:!options.background});
   const remote=snapshot?.data||null;
   if(remote && window.normalizeDb){
     const loaded = window.replaceValleDatabase ? window.replaceValleDatabase(remote) : normalizeDb(remote);
     window.db = loaded;
     lastAppliedWorkspaceAt=snapshot.updated_at||null;
   } else {
     // Sessão nova: inicia vazia e grava diretamente no banco online.
     const theme='auto';
     let current={settings:{theme,seq:1,capitalInvestido:0,percentualJuros50:50,taxaAtrasoDiario:0,tipoTaxaAtrasoDiario:'percentual'},clientes:[],vales:[]};
     if(window.replaceValleDatabase) current=window.replaceValleDatabase(current);
     window.db=current;
     await ValleCloud.saveWorkspace(current);
     lastAppliedWorkspaceAt=ValleCloud.lastSyncedAt||null;
   }
   const perms=await ValleCloud.loadMyPermissions();
   applyServiceFinancialSettings(perms);
   applyPermissions(perms);
   if(window.renderAll) renderAll();
   installContinuousCloudSync();
 } else {
   app.classList.add('hidden'); panel.classList.remove('hidden');
   setupManagementUserMenu(profile);
   el('managementSubtitle').textContent=profile.role==='admin'?'Painel do administrador':'Painel do usuário de sessão';
   el('managementTitle').textContent=profile.role==='admin'?'Usuários de sessão':'Usuários de serviço';
   el('managementHelp').textContent=profile.role==='admin'?'Crie usuários de sessão, defina a validade e ative ou bloqueie o acesso.':'Crie usuários de serviço, defina permissões e ative ou bloqueie o acesso.';
   el('newManagedUserBtn').textContent=profile.role==='admin'?'NOVO USUÁRIO DE SESSÃO':'NOVO USUÁRIO DE SERVIÇO';
   const adminMessageButton=el('adminMessageBtn');
   const managementHeadActions=document.querySelector('#usersPanel .management-head-actions');
   const isAdminPanel=profile.role==='admin';
   if(adminMessageButton){
    adminMessageButton.classList.toggle('hidden',!isAdminPanel);
    adminMessageButton.hidden=!isAdminPanel;
    adminMessageButton.setAttribute('aria-hidden',String(!isAdminPanel));
   }
   managementHeadActions?.classList.toggle('management-head-actions-single',!isAdminPanel);
   await renderUsers({preferCache:!options.background,background:!!options.background});
   if(profile.role==='session'){
     await loadSharedWorkspaceForSession(profile,{preferCache:!options.background});
     installContinuousCloudSync();
   }
 }
 if(!options.background && ['session','service'].includes(profile.role)){
   window.setTimeout(()=>checkAdminMessageForUser(profile),350);
 }
}

let saveHooked=false;
let continuousSyncInstalled=false;
let lastAppliedWorkspaceAt=null;
let workspaceSyncInFlight=false;
let workspaceRealtimeWarningShown=false;
let pendingRealtimeWorkspaceRow=null;
function currentValleDatabase(){
 return window.getValleDatabase ? window.getValleDatabase() : window.db;
}
function installSaveHook(){
 if(saveHooked || typeof window.save!=='function') return;
 const original=window.save;
 window.__valleLocalSave=original;
 const withLocalFinancialSettings=(confirmed)=>{
   const copy=JSON.parse(JSON.stringify(confirmed||{}));
   const local=currentValleDatabase()||{};
   copy.settings={...(copy.settings||{})};
   ['percentualJuros50','percentualJuros','taxaAtrasoDiario','tipoTaxaAtrasoDiario'].forEach(key=>{
     if(local?.settings&&Object.prototype.hasOwnProperty.call(local.settings,key))copy.settings[key]=local.settings[key];
   });
   return copy;
 };
 window.save=function(){
   const r=original.apply(this,arguments);
   try{
     window.__valleLastSavePromise=ValleCloud.queueWorkspace(currentValleDatabase()).catch(()=>false);
   }catch(err){
     window.__valleLastSavePromise=Promise.resolve(false);
     window.ValleOperationUI?.fail?.(err.message||'Não foi possível iniciar a gravação.');
     throw err;
   }
   return r;
 };
 window.addEventListener('valle-workspace-confirmed',ev=>{
   const confirmed=ev.detail?.data;
   if(!confirmed)return;
   try{
     const safeConfirmed=withLocalFinancialSettings(confirmed);
     const applied=window.replaceValleDatabase?window.replaceValleDatabase(safeConfirmed):safeConfirmed;
     window.db=applied;
     original.call(window);
     if(ev.detail?.updated_at)lastAppliedWorkspaceAt=ev.detail.updated_at;
     if(window.renderAll)window.renderAll();
   }catch(error){console.error('Falha ao aplicar o estado confirmado pelo banco:',error)}
 });
 window.addEventListener('valle-workspace-write-failed',ev=>{
   const confirmed=ev.detail?.confirmed;
   if(!confirmed)return;
   try{
     const safeConfirmed=withLocalFinancialSettings(confirmed);
     const restored=window.replaceValleDatabase?window.replaceValleDatabase(safeConfirmed):safeConfirmed;
     window.db=restored;
     original.call(window);
     if(window.renderAll)window.renderAll();
   }catch(error){console.error('Falha ao restaurar o último estado confirmado:',error)}
 });
 saveHooked=true;
}
async function syncSharedWorkspaceFromCloud(realtimeRow=null){
 const role=ValleCloud.profile?.role;
 if(!['session','service'].includes(role)||!ValleCloud.isOnline())return false;
 if(workspaceSyncInFlight){
   if(realtimeRow?.data)pendingRealtimeWorkspaceRow=realtimeRow;
   return false;
 }
 workspaceSyncInFlight=true;
 try{
   // v3.6.102: quando o Supabase Realtime entrega a linha alterada, usa o
   // próprio payload do Postgres. Uma consulta direta só é feita ao voltar
   // de offline/segundo plano para reconciliar eventos que possam ter sido perdidos.
   const snapshot=(realtimeRow?.data && typeof realtimeRow.data==='object')
     ? {data:realtimeRow.data,updated_at:realtimeRow.updated_at||null,updated_by:realtimeRow.updated_by||null}
     : await ValleCloud.loadWorkspaceSnapshot({forceFresh:true});
   if(!snapshot?.data)return false;

   const current=currentValleDatabase()||{};
   const remoteSignature=ValleCloud.workspaceSignature?.(snapshot.data)||'';
   const localSignature=ValleCloud.workspaceSignature?.(current)||'';
   const contentChanged=!!remoteSignature && remoteSignature!==localSignature;

   // Sem mudança real no conteúdo do banco, não redesenha a interface.
   if(!contentChanged){
     if(snapshot.updated_at)lastAppliedWorkspaceAt=snapshot.updated_at;
     return false;
   }

   const loaded=window.replaceValleDatabase?window.replaceValleDatabase(snapshot.data):snapshot.data;
   window.db=loaded;
   if(snapshot.updated_at)lastAppliedWorkspaceAt=snapshot.updated_at;

   if(role==='service'){
     // Mantém as configurações financeiras individuais já carregadas neste aparelho.
     const permissions=await ValleCloud.loadMyPermissions({preferCache:true});
     applyServiceFinancialSettings(permissions);
     applyPermissions(permissions);
   }


   if(window.renderAll)renderAll();
   try{window.dispatchEvent(new CustomEvent('valle-workspace-remote-applied',{detail:{updated_at:snapshot.updated_at||null}}))}catch(_){}
   return true;
 }catch(e){
   console.warn('Não foi possível reconciliar os dados compartilhados da sessão:',e);
   return false;
 }finally{
   workspaceSyncInFlight=false;
   if(pendingRealtimeWorkspaceRow){
     const pending=pendingRealtimeWorkspaceRow;
     pendingRealtimeWorkspaceRow=null;
     queueMicrotask(()=>{ void syncSharedWorkspaceFromCloud(pending); });
   }
 }
}

function installContinuousCloudSync(){
 if(continuousSyncInstalled) return;
 continuousSyncInstalled=true;
 window.addEventListener('valle-cloud-sync',ev=>{
   if(ev.detail?.state==='synced'&&ev.detail?.lastSyncedAt)lastAppliedWorkspaceAt=ev.detail.lastSyncedAt;
 });

 // v3.6.102: sem polling. O workspace só é aplicado quando o Postgres publica
 // INSERT/UPDATE/DELETE em session_workspaces.
 try{
   ValleCloud.subscribeWorkspaceChanges?.(
     row=>{ if(row?.data) void syncSharedWorkspaceFromCloud(row); },
     status=>{
       if((status==='CHANNEL_ERROR'||status==='TIMED_OUT')&&!workspaceRealtimeWarningShown){
         workspaceRealtimeWarningShown=true;
         connectionToast('SINCRONIZAÇÃO EM TEMPO REAL INDISPONÍVEL. EXECUTE O SQL REALTIME_TOTAL_V102 NO SUPABASE.','warn');
       }
     }
   );
 }catch(e){console.warn('Realtime do workspace indisponível.',e)}

 // Permissões também passam a ser orientadas a evento do banco.
 if(ValleCloud.profile?.role==='service'){
   try{
     ValleCloud.subscribePermissionChanges?.(row=>{
       if(!row||String(row.service_user_id||'')!==String(ValleCloud.profile?.id||''))return;
       applyServiceFinancialSettings(row);
       applyPermissions(row);
     });
   }catch(e){console.warn('Realtime das permissões indisponível.',e)}
 }

 // Em celulares o WebSocket pode ser suspenso quando o app vai para segundo
 // plano. Ao voltar/recuperar internet, faz UMA reconciliação. A tela só é
 // redesenhada se a assinatura do conteúdo remoto for diferente da local.
 const reconcile=()=>{ if(ValleCloud.isOnline()) void syncSharedWorkspaceFromCloud(); };
 window.addEventListener('online',()=>setTimeout(reconcile,250),{passive:true});
 window.addEventListener('focus',reconcile,{passive:true});
 document.addEventListener('visibilitychange',()=>{
   if(document.visibilityState==='visible')reconcile();
 });
}

function applyPermissions(p){
 const map={
  can_view_dashboard:'dashboard',can_create_vale:'emprestimo',can_create_client:'clientes',can_view_history:'historico',can_view_reports:'relatorios',can_view_transactions:'lancamentos'
 };
 Object.entries(map).forEach(([key,screen])=>{
  const denied=p[key]===false;
  document.querySelectorAll(`[data-screen="${screen}"]`).forEach(x=>x.classList.toggle('permission-hidden',denied));
  document.getElementById(screen)?.classList.toggle('permission-hidden',denied);
  if(denied&&document.querySelector('.screen.active')?.id===screen)setTimeout(()=>window.switchScreen?.('dashboard'),0);
 });
 // A tela de Crediários reutiliza a permissão de Histórico para não exigir
 // alteração de schema/permissões no Supabase desta versão.
 const crediariosDenied=p.can_view_history===false;
 document.querySelectorAll('[data-screen="crediarios"]').forEach(x=>x.classList.toggle('permission-hidden',crediariosDenied));
 document.getElementById('crediarios')?.classList.toggle('permission-hidden',crediariosDenied);
 if(crediariosDenied&&document.querySelector('.screen.active')?.id==='crediarios')setTimeout(()=>window.switchScreen?.('dashboard'),0);
 window.VALLE_PERMISSIONS=p;
 window.applyVallePermissionVisibility?.();
}

function auditActionMeta(action){
 const map={CRIAR_CLIENTE:['success','bi-person-plus','Cliente criado'],ATUALIZAR_CLIENTE:['primary','bi-pencil-square','Cliente atualizado'],EXCLUIR_CLIENTE:['danger','bi-person-x','Cliente excluído'],CRIAR_VALE:['success','bi-file-earmark-plus','Vale criado'],ATUALIZAR_VALE:['primary','bi-pencil-square','Vale atualizado'],EXCLUIR_VALE:['danger','bi-trash','Vale excluído'],QUITAR_VALE:['success','bi-check-circle','Vale quitado'],PAGAMENTO_PARCIAL:['warning','bi-pie-chart','Pagamento parcial'],PAGAMENTO_JUROS:['info','bi-cash-coin','Pagamento de juros'],NAO_PAGOU:['secondary','bi-clock-history','Não pagou'],LISTA_NEGRA:['danger','bi-shield-exclamation','Lista negra'],PAGAMENTO_ENTRADA:['success','bi-cash-coin','Entrada de crediário'],REABRIR_VALE:['info','bi-unlock-fill','Vale reaberto']};
 return map[action]||['secondary','bi-activity',String(action||'Ação').replaceAll('_',' ')];
}
function auditFormatValue(v){if(v===null||v===undefined||v==='')return '—';if(typeof v==='boolean')return v?'Sim':'Não';if(typeof v==='number')return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(v);return String(v)}
function auditChangesHtml(x){const changes=x.changes||x.details?.changes||{};const entries=Object.entries(changes);if(!entries.length)return '<p class="audit-no-changes">Nenhuma alteração de campo registrada.</p>';return `<div class="audit-changes">${entries.map(([key,v])=>`<div><strong>${htmlEscape(v?.label||key)}</strong><span><del>${htmlEscape(auditFormatValue(v?.anterior))}</del><i class="bi bi-arrow-right"></i><ins>${htmlEscape(auditFormatValue(v?.novo))}</ins></span></div>`).join('')}</div>`}
function openAuditDetails(id){const x=(window.__valleAuditLogs||[]).find(v=>String(v.id||v.signature)===String(id));if(!x)return;const m=auditActionMeta(x.action);let modal=el('auditDetailModal');if(!modal){document.body.insertAdjacentHTML('beforeend','<div id="auditDetailModal" class="audit-detail-modal hidden"><div class="audit-detail-card"><button id="closeAuditDetail" class="modal-x">×</button><div id="auditDetailContent"></div></div></div>');modal=el('auditDetailModal');el('closeAuditDetail').onclick=()=>modal.classList.add('hidden');modal.onclick=e=>{if(e.target===modal)modal.classList.add('hidden')}}
 el('auditDetailContent').innerHTML=`<div class="audit-detail-head"><span class="badge text-bg-${m[0]}"><i class="bi ${m[1]}"></i> ${htmlEscape(m[2])}</span><h3>${htmlEscape(x.title||m[2])}</h3><p>${htmlEscape(x.description||'')}</p></div><dl class="audit-detail-grid"><div><dt>REALIZADO POR</dt><dd>${htmlEscape(x.actor_name||'')}<small>${htmlEscape(roleLabel(x.actor_role))}</small></dd></div><div><dt>DATA E HORA</dt><dd>${new Date(x.created_at).toLocaleString('pt-BR')}</dd></div><div><dt>REGISTRO</dt><dd>${htmlEscape(x.vale_number?`Vale #${x.vale_number}`:(x.client_name||x.entity_id||'—'))}</dd></div><div><dt>MÓDULO</dt><dd>${htmlEscape(x.module||x.entity_type||'SISTEMA')}</dd></div></dl><h4>ALTERAÇÕES</h4>${auditChangesHtml(x)}<div class="audit-signature"><i class="bi bi-shield-check"></i><div><strong>Assinatura eletrônica</strong><code>${htmlEscape(x.signature||x.details?.assinatura?.signedAt||'Não disponível')}</code></div></div>`;
 modal.classList.remove('hidden');
}

async function deleteAuditRecord(id){
 const logs=window.__valleAuditLogs||[];
 const record=logs.find(v=>String(v.id||v.signature)===String(id));
 if(!record)return;
 const label=record.vale_number?`Vale #${record.vale_number}`:(record.client_name||record.title||'este registro');
 const message=`Desfazer a ação registrada em “${label}”?

O sistema restaurará o estado anterior e depois removerá este registro da Auditoria e dos Lançamentos.`;
 const confirmed=window.appConfirm
  ? await appConfirm(message,{title:'Desfazer ação da auditoria?',icon:'↶',confirmText:'Desfazer',cancelText:'Cancelar'})
  : confirm(message);
 if(!confirmed)return;
 try{
  if(typeof window.valleUndoAuditRecord!=='function')throw new Error('O recurso de restauração não foi carregado. Atualize a página.');
  await window.valleUndoAuditRecord(record,logs);
  await ValleCloud.deleteAuditLog(id);
  window.__valleAuditLogs=logs.filter(v=>String(v.id||v.signature)!==String(id));
  drawAuditLogs();
  try{await window.renderLancamentos?.(true)}catch(_){ }
  toast('Ação desfeita e registro removido.');
 }catch(error){
  toast(error?.message||'Não foi possível desfazer este registro de auditoria.','error');
 }
}
let auditPageSize=50;
function applyAuditFilters(){const all=window.__valleAuditLogs||[];const q=(el('auditSearch')?.value||'').trim().toLowerCase();const user=el('auditUserFilter')?.value||'';const module=el('auditModuleFilter')?.value||'';const action=el('auditActionFilter')?.value||'';const from=el('auditDateFrom')?.value||'';const to=el('auditDateTo')?.value||'';return all.filter(x=>{const text=[x.actor_name,x.title,x.description,x.client_name,x.vale_number,x.entity_id,x.action].join(' ').toLowerCase();const day=String(x.created_at||'').slice(0,10);return(!q||text.includes(q))&&(!user||x.actor_user_id===user)&&(!module||x.module===module)&&(!action||x.action===action)&&(!from||day>=from)&&(!to||day<=to)}).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function drawAuditLogs(){const box=el('auditLogs');if(!box)return;const filtered=applyAuditFilters();const visible=filtered.slice(0,auditPageSize);el('auditSummary').textContent=`${filtered.length} registro${filtered.length===1?'':'s'} encontrado${filtered.length===1?'':'s'} · mais recentes primeiro`;el('loadMoreAudit')?.classList.toggle('hidden',visible.length>=filtered.length);box.innerHTML=visible.length?`<div class="audit-timeline">${visible.map(x=>{const m=auditActionMeta(x.action);const auditId=htmlEscape(String(x.id||x.signature));return `<article class="audit-item border-start border-4 border-${m[0]}"><div class="audit-icon text-bg-${m[0]}"><i class="bi ${m[1]}"></i></div><div class="audit-item-main"><div class="audit-item-top"><div><span class="badge text-bg-${m[0]}">${htmlEscape(m[2])}</span><h3>${htmlEscape(x.title||m[2])}</h3></div><time>${new Date(x.created_at).toLocaleDateString('pt-BR')}<small>${new Date(x.created_at).toLocaleTimeString('pt-BR')}</small></time></div><p>${htmlEscape(x.description||'')}</p><div class="audit-item-meta"><span><i class="bi bi-person"></i>${htmlEscape(x.actor_name||'')}</span>${x.client_name?`<span><i class="bi bi-person-vcard"></i>${htmlEscape(x.client_name)}</span>`:''}${x.vale_number?`<span><i class="bi bi-receipt"></i>Vale #${htmlEscape(x.vale_number)}</span>`:''}</div><div class="audit-item-actions"><button class="btn btn-sm btn-outline-${m[0]}" data-audit-detail="${auditId}"><i class="bi bi-eye"></i><span>VER DETALHES</span></button><button class="btn btn-sm audit-delete-btn" data-audit-delete="${auditId}"><i class="bi bi-arrow-counterclockwise"></i><span>DESFAZER</span></button></div></div></article>`}).join('')}</div>`:'<div class="empty-users">Nenhum registro encontrado com os filtros informados.</div>';box.querySelectorAll('[data-audit-detail]').forEach(b=>b.onclick=()=>openAuditDetails(b.dataset.auditDetail));box.querySelectorAll('[data-audit-delete]').forEach(b=>b.onclick=()=>deleteAuditRecord(b.dataset.auditDelete))}
async function renderAuditLogs(){
 const panel=el('auditPanel'),box=el('auditLogs'); if(!panel||ValleCloud.profile?.role!=='session')return; panel.classList.remove('hidden'); applyAuditMonthPeriod(); box.innerHTML='<p>Carregando logs...</p>';
 try{const logs=await ValleCloud.listAuditLogs(1000);window.__valleAuditLogs=logs||[];const users=[...new Map(logs.map(x=>[x.actor_user_id,x.actor_name])).entries()];const actions=[...new Set(logs.map(x=>x.action).filter(Boolean))].sort();el('auditUserFilter').innerHTML='<option value="">Todos os usuários</option>'+users.map(([id,n])=>`<option value="${htmlEscape(id)}">${htmlEscape(n)}</option>`).join('');el('auditActionFilter').innerHTML='<option value="">Todas as ações</option>'+actions.map(a=>`<option value="${htmlEscape(a)}">${htmlEscape(a.replaceAll('_',' '))}</option>`).join('');auditPageSize=50;drawAuditLogs()}catch(e){box.innerHTML=`<div class="auth-message error">${htmlEscape(e.message)}</div>`}
}
async function renderUsers(options={}){
 const box=el('managedUsers'); if(!options.background) box.innerHTML='<p>Carregando...</p>';
 try{
  const users=await ValleCloud.listManagedUsers({preferCache:!!options.preferCache});
  if(!users.length){box.innerHTML='<div class="empty-users">Nenhum usuário cadastrado.</div>';return;}
  const permissionMap={};
  if(ValleCloud.profile?.role==='session'){
   await Promise.all(users.map(async u=>{permissionMap[u.id]=await ValleCloud.getPermissions(u.id,{preferCache:!!options.preferCache})}));
  }
  box.innerHTML=users.map(u=>userCard(u,[],permissionMap[u.id])).join('');
  box.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>openEdit(b.dataset.editUser,users));
  box.querySelectorAll('[data-toggle-user]').forEach(b=>b.onclick=()=>toggleUser(b.dataset.toggleUser,b.dataset.active!=='true'));
  box.querySelectorAll('[data-delete-user]').forEach(b=>b.onclick=()=>deleteManagedUser(b.dataset.deleteUser,users));
  renderAuditLogs();
 }catch(e){box.innerHTML=`<div class="auth-message error">${htmlEscape(e.message)}</div>`}
}
function userCard(u,children,financial){
 const expired=u.role==='session'&&u.valid_until&&u.valid_until<new Date().toISOString().slice(0,10);
 const statusText=u.active&&!expired?'ATIVO':'BLOQUEADO';
 const roleLabel=u.role==='session'?'SESSÃO':'SERVIÇO';
 const extraMeta=u.role==='session'
  ? `<span class="user-meta-chip user-validity-chip"><i class="bi bi-calendar3"></i><span>VALIDADE: ${u.valid_until?new Date(u.valid_until+'T00:00:00').toLocaleDateString('pt-BR'):'SEM VALIDADE'}${expired?' · VENCIDA':''}</span></span>`
  : `<span class="user-meta-chip user-interest-chip"><i class="bi bi-percent"></i><span>JUROS CONFIGURÁVEL: ${Number(financial?.interest_percent??30).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</span></span>`;
 return `<article class="user-card ${!u.active||expired?'blocked':''} ${u.role==='session'?'is-session':'is-service'}">
   <div class="user-card-top">
     <div class="user-main">
       <div class="user-avatar">${htmlEscape((u.name||'?')[0])}</div>
       <div class="user-copy">
         <div class="user-copy-top">
           <h3>${htmlEscape(u.name)}</h3>
           <span class="status-pill ${u.active&&!expired?'on':'off'}">${statusText}</span>
         </div>
         <p class="user-email">${htmlEscape(u.email||'')}</p>
         <div class="user-meta-row">
           <span class="user-meta-chip user-role-chip"><i class="bi ${u.role==='session'?'bi-person-badge':'bi-person-workspace'}"></i><span>${roleLabel}</span></span>
           ${extraMeta}
         </div>
       </div>
     </div>
   </div>
   <div class="user-actions">
     <button class="btn light" data-edit-user="${u.id}"><i class="bi bi-pencil-square"></i><span>EDITAR</span></button>
     <button class="btn ${u.active?'danger':'success'}" data-toggle-user="${u.id}" data-active="${u.active}"><i class="bi ${u.active?'bi-slash-circle':'bi-check-circle'}"></i><span>${u.active?'BLOQUEAR':'ATIVAR'}</span></button>
     <button class="btn delete-user-btn" data-delete-user="${u.id}" title="Excluir usuário"><i class="bi bi-trash3"></i><span>EXCLUIR</span></button>
   </div>
   ${children.length?`<div class="hierarchy-children"><b>Usuários de serviço</b>${children.map(c=>`<div><span>${htmlEscape(c.name)} <small>${htmlEscape(c.email||'')}</small></span><em class="${c.active?'on':'off'}">${c.active?'ATIVO':'BLOQUEADO'}</em></div>`).join('')}</div>`:''}
 </article>`;
}

function configureManagedForm(role, editing=false){
 const isAdmin=ValleCloud.profile.role==='admin';
 const isSession=ValleCloud.profile.role==='session';
 const validity=el('managedValidityWrap');
 const whatsapp=el('managedWhatsappWrap');
 const whatsappInput=el('managedWhatsapp');
 const perms=el('permissionsBox');
 const financial=el('serviceFinancialBox');
 // Validade e WhatsApp pertencem somente ao painel do administrador.
 validity.classList.toggle('hidden',!isAdmin);
 whatsapp.classList.toggle('hidden',!isAdmin);
 validity.hidden=!isAdmin;
 whatsapp.hidden=!isAdmin;
 validity.style.setProperty('display',isAdmin?'flex':'none','important');
 whatsapp.style.setProperty('display',isAdmin?'flex':'none','important');
 if(whatsappInput){
  whatsappInput.disabled=!isAdmin;
  whatsappInput.required=false;
 }
 perms.classList.toggle('hidden',!isSession);
 perms.style.display=isSession?'':'none';
 financial.classList.toggle('hidden',!isSession);
 financial.style.display=isSession?'':'none';
 if(!isAdmin){el('managedValidity').value='';el('managedWhatsapp').value='';}
 // O ADM, ao editar, administra apenas validade/status. Dados de identidade ficam protegidos.
 el('managedName').disabled=isAdmin&&editing;
 el('managedEmail').disabled=editing;
 el('managedPasswordLabel').classList.toggle('hidden',editing);
}
function openNew(){
 el('userForm').reset(); el('managedId').value=''; el('managedInterestPercent').value='30';
 const admin=ValleCloud.profile.role==='admin';
 el('userModalTitle').textContent=admin?'Novo usuário de sessão':'Novo usuário de serviço';
 const subtitle=el('userModalSubtitle'); if(subtitle)subtitle.textContent=admin?'Cadastre uma nova sessão e defina a validade de acesso.':'Cadastre um usuário de serviço e configure suas permissões.';
 const saveBtn=document.querySelector('#userForm .btn.primary span'); if(saveBtn)saveBtn.textContent='SALVAR';
 configureManagedForm(admin?'session':'service',false);
 syncUserModalViewport();
 document.body.classList.add('user-modal-open');
 el('userModal').classList.remove('hidden');
}
async function openEdit(id,users){
 const u=users.find(x=>x.id===id); if(!u)return;
 const callerRole=ValleCloud.profile.role;
 if((callerRole==='admin'&&u.role!=='session')||(callerRole==='session'&&u.role!=='service')){
  toast('Você não tem permissão para administrar este tipo de usuário.', 'warn'); return;
 }
 el('managedId').value=u.id;el('managedName').value=u.name||'';el('managedEmail').value=u.email||'';el('managedPassword').value='';el('managedValidity').value=u.valid_until||'';el('managedWhatsapp').value=u.admin_whatsapp||'';
 el('userModalTitle').textContent=callerRole==='admin'?'Administrar usuário de sessão':'Administrar usuário de serviço';
 const subtitle=el('userModalSubtitle'); if(subtitle)subtitle.textContent=callerRole==='admin'?'Atualize a validade desta sessão.':'Atualize os dados, juros e permissões deste usuário.';
 const saveBtn=document.querySelector('#userForm .btn.primary span'); if(saveBtn)saveBtn.textContent='ATUALIZAR';
 configureManagedForm(u.role,true);
 if(u.role==='service'){
  const p=await ValleCloud.getPermissions(u.id);
  document.querySelectorAll('[data-perm]').forEach(x=>x.checked=p[x.dataset.perm]!==false);
  el('managedInterestPercent').value=String(Number(p.interest_percent??30));
 }
 syncUserModalViewport();
 document.body.classList.add('user-modal-open');
 el('userModal').classList.remove('hidden');
}
function closeModal(){
 document.body.classList.remove('user-modal-open');
 el('userModal').classList.add('hidden');
 el('managedName').disabled=false;el('managedEmail').disabled=false;el('managedPasswordLabel').classList.remove('hidden');
}
async function toggleUser(id,active){try{await ValleCloud.invokeManage('update',{userId:id,active});await renderUsers()}catch(e){toast(e.message || 'Erro ao realizar a operação.', 'error')}}

async function deleteManagedUser(id,users){
 const user=users.find(x=>x.id===id); if(!user)return;
 const isSession=user.role==='session';
 const message=isSession
  ? `Excluir permanentemente o usuário de sessão "${user.name}"? Todos os usuários de serviço, permissões e dados vinculados a essa sessão também serão apagados. Esta ação não pode ser desfeita.`
  : `Excluir permanentemente o usuário de serviço "${user.name}"? As permissões e os dados vinculados a ele também serão apagados. Esta ação não pode ser desfeita.`;
 const ok=window.appConfirm
  ? await appConfirm(message,{title:isSession?'Excluir sessão e hierarquia?':'Excluir usuário de serviço?',icon:'🗑️',confirmText:'Excluir',cancelText:'Cancelar'})
  : confirm(message);
 if(!ok)return;
 try{
  await ValleCloud.invokeManage('delete',{userId:id});
  await renderUsers();
 }catch(e){toast(e.message || 'Erro ao realizar a operação.', 'error')}
}

async function saveManaged(e){
 e.preventDefault();
 const id=el('managedId').value;
 const callerRole=ValleCloud.profile.role;
 const role=callerRole==='admin'?'session':'service';
 const payload={
  userId:id||undefined,
  role
 };
 if(!id)payload.active=true;
 if(!id){
  payload.name=el('managedName').value.trim();
  payload.email=el('managedEmail').value.trim();
  payload.password=el('managedPassword').value;
 }
 if(callerRole==='admin'){
  payload.validUntil=el('managedValidity').value||null;
  payload.adminWhatsapp=el('managedWhatsapp').value.trim()||null;
 } else {
  // Usuário de sessão pode manter o nome do usuário de serviço atualizado.
  payload.name=el('managedName').value.trim();
  payload.interestPercent=Math.max(0,Number(String(el('managedInterestPercent').value||'30').replace(',','.'))||0);
 }
 if(callerRole==='session') payload.interestPercent=Math.max(0,Number(String(el('managedInterestPercent').value||'30').replace(',','.'))||0);
 try{
  const result=await ValleCloud.invokeManage(id?'update':'create',payload); const uid=id||result.userId;
  if(callerRole==='session'){
   const perms={interest_percent:payload.interestPercent};document.querySelectorAll('[data-perm]').forEach(x=>perms[x.dataset.perm]=x.checked);
   await ValleCloud.savePermissions(uid,perms);
  }
  closeModal(); await renderUsers();
 }catch(err){toast(err.message || 'Erro ao realizar a operação.', 'error')}
}
function setupManagementTheme(){
 const theme=readStoredTheme(null)||'auto';
 applyUserTheme(theme,null);
 bindThemePicker(document.querySelector('[data-theme-picker="auth"]'),persistUserTheme);
 if(!document.documentElement.dataset.themePickerOutsideBound){
  document.documentElement.dataset.themePickerOutsideBound='1';
  document.addEventListener('click',ev=>{if(!ev.target.closest('[data-theme-picker]'))closeThemePickers()});
 }
}

async function boot(){
 inject(); setupManagementTheme(); document.querySelector('.app').classList.add('hidden');
 // A biblioteca remota do Supabase não bloqueia mais todo o HTML. Espera
 // apenas um curto período para restaurar uma sessão já salva.
 let supabaseReady=true;
 if(window.VALLE_SUPABASE_READY){
  supabaseReady=await Promise.race([
   window.VALLE_SUPABASE_READY,
   new Promise(resolve=>setTimeout(()=>resolve(false),1200))
  ]);
 }
 updateSyncBadge({state:ValleCloud.syncState,online:ValleCloud.isOnline()});
 window.addEventListener('valle-cloud-sync',e=>updateSyncBadge(e.detail||{}));
 window.addEventListener('online',()=>{updateSyncBadge({state:'syncing',online:true});connectionToast('Internet conectada.','success')});
 window.addEventListener('offline',()=>{updateSyncBadge({state:'offline',online:false});connectionToast('Internet desconectada. Alterações no banco ficam bloqueadas até a conexão voltar.','warn')});
 el('loginForm').onsubmit=async e=>{
  e.preventDefault();setMsg('Entrando...',false);el('authWhatsapp').classList.add('hidden');
  try{
   if(!window.supabase&&window.VALLE_SUPABASE_READY){
    setMsg('Conectando com segurança...',false);
    await Promise.race([window.VALLE_SUPABASE_READY,new Promise(resolve=>setTimeout(resolve,5000))]);
   }
   const p=await ValleCloud.signIn(el('loginEmail').value,el('loginPassword').value);setMsg('');await showRole(p);
  }catch(err){setMsg(err.message);if(err.whatsapp){const a=el('authWhatsapp');a.href=whatsappLink(err.whatsapp);a.classList.remove('hidden')}}
 };
 el('logoutBtn').onclick=async()=>{await ValleCloud.signOut();location.reload()};el('newManagedUserBtn').onclick=openNew;el('closeUserModal').onclick=closeModal;el('cancelUserModal').onclick=closeModal;el('userForm').onsubmit=saveManaged;
 el('adminMessageBtn').onclick=openAdminMessageComposer;el('adminMessageForm').onsubmit=submitAdminMessage;el('systemUpdateMessageClose').onclick=closeSystemUpdateMessage;
 installAdminMessageWatcher();
 document.addEventListener('click',async event=>{
  if(event.target.closest('[data-admin-message-close]'))closeAdminMessageComposer();
  const use=event.target.closest('[data-admin-message-use]');
  if(use){usePreviousAdminMessage(use.dataset.adminMessageUse);return}
  const disable=event.target.closest('[data-admin-message-disable]');
  if(disable){disable.disabled=true;try{await ValleCloud.deactivateAdminMessage(disable.dataset.adminMessageDisable);await renderAdminMessageHistory()}catch(err){connectionToast(err.message||'Não foi possível desativar a mensagem.','error')}finally{disable.disabled=false}}
  const remove=event.target.closest('[data-admin-message-delete]');
  if(remove){
   const confirmed=window.confirm('DESEJA EXCLUIR ESTA MENSAGEM?');
   if(!confirmed)return;
   remove.disabled=true;
   try{await ValleCloud.deleteAdminMessage(remove.dataset.adminMessageDelete);connectionToast('MENSAGEM EXCLUÍDA.','success');await renderAdminMessageHistory()}
   catch(err){connectionToast(err.message||'Não foi possível excluir a mensagem.','error')}
   finally{remove.disabled=false}
  }
 });
 try{
  const p=await ValleCloud.restoreSession();
  if(p?.blocked){
    setMsg(p.reason);
    if(p.whatsapp){const a=el('authWhatsapp');a.href=whatsappLink(p.whatsapp);a.classList.remove('hidden')}
  }else if(p){
    await showRole(p);
    if(typeof window.preloadValleAllData==='function') await window.preloadValleAllData();
  }
 }catch(e){
  setMsg(e.message);
 }finally{
  window.__VALLE_APP_READY__ = true;
  window.dispatchEvent(new CustomEvent('valle-app-ready'));
 }
 // Se a conexão demorou mais que 1,2 s, tenta restaurar a sessão depois sem
 // prender novamente a tela de carregamento nem interromper quem está digitando.
 if(!supabaseReady&&window.VALLE_SUPABASE_READY){
  window.VALLE_SUPABASE_READY.then(async ready=>{
   if(!ready||!loginIsVisible()||el('loginEmail')?.value||el('loginPassword')?.value)return;
   try{const p=await ValleCloud.restoreSession();if(p&&!p.blocked)await showRole(p)}catch(_){}
  });
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
