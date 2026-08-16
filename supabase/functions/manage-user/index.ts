
import { createClient } from 'supabase'
const corsHeaders={
 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 try{
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader=req.headers.get('Authorization')||''
  const callerClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}}})
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:{user},error:userError}=await callerClient.auth.getUser(); if(userError||!user)return json({error:'Não autorizado.'},401)
  const {data:caller,error:profileError}=await admin.from('profiles').select('*').eq('id',user.id).single(); if(profileError)return json({error:'Perfil não encontrado.'},403)
  const body=await req.json(); const action=body.action

  // Área do Cliente: usuário de sessão ou de serviço pode administrar somente
  // o acesso dos clientes pertencentes à própria sessão.
  if(['client_access_info','client_access_save','client_access_delete'].includes(action)){
   if(!['session','service'].includes(caller.role))return json({error:'Sem permissão para administrar acesso de clientes.'},403)
   const sessionId=caller.role==='session'?caller.id:caller.session_user_id
   if(!sessionId)return json({error:'Sessão do usuário não encontrada.'},403)
   const clientId=String(body.clientId||'').trim()
   if(!clientId)return json({error:'Cliente não informado.'},400)

   const {data:workspace,error:workspaceError}=await admin.from('session_workspaces').select('data').eq('session_user_id',sessionId).maybeSingle()
   if(workspaceError)return json({error:workspaceError.message},400)
   const clients=Array.isArray(workspace?.data?.clientes)?workspace.data.clientes:[]
   const linkedClient=clients.find((item:any)=>String(item?.id||'')===clientId)
   if(!linkedClient)return json({error:'Cliente não pertence a esta sessão.'},403)

   const {data:account,error:accountError}=await admin.from('client_accounts').select('*').eq('session_user_id',sessionId).eq('client_id',clientId).maybeSingle()
   if(accountError)return json({error:accountError.message},400)

   if(action==='client_access_info'){
    return json({ok:true,account:account?{userId:account.user_id,email:account.email,name:account.name,active:account.active,createdAt:account.created_at}:null})
   }

   if(action==='client_access_delete'){
    if(!account)return json({ok:true,deleted:false})
    const {error:deleteError}=await admin.auth.admin.deleteUser(account.user_id)
    if(deleteError)return json({error:deleteError.message},400)
    return json({ok:true,deleted:true})
   }

   const email=String(body.email||account?.email||'').trim()
   const password=String(body.password||'')
   const name=String(linkedClient?.nome||body.name||account?.name||'Cliente').trim()||'Cliente'
   const active=body.active!==false
   if(!email)return json({error:'Informe o e-mail do cliente.'},400)

   if(!account){
    if(password.length<6)return json({error:'A senha inicial deve ter pelo menos 6 caracteres.'},400)
    const {data:created,error:createError}=await admin.auth.admin.createUser({
      email,password,email_confirm:true,
      user_metadata:{name,role:'client',client_id:clientId,session_user_id:sessionId}
    })
    if(createError)return json({error:createError.message},400)
    const {error:insertError}=await admin.from('client_accounts').insert({
      user_id:created.user.id,session_user_id:sessionId,client_id:clientId,name,email,active,created_by:caller.id
    })
    if(insertError){await admin.auth.admin.deleteUser(created.user.id);return json({error:insertError.message},400)}
    return json({ok:true,created:true,account:{userId:created.user.id,email,name,active}})
   }

   const authChanges:any={user_metadata:{name,role:'client',client_id:clientId,session_user_id:sessionId}}
   if(email!==account.email){authChanges.email=email;authChanges.email_confirm=true}
   if(password){
    if(password.length<6)return json({error:'A nova senha deve ter pelo menos 6 caracteres.'},400)
    authChanges.password=password
   }
   const {error:authUpdateError}=await admin.auth.admin.updateUserById(account.user_id,authChanges)
   if(authUpdateError)return json({error:authUpdateError.message},400)
   const {error:updateAccountError}=await admin.from('client_accounts').update({name,email,active,updated_at:new Date().toISOString()}).eq('user_id',account.user_id)
   if(updateAccountError)return json({error:updateAccountError.message},400)
   return json({ok:true,created:false,account:{userId:account.user_id,email,name,active}})
  }

  if(!['admin','session'].includes(caller.role))return json({error:'Sem permissão.'},403)
  if(action==='create'){
   const role=caller.role==='admin'?'session':'service'
   if(body.role && body.role!==role)return json({error:'Você não pode criar este tipo de usuário.'},403)
   const sessionUserId=role==='service'?caller.id:null
   const {data:created,error:createError}=await admin.auth.admin.createUser({email:body.email,password:body.password,email_confirm:true,user_metadata:{name:body.name,role}})
   if(createError)return json({error:createError.message},400)
   const {error:insertError}=await admin.from('profiles').insert({id:created.user.id,name:body.name,email:body.email,role,session_user_id:sessionUserId,created_by:caller.id,active:body.active!==false,valid_until:role==='session'?body.validUntil:null,admin_whatsapp:role==='session'?body.adminWhatsapp:null})
   if(insertError){await admin.auth.admin.deleteUser(created.user.id);return json({error:insertError.message},400)}
   if(role==='service')await admin.from('service_permissions').insert({service_user_id:created.user.id,session_user_id:sessionUserId,interest_percent:Number(body.interestPercent??30),late_fee_type:body.lateFeeType==='reais'?'reais':'percentual',late_fee_value:Number(body.lateFeeValue||0)})
   return json({ok:true,userId:created.user.id})
  }
  if(action==='delete'){
   const {data:target,error:targetError}=await admin.from('profiles').select('*').eq('id',body.userId).single();
   if(targetError)return json({error:'Usuário não encontrado.'},404)
   const allowed=(caller.role==='admin'&&target.role==='session')||(caller.role==='session'&&target.role==='service'&&target.session_user_id===caller.id)
   if(!allowed)return json({error:'Sem permissão para excluir este usuário.'},403)

   // Ao excluir uma sessão, apaga primeiro todos os usuários de serviço da hierarquia.
   // A exclusão no Auth aciona o ON DELETE CASCADE para perfis, permissões e dados.
   if(target.role==='session'){
    const {data:services,error:servicesError}=await admin.from('profiles').select('id').eq('session_user_id',target.id).eq('role','service')
    if(servicesError)return json({error:servicesError.message},400)
    for(const serviceUser of services||[]){
     const {error:childDeleteError}=await admin.auth.admin.deleteUser(serviceUser.id)
     if(childDeleteError)return json({error:`Falha ao excluir usuário de serviço: ${childDeleteError.message}`},400)
    }
   }

   const {error:deleteError}=await admin.auth.admin.deleteUser(target.id)
   if(deleteError)return json({error:deleteError.message},400)
   return json({ok:true,deletedUserId:target.id})
  }

  if(action==='update'){
   const {data:target,error:targetError}=await admin.from('profiles').select('*').eq('id',body.userId).single();if(targetError)return json({error:'Usuário não encontrado.'},404)
   const allowed=(caller.role==='admin'&&target.role==='session')||(caller.role==='session'&&target.role==='service'&&target.session_user_id===caller.id);if(!allowed)return json({error:'Sem permissão para este usuário.'},403)
   const changes:any={updated_at:new Date().toISOString()};
   if(body.active!==undefined)changes.active=body.active;
   if(caller.role==='admin'){
    if(body.validUntil!==undefined)changes.valid_until=body.validUntil;
    if(body.adminWhatsapp!==undefined)changes.admin_whatsapp=body.adminWhatsapp;
   } else if(body.name!==undefined){changes.name=body.name}
   const {error}=await admin.from('profiles').update(changes).eq('id',target.id);if(error)return json({error:error.message},400)
   if(caller.role==='session'&&body.name)await admin.auth.admin.updateUserById(target.id,{user_metadata:{name:body.name}})
   if(caller.role==='session'&&body.interestPercent!==undefined){
    const interest=Math.max(0,Number(body.interestPercent)||0)
    const {error:permissionError}=await admin.from('service_permissions').update({interest_percent:interest,updated_at:new Date().toISOString()}).eq('service_user_id',target.id).eq('session_user_id',caller.id)
    if(permissionError)return json({error:permissionError.message},400)
   }
   return json({ok:true,userId:target.id})
  }
  return json({error:'Ação inválida.'},400)
 }catch(e){return json({error:e instanceof Error?e.message:'Erro interno.'},500)}
})
