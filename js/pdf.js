/**
 * PDF
 * Funções de apoio para criação de PDF em versões modularizadas do sistema.
 */

function pdfTxt(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function nomeArquivoPdf(v){return `VALE-${pdfTxt(v.cliente||'CLIENTE').replace(/\s+/g,'-')}-${dataBR(v.dataFinal).replace(/\//g,'-')}.pdf`;}
function criarPdfVale(v){
  const W=420,H=595,ops=[]; const esc=pdfTxt;
  const rgb=hex=>{hex=hex.replace('#','');return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).join(' ')};
  const fill=hex=>ops.push(rgb(hex)+' rg'), stroke=hex=>ops.push(rgb(hex)+' RG');
  const txt=(t,x,y,size=10,bold=false,hex='#111827')=>{fill(hex);ops.push(`BT /${bold?'F2':'F1'} ${size} Tf ${x} ${y} Td (${esc(t)}) Tj ET`)};
  const line=(x1,y1,x2,y2,hex='#111827',w=1)=>{stroke(hex);ops.push(`${w} w ${x1} ${y1} m ${x2} ${y2} l S`)};
  const rect=(x,y,w,h,fillHex=null,strokeHex='#111827',lw=1)=>{stroke(strokeHex);ops.push(`${lw} w`); if(fillHex){fill(fillHex);ops.push(`${x} ${y} ${w} ${h} re B`)}else ops.push(`${x} ${y} ${w} ${h} re S`)};
  const label=(l,v,y)=>{txt(l,38,y,8,true,'#64748b');txt(v||' ',38,y-20,15,true,'#111827');line(38,y-31,W-38,y-31,'#cbd5e1',.8)};
  rect(22,20,W-44,H-40,'#ffffff','#111827',1.2);
  rect(30,H-88,W-60,58,'#111827','#111827',1);
  txt('VALE',44,H-58,30,true,'#ffffff'); txt(`${diasVale(v)} DIAS`,W-120,H-52,16,true,'#ffffff'); txt('COMPROVANTE DE EMPRESTIMO',45,H-75,9,false,'#e5e7eb');
  let y=H-125; label('CLIENTE',v.cliente||'NAO INFORMADO',y); y-=56; label('TELEFONE / WHATSAPP',v.telefone||'NAO INFORMADO',y);
  if(v.cpf){y-=56; label('CPF',v.cpf,y)}
  y-=74; rect(38,y,344,66,'#f8fafc','#cbd5e1',1); txt('VALOR DO EMPRESTIMO',54,y+44,8,true,'#64748b'); txt(moeda(v.valor),54,y+16,24,true,'#111827');
  y-=82; rect(38,y,344,72,'#ecfeff','#00a9d9',1.2); txt('TOTAL A PAGAR',54,y+48,9,true,'#007fa6'); txt(moeda(v.total),54,y+17,28,true,'#111827');
  y-=58; txt('TAXA DE JUROS',38,y+28,8,true,'#64748b'); txt(String(v.juros).replace('.',',')+'%',38,y+8,16,true,'#111827'); txt('STATUS',220,y+28,8,true,'#64748b'); txt(v.status||'ABERTO',220,y+8,16,true,'#111827'); line(38,y-6,W-38,y-6,'#cbd5e1',.8);
  y-=58; txt('DATA INICIAL',38,y+28,8,true,'#64748b'); txt(dataBR(v.dataInicial),38,y+8,18,true,'#111827'); txt('DATA FINAL',220,y+28,8,true,'#64748b'); txt(dataBR(v.dataFinal),220,y+8,18,true,'#dc2626'); line(38,y-8,W-38,y-8,'#cbd5e1',.8);
  y-=48; txt('OBSERVACAO',38,y+24,8,true,'#64748b'); const obs=String(v.observacao||'NENHUMA').slice(0,130); txt(obs.slice(0,58),38,y,10,false,'#111827'); if(obs.length>58)txt(obs.slice(58,116),38,y-17,10,false,'#111827');
  line(68,74,W-68,74,'#111827',1); txt('ASSINATURA DO CLIENTE',137,55,10,true,'#334155'); txt('Vale gerado pelo sistema de controle de clientes.',92,34,8,false,'#94a3b8');
  const stream=ops.join('\n');
  const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n',pos=[0]; objs.forEach((o,i)=>{pos.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}); const xref=pdf.length; pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'; for(let i=1;i<pos.length;i++)pdf+=String(pos[i]).padStart(10,'0')+' 00000 n \n'; pdf+=`trailer << /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes=new Uint8Array(pdf.length); for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255; return new Blob([bytes],{type:'application/pdf'});
}
function baixarPdfVale(v){const blob=criarPdfVale(v);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nomeArquivoPdf(v);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function imprimirVale(v){
  // Imprime exatamente o mesmo arquivo PDF gerado pelo sistema.
  // Não usa mais uma tela HTML separada, para o layout da impressão ficar igual ao PDF.
  const blob=criarPdfVale(v);
  const url=URL.createObjectURL(blob);
  const w=window.open(url,'_blank');
  if(!w){
    baixarPdfVale(v);
    if(typeof toast==='function')toast('PDF BAIXADO. ABRA O ARQUIVO PARA IMPRIMIR');
    setTimeout(()=>URL.revokeObjectURL(url),15000);
    return;
  }
  setTimeout(()=>{
    try{
      w.focus();
      w.print();
    }catch(e){
      if(typeof toast==='function')toast('PDF ABERTO. USE IMPRIMIR NO NAVEGADOR');
    }
  },1200);
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
