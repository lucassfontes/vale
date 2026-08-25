/** VALLE — dados operacionais locais removidos. Somente login e tema podem persistir no navegador. */
const LS='emprestimos_pro_v2';
let dados={clientes:[],vales:[],configuracoes:{}};
function normalizarDados(){dados.clientes=Array.isArray(dados.clientes)?dados.clientes:[];dados.vales=Array.isArray(dados.vales)?dados.vales:[];dados.configuracoes=dados.configuracoes&&typeof dados.configuracoes==='object'?dados.configuracoes:{};}
function salvar(){normalizarDados();return true;}
function encontrarCliente(nome){nome=String(nome||'').toUpperCase();return dados.clientes.find(c=>c.nome===nome)||null;}
function garantirCliente(nome,telefone='',cpf='',endereco=''){nome=String(nome||'').trim().toUpperCase();if(!nome)return null;let c=encontrarCliente(nome);if(!c){c={id:'C'+Date.now()+Math.random().toString(16).slice(2),nome,telefone,cpf,endereco};dados.clientes.push(c);}else{if(telefone)c.telefone=telefone;if(cpf)c.cpf=cpf;if(endereco)c.endereco=endereco;}return c;}
