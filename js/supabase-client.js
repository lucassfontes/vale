(function(){
  'use strict';
  const cfg = window.VALLE_SUPABASE_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(cfg.url || '') && !String(cfg.anonKey || '').includes('COLE_AQUI');
  const CACHE_PREFIX = 'valle_offline_v1_';
  let client = null;
  let profile = null;
  let sessionProfile = null;
  let syncTimer = null;
  let loadingRemote = false;
  let syncState = navigator.onLine ? 'idle' : 'offline';
  let lastSyncError = null;
  let lastSyncedAt = null;
  let onlineHandlerInstalled = false;

  function getClient(){
    if (!configured || !window.supabase?.createClient) return null;
    if (!client) client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  function safeGet(key, fallback=null){
    try { const raw = localStorage.getItem(CACHE_PREFIX + key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }
  function safeSet(key, value){
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('Não foi possível gravar o cache offline:', e); return false; }
  }
  function safeRemove(key){ try { localStorage.removeItem(CACHE_PREFIX + key); } catch (_) {} }
  function currentSessionId(){
    if (!profile) return null;
    return profile.role === 'session' ? profile.id : profile.session_user_id || null;
  }
  function profileCacheKey(id){ return `profile_${id}`; }
  function sessionProfileCacheKey(id){ return `session_profile_${id}`; }
  function workspaceCacheKey(id){ return `workspace_${id}`; }
  function pendingCacheKey(id){ return `pending_workspace_${id}`; }
  function permissionsCacheKey(id){ return `permissions_${id}`; }

  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function isExpired(date){ return !!date && String(date).slice(0,10) < todayISO(); }
  function normalizePhone(v){ return String(v || '').replace(/\D/g,''); }
  function isOnline(){ return navigator.onLine !== false; }
  function clone(value){ try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; } }
  function withTimeout(task, milliseconds, message='A conexão demorou mais que o esperado.') {
    let timer;
    return Promise.race([
      Promise.resolve(task),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
    ]).finally(() => clearTimeout(timer));
  }

  async function getCurrentAuth(){
    const c = getClient();
    if (!c) return null;
    // getSession usa a sessão persistida no aparelho e continua funcionando offline.
    const sessionResult = await c.auth.getSession();
    if (sessionResult?.data?.session?.user) return sessionResult.data.session.user;
    if (!isOnline()) return null;
    const { data, error } = await c.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  }

  async function loadProfile(userId){
    const c = getClient();
    if (!c) throw new Error('Supabase não configurado.');
    const cached = safeGet(profileCacheKey(userId));
    if (!isOnline()) {
      if (!cached) throw new Error('Primeiro acesso deste usuário precisa ser feito com internet.');
      profile = cached;
      sessionProfile = profile.role === 'service'
        ? safeGet(sessionProfileCacheKey(profile.session_user_id))
        : (profile.role === 'session' ? profile : null);
      return profile;
    }
    try {
      const profileRequest = c.from('profiles').select('*').eq('id', userId).maybeSingle();
      const res = cached
        ? await withTimeout(profileRequest, 1800, 'Usando o perfil salvo neste aparelho.')
        : await profileRequest;
      if (res.error) throw res.error;

      if (res.data) {
        const data=res.data;
        profile = data;
        safeSet(profileCacheKey(userId), data);
        sessionProfile = null;
        if (data.role === 'service' && data.session_user_id) {
          const cachedSession = safeGet(sessionProfileCacheKey(data.session_user_id));
          const sessionRequest = c.from('profiles').select('*').eq('id', data.session_user_id).single();
          const sessionRes = cachedSession
            ? await withTimeout(sessionRequest, 1400, 'Usando a sessão salva neste aparelho.')
            : await sessionRequest;
          if (sessionRes.error) throw sessionRes.error;
          sessionProfile = sessionRes.data;
          safeSet(sessionProfileCacheKey(data.session_user_id), sessionRes.data);
        } else if (data.role === 'session') {
          sessionProfile = data;
          safeSet(sessionProfileCacheKey(data.id), data);
        }
        return data;
      }

      // Cliente não ocupa a hierarquia profiles/admin/session/service.
      // Sua conta fica isolada em client_accounts para impedir acesso ao workspace completo.
      const clientRes=await c.from('client_accounts')
        .select('user_id,session_user_id,client_id,name,email,active,created_at,updated_at')
        .eq('user_id',userId).maybeSingle();
      if(clientRes.error)throw clientRes.error;
      if(!clientRes.data)throw new Error('Perfil não encontrado.');
      const a=clientRes.data;
      profile={id:a.user_id,name:a.name,email:a.email,role:'client',session_user_id:a.session_user_id,client_id:a.client_id,active:a.active,user_theme:'auto'};
      sessionProfile=null;
      safeSet(profileCacheKey(userId),profile);
      return profile;
    } catch (err) {
      if (!cached) throw err;
      profile = cached;
      sessionProfile = profile.role === 'service'
        ? safeGet(sessionProfileCacheKey(profile.session_user_id))
        : (profile.role === 'session' ? profile : null);
      return profile;
    }
  }

  function accessState(){
    if (!profile) return { allowed:false, reason:'Perfil não encontrado.' };
    const base = profile.role === 'service' ? sessionProfile : profile;
    if (!profile.active) return { allowed:false, reason:'Usuário bloqueado.', whatsapp: base?.admin_whatsapp };
    if ((profile.role === 'session' || profile.role === 'service') && (!base?.active || isExpired(base?.valid_until))) {
      return { allowed:false, reason:'Sessão interrompida. Fale com o administrador.', whatsapp: base?.admin_whatsapp };
    }
    return { allowed:true };
  }

  async function signIn(email, password){
    const c = getClient();
    if (!c) throw new Error('Supabase ainda não foi configurado. Preencha js/supabase-config.js.');
    if (!isOnline()) throw new Error('Para entrar pela primeira vez, conecte-se à internet. Depois o sistema continuará disponível offline neste aparelho.');
    const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    await loadProfile(data.user.id);
    const state = accessState();
    if (!state.allowed) {
      await c.auth.signOut();
      const err = new Error(state.reason);
      err.whatsapp = state.whatsapp;
      throw err;
    }
    return profile;
  }

  async function restoreSession(){
    const user = await getCurrentAuth();
    if (!user) return null;
    await loadProfile(user.id);
    const state = accessState();
    if (!state.allowed) {
      // Offline não encerra a sessão, pois isso apagaria o acesso local. O bloqueio
      // continuará sendo conferido assim que a conexão voltar.
      if (isOnline()) await getClient().auth.signOut();
      return { blocked:true, ...state };
    }
    installOnlineHandlers();
    return profile;
  }

  async function verifyCurrentPassword(password){
    const value = String(password || '');
    if (!value) throw new Error('Digite a senha para continuar.');
    if (!isOnline()) throw new Error('A confirmação da senha precisa de internet.');
    const c = getClient();
    if (!c) throw new Error('Supabase não configurado.');
    const currentUser = await getCurrentAuth();
    if (!currentUser?.email) throw new Error('Não foi possível identificar o usuário conectado.');
    const currentUserId = currentUser.id;
    const { data, error } = await c.auth.signInWithPassword({
      email: currentUser.email,
      password: value
    });
    if (error || !data?.user || data.user.id !== currentUserId) {
      throw new Error('Senha incorreta.');
    }
    return true;
  }

  async function signOut(){
    if (getClient()) await getClient().auth.signOut();
    profile = null; sessionProfile = null;
  }

  async function setMyTheme(theme){
    const value = ['auto','light','dark'].includes(theme) ? theme : 'auto';
    if (profile) {
      profile.user_theme = value;
      safeSet(profileCacheKey(profile.id), profile);
    }
    if (!isOnline()) return value;
    const { data, error } = await getClient().rpc('set_my_theme', { new_theme:value });
    if (error) {
      // Em bancos ainda não atualizados para a v39, o modo automático continua
      // funcionando neste aparelho e será sincronizado após executar a migração.
      if (value === 'auto') {
        console.warn('Atualize o Supabase com TEMA_AUTOMATICO_V39.sql para sincronizar o tema automático entre aparelhos.', error);
        return value;
      }
      throw error;
    }
    return data || value;
  }

  function cachedWorkspaceSnapshot(){
    const sid = currentSessionId();
    return sid ? safeGet(workspaceCacheKey(sid)) : null;
  }

  async function loadWorkspaceSnapshot(options={}){
    if (!profile || !['session','service'].includes(profile.role)) return null;
    const sid = currentSessionId();
    const cached = cachedWorkspaceSnapshot();
    if (!isOnline() || (options.preferCache && cached)) return cached;
    loadingRemote = true;
    try {
      const request = getClient()
        .from('session_workspaces')
        .select('data,updated_at,updated_by')
        .eq('session_user_id', sid)
        .maybeSingle();
      const { data, error } = cached
        ? await withTimeout(request, 1800, 'Usando os dados salvos neste aparelho.')
        : await request;
      if (error) throw error;
      if (data) {
        if (data.updated_at) lastSyncedAt = data.updated_at;
        safeSet(workspaceCacheKey(sid), data);
      }
      return data || cached;
    } catch (err) {
      lastSyncError = err.message || String(err);
      return cached;
    } finally { loadingRemote = false; }
  }

  async function loadWorkspace(){
    const snapshot = await loadWorkspaceSnapshot();
    return snapshot?.data || null;
  }

  function emitSyncState(){
    window.dispatchEvent(new CustomEvent('valle-cloud-sync', { detail:{
      state: syncState,
      error: lastSyncError,
      lastSyncedAt,
      online: isOnline(),
      pending: !!(currentSessionId() && safeGet(pendingCacheKey(currentSessionId())))
    }}));
  }

  function sanitizeWorkspace(data){
    let completeData = data && typeof data === 'object' ? clone(data) : {};
    try {
      if (completeData.settings) {
        // Configurações financeiras são individuais de cada usuário de serviço
        // e ficam em service_permissions, não no workspace compartilhado.
        delete completeData.settings.percentualJuros50;
        delete completeData.settings.percentualJuros;
        delete completeData.settings.taxaAtrasoDiario;
        delete completeData.settings.tipoTaxaAtrasoDiario;
      }
    } catch (_) {}
    return completeData;
  }

  function storePending(data){
    const sid = currentSessionId();
    if (!sid) return false;
    const now = new Date().toISOString();
    const pending = { data:sanitizeWorkspace(data), queued_at:now, updated_by:profile?.id || null };
    safeSet(pendingCacheKey(sid), pending);
    safeSet(workspaceCacheKey(sid), { data:pending.data, updated_at:now, updated_by:pending.updated_by, offline:true });
    syncState = 'offline';
    lastSyncError = null;
    emitSyncState();
    return true;
  }

  async function pushWorkspace(data, queuedAt=null){
    const sid = currentSessionId();
    if (!sid) return false;
    const completeData = sanitizeWorkspace(data);
    const payload = {
      session_user_id: sid,
      updated_by: profile.id,
      data: completeData,
      updated_at: queuedAt || new Date().toISOString()
    };
    const { error } = await getClient().from('session_workspaces').upsert(payload, { onConflict:'session_user_id' });
    if (error) throw error;
    safeSet(workspaceCacheKey(sid), { data:completeData, updated_at:payload.updated_at, updated_by:profile.id });
    safeRemove(pendingCacheKey(sid));
    syncState = 'synced';
    lastSyncedAt = payload.updated_at;
    lastSyncError = null;
    emitSyncState();
    return true;
  }

  async function saveWorkspaceStrict(data){
    if (loadingRemote || !profile || !['session','service'].includes(profile.role)) {
      throw new Error('Não foi possível identificar a sessão para restaurar os dados.');
    }
    if (!isOnline()) throw new Error('Para desfazer uma ação da auditoria, conecte-se à internet.');
    syncState = 'syncing'; lastSyncError = null; emitSyncState();
    try { return await pushWorkspace(data); }
    catch (error) {
      syncState = 'offline';
      lastSyncError = error.message || String(error);
      emitSyncState();
      throw error;
    }
  }

  async function saveWorkspace(data){
    if (loadingRemote || !profile || !['session','service'].includes(profile.role)) return false;
    // A alteração é gravada localmente antes de qualquer tentativa de rede.
    storePending(data);
    if (!isOnline()) return true;
    syncState = 'syncing'; lastSyncError = null; emitSyncState();
    try {
      const pending = safeGet(pendingCacheKey(currentSessionId()));
      return await pushWorkspace(pending?.data || data, pending?.queued_at || null);
    } catch (error) {
      syncState = 'offline';
      lastSyncError = error.message || String(error);
      emitSyncState();
      console.warn('Alteração guardada no aparelho; será enviada quando a internet voltar:', error);
      return true;
    }
  }

  async function syncPendingWorkspace(){
    if (!profile || !isOnline()) return false;
    const sid = currentSessionId();
    const pending = sid ? safeGet(pendingCacheKey(sid)) : null;
    if (!pending?.data) return false;
    syncState = 'syncing'; lastSyncError = null; emitSyncState();
    try { return await pushWorkspace(pending.data, pending.queued_at || null); }
    catch (error) {
      syncState = 'offline'; lastSyncError = error.message || String(error); emitSyncState();
      return false;
    }
  }

  function queueWorkspace(data){
    clearTimeout(syncTimer);
    const snapshot = clone(data || {});
    // Grava imediatamente a fila local; o debounce é usado apenas no envio.
    storePending(snapshot);
    syncTimer = setTimeout(() => saveWorkspace(snapshot), 450);
  }

  async function flushWorkspace(data){
    clearTimeout(syncTimer);
    return saveWorkspace(data);
  }

  function installOnlineHandlers(){
    if (onlineHandlerInstalled) return;
    onlineHandlerInstalled = true;
    window.addEventListener('online', async()=>{
      syncState = 'syncing'; emitSyncState();
      try {
        if (profile?.id) await loadProfile(profile.id); // revalida bloqueio e validade
        await syncPendingWorkspace();
        if (profile?.id) await flushPendingAuditLogs(currentSessionId());
        if (syncState !== 'synced') { syncState='idle'; emitSyncState(); }
      } catch (e) {
        syncState='offline'; lastSyncError=e.message||String(e); emitSyncState();
      }
    });
    window.addEventListener('offline', ()=>{ syncState='offline'; emitSyncState(); });
  }

  async function invokeManage(action, payload={}){
    if (!isOnline()) throw new Error('Esta ação administrativa precisa de internet.');
    const c = getClient();
    const { data, error } = await c.functions.invoke(cfg.manageUserFunction || 'manage-user', { body:{ action, ...payload } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function createAdminMessage(payload={}){
    if (!profile || profile.role !== 'admin') throw new Error('Somente o administrador pode enviar mensagens.');
    if (!isOnline()) throw new Error('O envio da mensagem precisa de internet.');
    const title=String(payload.title||'ATUALIZAÇÃO DO SISTEMA').trim()||'ATUALIZAÇÃO DO SISTEMA';
    const message=String(payload.message||'').trim();
    if (!message) throw new Error('Digite a mensagem da atualização.');
    const targetSessionId=String(payload.targetSessionId||'').trim()||null;
    const publishedAt=new Date().toISOString();
    const c=getClient();
    let result=await c.from('admin_messages').insert({
      admin_user_id:profile.id,
      target_session_user_id:targetSessionId,
      title,
      message,
      active:true,
      published_at:publishedAt
    }).select('*').single();

    // Compatibilidade com bancos que ainda possuem a estrutura antiga da MSG ADM,
    // sem a coluna target_session_user_id. Mensagem para TODAS AS SESSÕES continua
    // funcionando; mensagem direcionada exige a atualização SQL incluída no projeto.
    if(result.error && /target_session_user_id|column .* does not exist/i.test(String(result.error.message||''))){
      if(targetSessionId) throw new Error('O banco ainda não está atualizado para enviar MSG ADM a uma sessão específica. Execute o SQL MSG_ADM_CORRECAO_COMPLETA_3.6.91.sql.');
      result=await c.from('admin_messages').insert({
        admin_user_id:profile.id,title,message,active:true,published_at:publishedAt
      }).select('*').single();
    }
    if(result.error){
      if(/relation .*admin_messages.* does not exist/i.test(String(result.error.message||'')))
        throw new Error('A estrutura da MSG ADM ainda não existe no Supabase. Execute o SQL MSG_ADM_CORRECAO_COMPLETA_3.6.91.sql.');
      throw result.error;
    }
    return result.data;
  }

  async function listAdminMessages(limit=20){
    if (!profile || profile.role !== 'admin') return [];
    if (!isOnline()) return safeGet('admin_messages_recent',[]).slice(0,limit);
    const {data,error}=await getClient().from('admin_messages').select('*').order('created_at',{ascending:false}).limit(limit);
    if(error) throw error;
    safeSet('admin_messages_recent',data||[]);
    return data||[];
  }

  async function deactivateAdminMessage(messageId){
    if (!profile || profile.role !== 'admin') throw new Error('Somente o administrador pode alterar mensagens.');
    if (!isOnline()) throw new Error('Esta ação precisa de internet.');
    const {error}=await getClient().from('admin_messages').update({active:false}).eq('id',messageId);
    if(error) throw error;
    return true;
  }

  async function deleteAdminMessage(messageId){
    if (!profile || profile.role !== 'admin') throw new Error('Somente o administrador pode excluir mensagens.');
    if (!isOnline()) throw new Error('Esta ação precisa de internet.');
    const id=String(messageId||'').trim();
    if(!id) throw new Error('Mensagem inválida.');
    const {error}=await getClient().from('admin_messages').delete().eq('id',id);
    if(error) throw error;
    const recent=safeGet('admin_messages_recent',[]).filter(item=>String(item.id)!==id);
    safeSet('admin_messages_recent',recent);
    return true;
  }

  function localAdminMessageSeenKey(messageId){
    return `admin_message_seen_${profile?.id||'guest'}_${messageId}`;
  }

  async function getUnreadAdminMessage(){
    if (!profile || !['session','service'].includes(profile.role)) return null;
    if (!isOnline()) return null;
    const recipientSessionId = profile.role === 'session' ? profile.id : profile.session_user_id;
    if (!recipientSessionId) return null;

    const c=getClient();
    const now=new Date().toISOString();
    let messagesResult=await c.from('admin_messages')
      .select('id,title,message,target_session_user_id,created_at,published_at')
      .eq('active',true)
      .lte('published_at',now)
      .order('published_at',{ascending:false})
      .limit(30);

    let supportsTarget=true;
    if(messagesResult.error && /target_session_user_id|column .* does not exist/i.test(String(messagesResult.error.message||''))){
      supportsTarget=false;
      messagesResult=await c.from('admin_messages')
        .select('id,title,message,created_at,published_at')
        .eq('active',true)
        .lte('published_at',now)
        .order('published_at',{ascending:false})
        .limit(30);
    }
    if(messagesResult.error) throw messagesResult.error;

    const eligible=(messagesResult.data||[]).filter(item=>{
      if(!supportsTarget) return true;
      const target=String(item?.target_session_user_id||'');
      return !target || target===String(recipientSessionId||'');
    });
    if(!eligible.length) return null;

    // O cache local é usado SEMPRE como proteção. Assim, se a tabela
    // admin_message_reads estiver ausente ou com RLS antigo, a MSG ADM
    // continua aparecendo uma única vez neste aparelho em vez de falhar.
    const seen=new Set();
    eligible.forEach(item=>{
      if(safeGet(localAdminMessageSeenKey(item.id),false)) seen.add(String(item.id));
    });

    const ids=eligible.map(item=>item.id).filter(id=>id!==null&&id!==undefined);
    try{
      const readsResult=await c.from('admin_message_reads')
        .select('message_id')
        .eq('user_id',profile.id)
        .in('message_id',ids);
      if(!readsResult.error){
        (readsResult.data||[]).forEach(row=>seen.add(String(row.message_id)));
      }else{
        console.warn('MSG ADM: controle remoto de leitura indisponível; usando controle local.', readsResult.error);
      }
    }catch(err){
      console.warn('MSG ADM: falha ao consultar leituras; usando controle local.',err);
    }

    return eligible.find(item=>!seen.has(String(item.id)))||null;
  }

  async function markAdminMessageSeen(messageId){
    if (!profile || !['session','service'].includes(profile.role) || !messageId) return false;
    // Grava primeiro localmente para nunca reapresentar a mensagem por causa
    // de uma falha de rede/RLS no momento em que o usuário fecha o aviso.
    safeSet(localAdminMessageSeenKey(messageId),true);
    if (!isOnline()) return true;
    try{
      const {error}=await getClient().from('admin_message_reads').upsert({
        message_id:messageId,user_id:profile.id,seen_at:new Date().toISOString()
      },{onConflict:'message_id,user_id'});
      if(error) console.warn('MSG ADM: leitura salva apenas localmente.',error);
    }catch(err){
      console.warn('MSG ADM: leitura salva apenas localmente.',err);
    }
    return true;
  }


  function auditCacheKey(id){ return `audit_logs_${id}`; }
  function auditPendingKey(id){ return `audit_logs_pending_${id}`; }
  function auditHash(input){
    let h=2166136261; const str=JSON.stringify(input||{});
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
    return `VALLE-${Date.now().toString(36).toUpperCase()}-${(h>>>0).toString(16).padStart(8,'0').toUpperCase()}`;
  }

  /*
   * LANÇAMENTOS: o registro da auditoria não pode desaparecer se houver
   * uma falha momentânea de rede/Supabase.
   *
   * Antes: o lançamento era colocado no cache, mas uma falha no INSERT era
   * apenas avisada no console. Na próxima leitura online, listAuditLogs()
   * substituía o cache pelos registros do servidor e o lançamento sumia.
   *
   * Agora:
   * 1. o lançamento entra em uma fila pendente imediatamente;
   * 2. o envio usa upsert pela assinatura, evitando duplicidade em retries;
   * 3. somente após confirmação do servidor ele sai da fila;
   * 4. a leitura online sempre mantém os pendentes junto dos registros do servidor;
   * 5. quando a internet volta, a fila é reenviada automaticamente.
   */
  async function flushPendingAuditLogs(sessionId=null){
    if(!profile || !['session','service'].includes(profile.role) || !isOnline()) return false;
    const sid=String(sessionId || currentSessionId() || '').trim();
    if(!sid) return false;

    const pending=safeGet(auditPendingKey(sid),[]) || [];
    if(!pending.length) return true;

    const remaining=[];
    for(const item of pending){
      try{
        const payload={...item, session_user_id:sid};
        const {error}=await getClient()
          .from('audit_logs')
          .upsert(payload,{onConflict:'signature'});
        if(error) throw error;
      }catch(error){
        console.warn('Lançamento ainda pendente de sincronização:',error);
        remaining.push(item);
      }
    }
    safeSet(auditPendingKey(sid),remaining);
    return remaining.length===0;
  }

  async function recordAudit(action, entityType, entityId, details={}){
    if (!profile || !['session','service'].includes(profile.role)) return false;
    const sid=String(currentSessionId() || '').trim();
    if(!sid) return false;

    const now=new Date().toISOString();
    const d=clone(details||{});
    const signature=auditHash({sid,uid:profile.id,action,entityType,entityId,d,now});
    const item={
      session_user_id:sid, actor_user_id:profile.id, actor_name:profile.name||profile.email||'Usuário',
      actor_role:profile.role, action:String(action||'').toUpperCase(), module:String(d.module||entityType||'SISTEMA').toUpperCase(),
      title:String(d.title||'Ação registrada'), description:String(d.description||''),
      entity_type:String(entityType||'registro'), entity_id:String(entityId||''), client_name:d.client_name||d.nome||null,
      vale_number:d.vale_number||d.numero||null, old_data:d.old_data||null, new_data:d.new_data||null,
      changes:d.changes||{}, details:d, signature, created_at:now
    };

    const cacheKey=auditCacheKey(sid);
    const pendingKey=auditPendingKey(sid);
    const cached=safeGet(cacheKey,[]) || [];
    const withoutSame=cached.filter(row=>String(row?.signature||'')!==signature);
    withoutSame.unshift(item);
    safeSet(cacheKey,withoutSame.slice(0,2000));

    const pending=safeGet(pendingKey,[]) || [];
    if(!pending.some(row=>String(row?.signature||'')===signature)){
      pending.unshift(item);
      safeSet(pendingKey,pending.slice(0,2000));
    }

    try{window.dispatchEvent(new CustomEvent('valle-audit-recorded',{detail:item}));}catch(_){}

    if(!isOnline()) return true;

    await flushPendingAuditLogs(sid);
    return true;
  }

  async function listAuditLogs(limit=1000, sessionId=null){
    if(!profile || !['session','service'].includes(profile.role)) return [];
    const sid=String(sessionId || currentSessionId() || '').trim();
    if(!sid) return [];

    const belongsToCurrentSession=row => String(row?.session_user_id || '') === sid;

    if(isOnline()){
      // Tenta enviar pendências antes da consulta, mas nunca descarta as que falharem.
      await flushPendingAuditLogs(sid);
      const pending=safeGet(auditPendingKey(sid),[]) || [];

      const {data,error}=await getClient()
        .from('audit_logs')
        .select('*')
        .eq('session_user_id',sid)
        .order('created_at',{ascending:false})
        .limit(limit);
      if(error) throw error;

      const server=(data||[]).filter(belongsToCurrentSession);
      const merged=[...server,...pending].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
      const seen=new Set();
      const unique=merged.filter(row=>{
        const key=String(row?.signature||row?.id||'');
        if(!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0,limit);

      safeSet(auditCacheKey(sid),unique);
      return unique;
    }

    return (safeGet(auditCacheKey(sid),[]) || [])
      .filter(belongsToCurrentSession)
      .slice(0,limit);
  }

  async function deleteAuditLog(logId){
    if(!profile || profile.role!=='session') throw new Error('Somente o usuário de sessão pode excluir registros de auditoria.');
    const sid=String(profile.id || currentSessionId() || '').trim();
    const target=String(logId || '').trim();
    if(!sid || !target) throw new Error('Registro de auditoria inválido.');

    const cacheKey=auditCacheKey(sid);
    const pendingKey=auditPendingKey(sid);
    const cached=safeGet(cacheKey,[]) || [];
    const pending=safeGet(pendingKey,[]) || [];
    const isTarget=row=>String(row?.id || row?.signature || '')===target;

    if(isOnline()){
      let query=getClient().from('audit_logs').delete().eq('session_user_id',sid);
      query=/^\d+$/.test(target) ? query.eq('id',Number(target)) : query.eq('signature',target);
      const {data,error}=await query.select('id,signature');
      if(error) throw error;
      if(!data?.length && cached.some(isTarget) && !pending.some(isTarget)){
        throw new Error('O registro não pôde ser excluído. Verifique a política de exclusão no Supabase.');
      }
    }

    safeSet(cacheKey,cached.filter(row=>!isTarget(row)));
    safeSet(pendingKey,pending.filter(row=>!isTarget(row)));
    try{window.dispatchEvent(new CustomEvent('valle-audit-deleted',{detail:{id:target,session_user_id:sid}}));}catch(_){}
    return true;
  }

  async function listManagedUsers(options={}){
    if (!profile) return [];
    const cached = safeGet(`managed_users_${profile.id}`, []);
    if (!isOnline() || (options.preferCache && cached.length)) return cached;
    let q = getClient().from('profiles').select('*').order('created_at', {ascending:false});
    if (profile.role === 'session') q = q.eq('session_user_id', profile.id).eq('role','service');
    else if (profile.role === 'admin') q = q.eq('role','session');
    else return [];
    try {
      const { data, error } = cached.length
        ? await withTimeout(q, 1800, 'Usando a lista salva neste aparelho.')
        : await q;
      if (error) throw error;
      safeSet(`managed_users_${profile.id}`, data || []);
      return data || [];
    } catch (e) { return cached; }
  }

  async function getPermissions(userId, options={}){
    const cached = safeGet(permissionsCacheKey(userId), {});
    if (!isOnline() || (options.preferCache && Object.keys(cached).length)) return cached;
    try {
      const request = getClient().from('service_permissions').select('*').eq('service_user_id',userId).maybeSingle();
      const { data, error } = Object.keys(cached).length
        ? await withTimeout(request, 1400, 'Usando as permissões salvas neste aparelho.')
        : await request;
      if (error) throw error;
      safeSet(permissionsCacheKey(userId), data || {});
      return data || {};
    } catch (e) { return cached; }
  }

  async function savePermissions(userId, permissions){
    if (!isOnline()) throw new Error('Alterar permissões precisa de internet.');
    const payload = { service_user_id:userId, session_user_id:profile.id, ...permissions, updated_at:new Date().toISOString() };
    const { error } = await getClient().from('service_permissions').upsert(payload,{onConflict:'service_user_id'});
    if (error) throw error;
    safeSet(permissionsCacheKey(userId), payload);
  }

  async function loadMyPermissions(options={}){
    if (!profile || profile.role !== 'service') return {};
    return getPermissions(profile.id, options);
  }

  async function loadClientPortal(){
    if(!profile || profile.role!=='client') throw new Error('Este usuário não é um cliente.');
    if(!isOnline()) throw new Error('A Área do Cliente precisa de conexão com a internet para mostrar dados atualizados.');
    const {data,error}=await getClient().rpc('get_my_client_portal');
    if(error)throw new Error(error.message||'Não foi possível carregar sua Área do Cliente.');
    if(!data)throw new Error('Nenhum dado foi encontrado para este cliente.');
    return data;
  }

  async function createClientPaymentRequest(payload={}){
    if(!profile || profile.role!=='client') throw new Error('Este usuário não é um cliente.');
    if(!isOnline()) throw new Error('É necessário estar conectado para informar o pagamento.');
    const {data,error}=await getClient().rpc('create_client_payment_request',{
      p_vale_id:String(payload.valeId||''),
      p_amount:Number(payload.amount||0),
      p_client_message:String(payload.message||'')
    });
    if(error) throw new Error(error.message||'Não foi possível informar o pagamento.');
    return data;
  }

  async function listClientPaymentRequests(limit=80){
    if(!profile || !['service','session'].includes(profile.role)) return [];
    if(!isOnline()) return [];
    const sessionId=profile.role==='session'?profile.id:profile.session_user_id;
    const {data,error}=await getClient().from('client_payment_requests')
      .select('*')
      .eq('session_user_id',sessionId)
      .order('created_at',{ascending:false})
      .limit(Math.max(1,Math.min(200,Number(limit)||80)));
    if(error) throw new Error(error.message||'Não foi possível carregar os pagamentos informados.');
    return data||[];
  }

  async function updateClientPaymentRequestStatus(requestId,status,reviewNote=''){
    if(!profile || !['service','session'].includes(profile.role)) throw new Error('Sem permissão para conferir pagamentos.');
    if(!isOnline()) throw new Error('É necessário estar conectado.');
    const normalized=String(status||'').toLowerCase();
    if(!['confirmed','rejected','pending'].includes(normalized)) throw new Error('Status inválido.');
    const payload={status:normalized,review_note:String(reviewNote||''),reviewed_by:profile.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const {data,error}=await getClient().from('client_payment_requests').update(payload).eq('id',requestId).select('*').single();
    if(error) throw new Error(error.message||'Não foi possível atualizar o pagamento informado.');
    try{await recordAudit(normalized==='confirmed'?'CONFIRMAR_PAGAMENTO_PIX_CLIENTE':'RECUSAR_PAGAMENTO_PIX_CLIENTE','PAGAMENTO_CLIENTE',String(requestId),{module:'PORTAL_CLIENTE',title:normalized==='confirmed'?'Pagamento PIX informado confirmado':'Pagamento PIX informado não confirmado',description:String(reviewNote||''),client_name:data?.client_name||'',vale_number:data?.vale_numero||'',new_data:data});}catch(_){ }
    return data;
  }

  installOnlineHandlers();
  window.ValleCloud = {
    configured, getClient, signIn, signOut, verifyCurrentPassword, restoreSession, loadProfile,
    get profile(){return profile}, get sessionProfile(){return sessionProfile},
    accessState, setMyTheme, loadWorkspace, loadWorkspaceSnapshot, saveWorkspace, saveWorkspaceStrict, queueWorkspace, flushWorkspace,
    syncPendingWorkspace, invokeManage, createAdminMessage, listAdminMessages, deactivateAdminMessage, deleteAdminMessage, getUnreadAdminMessage, markAdminMessageSeen,
    listManagedUsers, getPermissions, savePermissions, loadMyPermissions, loadClientPortal, createClientPaymentRequest, listClientPaymentRequests, updateClientPaymentRequestStatus, recordAudit, listAuditLogs, deleteAuditLog, getCurrentSessionId:currentSessionId,
    normalizePhone, isOnline,
    get syncState(){return syncState},
    get lastSyncError(){return lastSyncError},
    get lastSyncedAt(){return lastSyncedAt}
  };
})();
