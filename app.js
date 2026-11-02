"use strict";
const TARGET = 20;
const STORE_MULTIPLIERS = [
  [/h[ -]?mart/i,2],
  [/costco|sam'?s club|target/i,1.5],
  [/aldi|sprouts|fresh market/i,1.25],
  [/publix/i,1]
];
const multiplierFor = name => STORE_MULTIPLIERS.find(([re])=>re.test(name))?.[1] ?? 1.25;
const dollars = n => `$${n.toFixed(2)}`;
const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let batches = [];
function evaluate(b){
  const mult=multiplierFor(b.store);
  const drive=b.drive+b.extraDrive;
  const shoppingFast=b.items*40/60*mult;
  const shoppingSlow=b.items*55/60*mult;
  // Checkout/loading applies only if there is shopping. Shop Only adds staging separately.
  const checkoutFast=b.items>0?10:0,checkoutSlow=b.items>0?20:0;
  const staging=b.shopOnly*5;
  const deliveryFast=b.miles*2+b.deliveries*5;
  const deliverySlow=b.miles*4+b.deliveries*10;
  const fast=drive+shoppingFast+checkoutFast+staging+deliveryFast;
  const slow=drive+shoppingSlow+checkoutSlow+staging+deliverySlow;
  if(fast<=0||slow<=0)return {...b, status:'REVIEW',reason:'Insufficient work-time information'};
  const low=b.pay*60/slow,high=b.pay*60/fast,mid=(low+high)/2;
  const warnings=[];
  if(b.provisional)warnings.push('Drive to store is an assumption, not live routing. Verify before accepting.');
  if(b.address)warnings.push('Store location: '+b.address);
  if(b.drive===0)warnings.push('Confirm the drive to the first store is truly zero.');
  if(/costco|sam'?s club/i.test(b.store)&&b.items>=35)warnings.push('Check vehicle capacity for bulky items.');
  if(b.deliveries===0&&b.miles>0)warnings.push('Delivery mileage was entered but there are no delivery orders.');
  return {...b,mult,fast,slow,low,high,mid,warnings,status:mid>=TARGET?'TAKE':'SKIP'};
}
function render(){
 const results=batches.map(evaluate).sort((a,b)=>(b.mid??-1)-(a.mid??-1));
 document.getElementById('count').textContent=`${results.length} evaluated`;
 document.getElementById('results').innerHTML=results.length?results.map((b,i)=>`<article class="batch ${b.status.toLowerCase()}"><div class="card-top"><div class="store">${i+1}. ${escapeHTML(b.store)}</div><span class="pill">${b.status}</span></div><div class="card-main"><div class="pay">${dollars(b.pay)}</div><div class="rate">${b.mid==null?'—':dollars(b.mid)+'/hr'}<small>estimated hourly midpoint</small></div></div><div class="details">${b.items} items · ${b.deliveries} deliveries · ${b.shopOnly} Shop Only · ${b.miles} delivery miles<br>${b.mid==null?escapeHTML(b.reason):`${Math.round(b.fast)}–${Math.round(b.slow)} min total · ${dollars(b.low)}–${dollars(b.high)}/hr range · ${b.mult}× store factor`}</div>${(b.warnings||[]).map(w=>`<div class="warning">⚠ ${escapeHTML(w)}</div>`).join('')}</article>`).join(''):'<div class="empty">Add a batch or load examples to begin.</div>';
}
function addBatch(b){if(!b.store||!Number.isFinite(b.pay)||b.pay<=0||![b.items,b.miles,b.drive,b.deliveries,b.shopOnly,b.extraDrive].every(x=>Number.isFinite(x)&&x>=0))throw Error('Please enter valid, nonnegative values.');if(b.deliveries+b.shopOnly===0)throw Error('Enter at least one delivery or Shop Only order.');batches.push(b);render();}
document.getElementById('batch-form').addEventListener('submit',e=>{e.preventDefault();const val=id=>Number(document.getElementById(id).value);try{addBatch({store:document.getElementById('store').value.trim(),pay:val('pay'),items:val('items'),miles:val('miles'),drive:val('drive'),deliveries:val('deliveries'),shopOnly:val('shopOnly'),extraDrive:val('extraDrive')});}catch(err){alert(err.message);}});
document.getElementById('demo').addEventListener('click',()=>{batches=[{store:'Publix',pay:45.32,items:60,miles:2.1,drive:0,deliveries:2,shopOnly:0,extraDrive:0},{store:'Target',pay:29.59,items:21,miles:9.1,drive:13,deliveries:3,shopOnly:0,extraDrive:0},{store:'ALDI',pay:24.45,items:40,miles:7.4,drive:8,deliveries:2,shopOnly:1,extraDrive:0}];render();});
document.getElementById('clear').addEventListener('click',()=>{batches=[];render();});
render();

// OCR TEXT PARSER: each card starts with a pay line and must contain all fields.
// Unknown/incomplete cards are omitted rather than accidentally pairing adjacent offers.
const addressStore = [
  [/2550\s+n\s+hiawassee/i,'Walgreens'],
  [/1720\s+e\s+silver\s+star/i,'Publix'],
  [/741\s+s\s+orlando\s+ave/i,'Publix'],
  [/11055\s+daryl\s+carter/i,'Publix'],
  [/1500\s+north\s+mills/i,'The Fresh Market'],
  [/2295\s+aloma/i,'Publix'],
  [/2015\s+edgewater/i,'Publix'],
  [/2701\s+n\s+hiawassee/i,'Bravo']
];
function scanText(raw, driveMinutes){
  const lines=raw.replace(/\r/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean);
  const found=[], errors=[];
  const payLine=/^\$\s*(\d{1,4}[.,]\d{2})(?!\d)/;
  const orderLine=/(\d+)\s*(shop\s*&\s*deliver|shop\s*only|delivery\s*only)/i;
  const itemLine=/(\d+)\s*items?\s*\(\s*(\d+)\s*units?\s*\)/i;
  const mileage=/(\d+(?:\.\d+)?)\s*mi\b/i;
  for(let i=0;i<lines.length;i++){
    const payMatch=lines[i].match(payLine);
    if(!payMatch)continue;
    // $0.00 daily earnings, and payment without order details, are not offers.
    const pay=Number(payMatch[1].replace(',','.'));
    if(pay<=0)continue;
    const next=lines.slice(i+1,Math.min(lines.length,i+10));
    const orderIndex=next.findIndex(x=>orderLine.test(x));
    if(orderIndex<0||orderIndex>4)continue;
    const nextPay=next.findIndex(x=>payLine.test(x));
    const end=nextPay>=0?next.slice(0,nextPay):next;
    const order=end.find(x=>orderLine.test(x))?.match(orderLine);
    const item=end.find(x=>itemLine.test(x))?.match(itemLine);
    const mileLine=end.find(x=>mileage.test(x));
    const mile=mileLine?.match(mileage);
    if(!order||!item||!mile){errors.push('Skipped incomplete offer at '+lines[i]);continue;}
    const kind=order[2].toLowerCase().replace(/\s+/g,'');
    const deliveries=kind.includes('deliver')?Number(order[1]):0;
    const shopOnly=kind.includes('only')&&!kind.includes('delivery')?Number(order[1]):0;
    const addr=end.find(x=>/\d{2,}\s+.*(?:rd|road|ave|avenue|dr|drive|parkway|pkwy|st|street|blvd)/i.test(x))||'';
    const store=addressStore.find(([pattern])=>pattern.test(addr))?.[1]||'Unknown store';
    if(store==='Unknown store')errors.push('Unknown store for '+lines[i]+' — using 1.25×; verify store');
    if(!deliveries&&!shopOnly){errors.push('Unsupported order type at '+lines[i]);continue;}
    found.push({store,pay,items:Number(item[1]),units:Number(item[2]),miles:Number(mile[1]),drive:driveMinutes,deliveries,shopOnly,extraDrive:0,address:addr,provisional:true});
    i+=Math.max(0,end.indexOf(mileLine));
  }
  return {found,errors};
}
document.getElementById('scan').addEventListener('click',()=>{
  const raw=document.getElementById('ocr').value;
  const drive=Number(document.getElementById('ocr-drive').value);
  if(!Number.isFinite(drive)||drive<0){alert('Enter a valid drive time.');return;}
  const {found,errors}=scanText(raw,drive);
  batches=found;
  render();
  document.getElementById('scan-note').textContent=`${found.length} complete offers recognized. ${errors.join(' | ')} ${found.length?'All driving estimates are provisional.':'Check that OCR retained payment, order, items, and mileage on separate lines.'}`;
});
document.getElementById('ocr-demo').addEventListener('click',()=>{
 document.getElementById('ocr').value=`$0.00\nLooking for batches...\n3 available batches\n$9.89\n1 Shop & deliver\n3 items (3 units)\n2550 N HIAWASSEE RD, ORLANDO 1.4 mi\n$19.97\n3 Shop & deliver\n20 items (27 units)\n1720 E Silver Star Rd, Ocoee 6.0 mi\n$18.42\n2 Shop & deliver\n9 items (13 units)\n11055 Daryl Carter Parkway, Orlando 5.9 mi`;
 document.getElementById('scan').click();
});


function importShortcutText() {
  const params = new URLSearchParams(window.location.search);
  const incoming = params.get("ocr");

  if (!incoming) return;

  const textBox = document.getElementById("ocr");
  const scanButton = document.getElementById("scan");

  if (!textBox || !scanButton) return;

  textBox.value = incoming;
  scanButton.click();
}

importShortcutText();
