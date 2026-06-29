function aplicarTema(){document.body.classList.toggle('dark',dados.tema==='dark');}
function alternarTema(){dados.tema=dados.tema==='dark'?'claro':'dark';salvar();aplicarTema();}
function abrirTela(id){document.querySelectorAll('.tela').forEach(t=>t.classList.remove('ativa'));$(id).classList.add('ativa');document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('ativo'));const m={dashboard:'tabDash',emprestimo:'tabEmp',historico:'tabHist',clientes:'tabCli',backup:'tabBack'};if(m[id])$(m[id]).classList.add('ativo');renderTudo();}
function moedaInput(el){el.value=moeda(moedaNumero(el.value));calcular();}
function taxaInput(){let n=taxaNumero();$('juros').value=(String(n).replace('.',','))+'%';calcular();}
function calcular(){const v=moedaNumero($('valor').value),j=taxaNumero(),total=v+(v*j/100);$('valorComTaxa').value=moeda(total);$('diasBadge').textContent=diasEntre()||0;}
function iniciarDatas(){const hoje=new Date();$('dataInicial').value=dataInput(hoje);const fim=new Date(hoje);fim.setDate(fim.getDate()+30);$('dataFinal').value=dataInput(fim);}
function limparFormulario(){$('cliente').value='';$('valor').value='';$('juros').value='30%';$('valorComTaxa').value='';$('observacao').value='';iniciarDatas();calcular();}
function novoVale(){const cliente=$('cliente').value.trim().toUpperCase(),cad=encontrarCliente(cliente)||{};return {id:'V'+Date.now(),cliente,telefone:cad.telefone||'',cpf:cad.cpf||'',endereco:cad.endereco||'',valor:moedaNumero($('valor').value),juros:taxaNumero(),total:moedaNumero($('valorComTaxa').value),dataInicial:$('dataInicial').value,dataFinal:$('dataFinal').value,observacao:$('observacao').value.trim().toUpperCase(),status:'ABERTO',criadoEm:new Date().toISOString()};}
function validarVale(v){if(!v.cliente)return 'INFORME O CLIENTE'; if(v.valor<=0)return 'INFORME O VALOR DO EMPRÉSTIMO'; if(!v.dataInicial||!v.dataFinal)return 'INFORME AS DATAS'; return '';}
function salvarVale(v){garantirCliente(v.cliente,v.telefone,v.cpf,v.endereco);dados.vales.unshift(v);salvar();atualizarClientesLista();}
function imprimirESalvar(){const v=novoVale(),erro=validarVale(v);if(erro){toast(erro);return;}salvarVale(v);renderTudo();imprimirVale(v);toast('VALE SALVO NO HISTÓRICO');}
function renderTudo(){atualizarClientesLista();renderClientes();renderHistorico();renderDashboard();}
function iniciar(){normalizarDados();salvar();aplicarTema();iniciarDatas();calcular();renderTudo();if('serviceWorker' in navigator){navigator.serviceWorker.register('service-worker.js').catch(()=>{});}}
$('valor').addEventListener('input',()=>moedaInput($('valor')));
$('juros').addEventListener('blur',taxaInput);$('juros').addEventListener('input',calcular);
$('telefoneCliente').addEventListener('input',()=>maskTelefone($('telefoneCliente')));
$('cpfCliente').addEventListener('input',()=>maskCPF($('cpfCliente')));
$('dataInicial').addEventListener('change',()=>{const i=new Date($('dataInicial').value+'T00:00:00');if(!isNaN(i)){i.setDate(i.getDate()+30);$('dataFinal').value=dataInput(i);}calcular();});
$('dataFinal').addEventListener('change',calcular);
document.querySelectorAll("input:not([type='date']):not(#valor):not(#juros):not(#telefoneCliente):not(#cpfCliente), textarea").forEach(e=>e.addEventListener('input',()=>maiusculo(e)));
iniciar();
