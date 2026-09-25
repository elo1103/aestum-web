(() => {
  'use strict';
  const {t}=window.Aestum;
  const tbody=document.getElementById('material-rows');
  const job=document.getElementById('job-name');
  const needed=document.getElementById('needed-date');
  const indicator=document.getElementById('sample-indicator');
  const resultNote=document.getElementById('result-note');
  const scale=1e6;
  let nextId=0, dirty=false, sample=true;
  const numericKeys=['required','stock','reserved'];
  const labelKeys={name:'materialName',required:'required',stock:'stock',reserved:'reservedShort',arrival:'expectedArrival'};
  const samples=[{name:'K-12 (pcs)',required:'35',stock:'80',reserved:'60',arrival:''},{name:'F-08 (pcs)',required:'96',stock:'120',reserved:'0',arrival:''},{name:'P-04 (pcs)',required:'40',stock:'42',reserved:'0',arrival:''}];
  const format=value=>new Intl.NumberFormat(window.Aestum.language==='en'?'en-US':'zh-TW',{maximumFractionDigits:6}).format(value);
  function validDate(value){
    if(value==='')return true;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'2100-12-31')return false;
    const date=new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
  }
  function quantity(value){
    if(String(value).trim()==='')return null;
    const number=Number(value), scaled=Math.round(number*scale);
    if(!Number.isFinite(number)||number<0||number>1e9||Math.abs(number-scaled/scale)>1e-10)return null;
    return scaled;
  }
  function calculate(row,neededDate=''){
    if(!row.name.trim())return {valid:false,error:'invalidName',field:'name'};
    const values={};
    for(const key of numericKeys){values[key]=quantity(row[key]);if(values[key]===null)return {valid:false,error:'invalidNumber',field:key};}
    if(values.reserved>values.stock)return {valid:false,error:'invalidReservation',field:'reserved'};
    if(!validDate(row.arrival))return {valid:false,error:'invalidDate',field:'arrival'};
    const available=(values.stock-values.reserved)/scale;
    const shortage=Math.max(0,values.required-values.stock+values.reserved)/scale;
    return {valid:true,available,shortage,late:shortage>0&&!!row.arrival&&!!neededDate&&row.arrival>neededDate};
  }
  function getRow(tr){const row={};for(const key of Object.keys(labelKeys))row[key]=tr.querySelector(`[data-field="${key}"]`).value;return row;}
  function setWorking(){dirty=true;sample=false;indicator.textContent=t('editedData');}
  function addRow(data={name:'',required:'',stock:'',reserved:'0',arrival:''},focus=false){
    if(tbody.rows.length>=100){resultNote.textContent=t('maxRows');return;}
    const tr=document.createElement('tr');tr.dataset.rowId=String(++nextId);
    for(const key of Object.keys(labelKeys)){
      const td=document.createElement('td'),input=document.createElement('input');
      input.dataset.field=key;input.id=`material-${nextId}-${key}`;
      input.type=numericKeys.includes(key)?'number':key==='arrival'?'date':'text';
      if(numericKeys.includes(key)){input.min='0';input.max='1000000000';input.step='0.000001';input.inputMode='decimal';input.required=true;}
      if(key==='name'){input.maxLength=120;input.className='item-name';input.required=true;}
      if(key==='arrival'){input.min='2000-01-01';input.max='2100-12-31';}
      input.value=data[key]??'';input.setAttribute('aria-label',t(labelKeys[key]));input.setAttribute('aria-describedby',`material-${nextId}-result`);td.append(input);const printValue=document.createElement('span');printValue.className='print-value';printValue.setAttribute('aria-hidden','true');td.append(printValue);tr.append(td);
    }
    const status=document.createElement('td');status.className='row-status';status.id=`material-${nextId}-result`;tr.append(status);
    const td=document.createElement('td'),remove=document.createElement('button');remove.type='button';remove.className='remove-row';remove.textContent='×';remove.setAttribute('aria-label',t('remove'));remove.addEventListener('click',()=>{const next=tr.nextElementSibling||tr.previousElementSibling;tr.remove();setWorking();update();(next?.querySelector('input')||document.getElementById('add-row')).focus();});td.append(remove);tr.append(td);tbody.append(tr);
    if(focus)tr.querySelector('input').focus();
  }
  function update(){
    let shortages=0,invalid=0;
    const results=[];
    Array.from(tbody.rows).forEach((tr,index)=>{
      const row=getRow(tr);let result=calculate(row,needed.value);
      if(tr.querySelector('[data-field="arrival"]').validity.badInput)result={valid:false,error:'invalidDate',field:'arrival'};
      results.push({row,result});
      tr.querySelectorAll('.print-value').forEach(span=>{span.textContent=span.previousElementSibling.value||'—';});
      tr.querySelectorAll('input').forEach(input=>{input.removeAttribute('aria-invalid');input.setCustomValidity('');input.setAttribute('aria-label',`${t('rowName',{n:index+1})} — ${t(labelKeys[input.dataset.field])}`);});
      tr.querySelector('.remove-row').setAttribute('aria-label',`${t('remove')} ${row.name||t('rowName',{n:index+1})}`);
      const status=tr.querySelector('.row-status');status.replaceChildren();
      const badge=document.createElement('span');badge.className=`pill ${result.valid?(result.shortage>0?'pill-amber':'pill-green'):'pill-error'}`;
      const detail=document.createElement('span');detail.className='row-detail';
      if(!result.valid){invalid++;badge.textContent=t('invalidStatus');detail.textContent=t(result.error);const input=tr.querySelector(`[data-field="${result.field}"]`);input.setAttribute('aria-invalid','true');input.setCustomValidity(t(result.error));}
      else{if(result.shortage>0)shortages++;badge.textContent=result.shortage>0?t('short',{n:format(result.shortage)}):t('quantityReady');detail.textContent=t('availableDetail',{n:format(result.available)});}
      status.append(badge,detail);
      if(result.valid&&result.shortage>0){const arrival=document.createElement('span');arrival.className='row-detail';arrival.textContent=result.late?t('arrivalLate'):row.arrival?t('arrivalExpected',{date:row.arrival}):t('arrivalPending');status.append(arrival);}
    });
    document.getElementById('total-count').textContent=String(tbody.rows.length);
    document.getElementById('shortage-count').textContent=String(shortages);
    document.getElementById('invalid-count').textContent=String(invalid);
    document.getElementById('empty-message').hidden=tbody.rows.length>0;
    document.getElementById('add-row').disabled=tbody.rows.length>=100;
    document.getElementById('export-csv').disabled=tbody.rows.length===0;
    document.getElementById('print-check').disabled=tbody.rows.length===0;
    const dateOK=validDate(needed.value)&&!needed.validity.badInput;
    needed.setCustomValidity(dateOK?'':t('invalidDate'));needed.setAttribute('aria-invalid',String(!dateOK));
    resultNote.textContent=!dateOK?t('invalidDate'):!tbody.rows.length?t('summaryEmpty'):invalid?t('summaryInvalid',{n:invalid}):shortages?t('summaryShort',{n:shortages}):t('summaryReady');
    indicator.textContent=t(sample?'sampleIndicator':'editedData');
    return {results,valid:invalid===0&&dateOK&&tbody.rows.length>0};
  }
  function replaceRows(withSample){
    if(dirty&&!window.confirm(t('confirmReplace')))return;
    tbody.replaceChildren();job.value=withSample?'WO-208':'';needed.value='';sample=withSample;dirty=false;
    if(withSample)samples.forEach(data=>addRow(data));else addRow();
    update();if(!withSample)tbody.querySelector('input').focus();
  }
  function csvCell(value){
    let text=String(value??'');
    // Prevent spreadsheet applications from executing user-entered formulas.
    if(/^[\s\uFEFF]*[=+\-@]/u.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  }
  function buildCsv(rows,jobName,neededDate,snapshot=new Date().toISOString()){
    const header=['exportJob','exportNeeded','exportItem','exportRequired','exportStock','exportReserved','exportAvailable','exportShortage','exportArrival','exportStatus','exportNotes','exportSnapshot'].map(key=>t(key));
    const lines=[header,...rows.map(({row,result})=>[jobName,neededDate,row.name,row.required,row.stock,row.reserved,result.available,result.shortage,row.arrival,result.shortage>0?t('short',{n:format(result.shortage)}):t('quantityReady'),result.shortage>0?(result.late?t('arrivalLate'):row.arrival?t('arrivalExpected',{date:row.arrival}):t('arrivalPending')):'',snapshot])];
    return '\uFEFF'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n')+'\r\n';
  }
  function validateBeforeOutput(){const check=update();if(!check.valid){const field=document.querySelector('input[aria-invalid="true"]');field?.focus();field?.reportValidity();}return check;}
  document.getElementById('export-csv').addEventListener('click',()=>{
    const check=validateBeforeOutput();if(!check.valid)return;
    const blob=new Blob([buildCsv(check.results,job.value,needed.value)],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='aestum-material-readiness.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);resultNote.textContent=t('exportDone');
  });
  document.getElementById('print-check').addEventListener('click',()=>{if(validateBeforeOutput().valid)window.print();});
  document.getElementById('add-row').addEventListener('click',()=>{addRow(undefined,true);setWorking();update();});
  document.getElementById('start-blank').addEventListener('click',()=>replaceRows(false));
  document.getElementById('load-sample').addEventListener('click',()=>replaceRows(true));
  tbody.addEventListener('input',()=>{setWorking();update();});
  job.addEventListener('input',()=>{setWorking();});
  needed.addEventListener('input',()=>{setWorking();update();});
  document.addEventListener('aestum:language',()=>update());
  window.AestumMaterial={calculate,quantity,validDate,csvCell,buildCsv};
  replaceRows(true);
})();
