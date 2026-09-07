let catalogCache = [];
let currentIdentifier = "";
let catalogLoaded = false;
let activeCatalogCategory = "tortas";

const SUBCATS = {
  tortas: [
    {value:"queque", label:"Queque"},
    {value:"selva_negra", label:"Selva Negra"},
    {value:"tres_leches", label:"3 Leches"},
    {value:"tres_leches_especial", label:"3 Leches Especial"}
  ],
  bocaditos: [
    {value:"bocadito_clasico", label:"Bocadito Clásico"},
    {value:"empanada", label:"Empanada"}
  ],
  postres: [
    {value:"postre_tres_leches", label:"3 Leches"},
    {value:"postre_queque", label:"Queque Chocolate"},
    {value:"postre_helada", label:"Helada"}
  ]
};

const PRICE_TYPES = [
  {value:"size", label:"Tamaños S/M/L (ej Queque 25/35/45)"},
  {value:"size_flavor", label:"Tamaño + Sabor (Selva Negra / 3 Leches)"},
  {value:"fixed_size_especial", label:"Especial grande S/60 (con sabor)"},
  {value:"bocadito_clasico", label:"Bocadito clásico 25 S/10 / 50 S/20 /100 S/40"},
  {value:"bocadito_empanada", label:"Empanada 25u S/20 escalable"},
  {value:"fixed", label:"Precio fijo (Postres)"}
];

const DEFAULT_PRICE_TYPE_BY_SUB = {
  "queque":"size",
  "selva_negra":"size_flavor",
  "tres_leches":"size_flavor",
  "tres_leches_especial":"fixed_size_especial",
  "bocadito_clasico":"bocadito_clasico",
  "empanada":"bocadito_empanada",
  "postre_tres_leches":"fixed",
  "postre_queque":"fixed",
  "postre_helada":"fixed"
};

function formatPriceLabel(cfg){
  if(!cfg || !cfg.type) return '—';
  if(cfg.type==='size' && cfg.prices) return `S/ ${cfg.prices.pequeño||25} · S/ ${cfg.prices.mediano||35} · S/ ${cfg.prices.grande||45}`;
  if(cfg.type==='size_flavor' && cfg.prices) {
    const fl = cfg.flavors ? cfg.flavors.join(', ') : '';
    return `S/ ${cfg.prices.pequeño||30}/${cfg.prices.mediano||40}/${cfg.prices.grande||50}${fl?' · '+fl:''}`;
  }
  if(cfg.type==='fixed_size_especial') return `S/ ${cfg.price||60} · ${cfg.flavor||''} (grande)`.trim();
  if(cfg.type==='bocadito_clasico') return '25 S/10 · 50 S/20 · 100 S/40';
  if(cfg.type==='bocadito_empanada') return '25u S/20 escalable';
  if(cfg.type==='fixed') return `S/ ${cfg.price||6}${cfg.flavor?' · '+cfg.flavor:''}`;
  return '—';
}

document.querySelectorAll('.admin-tabs .tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.admin-tabs .tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.atab-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('atab-'+btn.dataset.atab).classList.add('active');
    if(btn.dataset.atab==='historial') loadHistory();
  });
});

function setCatalogCategory(cat){
  activeCatalogCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.cat===cat);
  });
  renderCatalog();
}

function clearCatalog(){
  document.getElementById('identifier-input').value='';
  catalogCache=[];
  currentIdentifier='';
  catalogLoaded=false;
  document.getElementById('catalog-grid').style.display='none';
  document.getElementById('catalog-placeholder').style.display='block';
  document.getElementById('catalog-store-name').textContent='';
  document.getElementById('catalog-grid').innerHTML='';
}

async function loadCatalog(){
  const id = document.getElementById('identifier-input').value.trim();
  if(!id){ showToast('Ingresa un identificador','error'); return; }
  currentIdentifier = id;
  const res = await fetch('/admin/api/products?identifier='+encodeURIComponent(id));
  if(!res.ok){ const e=await res.json(); showToast(e.error||'Error','error'); return; }
  catalogCache = await res.json();
  catalogLoaded = true;
  document.getElementById('catalog-placeholder').style.display='none';
  document.getElementById('catalog-grid').style.display='grid';
  document.getElementById('catalog-store-name').textContent = 'Tienda: '+id+' • '+catalogCache.length+' productos';
  document.getElementById('catalog-store-name').style.background='#6E2D0F';
  document.getElementById('catalog-store-name').style.color='white';
  document.getElementById('catalog-store-name').style.padding='6px 12px';
  document.getElementById('catalog-store-name').style.borderRadius='20px';
  setCatalogCategory(activeCatalogCategory);
  showToast('Catálogo cargado: '+catalogCache.length+' productos');
}

function renderCatalog(){
  if(!catalogLoaded){
    return;
  }
  const grid = document.getElementById('catalog-grid');
  let list = catalogCache.filter(p=>p.category===activeCatalogCategory);
  grid.innerHTML='';
  if(list.length===0){ grid.innerHTML='<div style="grid-column:1/-1; background:white; padding:20px; border-radius:12px; text-align:center">No hay productos en <strong>'+activeCatalogCategory+'</strong> para esta tienda.</div>'; return; }
  list.forEach(p=>{
    const cfg = p.price_config;
    const priceLabel = formatPriceLabel(cfg);
    const div=document.createElement('div');
    div.className='product-card';
    div.style.border='1px solid #FFE0B2';
    div.innerHTML=`
      <img src="${p.image_url}" style="height:140px; object-fit:cover">
      <div class="pc-body">
        <div style="display:flex; justify-content:space-between; align-items:center"><span style="background:#FFF8EF; border:1px solid #FFB04E; padding:2px 8px; border-radius:12px; font-size:11px">${p.category}</span><span style="font-size:11px; color:#17A2A0; font-weight:600">Stock ${p.stock}</span></div>
        <h4 style="margin-top:6px">${p.name}</h4>
        <p style="font-size:11px; color:#6E2D0F; background:#FFF8EF; padding:4px 6px; border-radius:6px; margin-top:4px">${p.subcategory}</p>
        <p style="font-size:12px; color:#6E2D0F; margin-top:6px; background:#E6F7F7; padding:6px 8px; border-radius:20px; text-align:center; font-weight:700; border:1px solid #B2E0E0">${priceLabel}</p>
        <p style="font-size:12px; color:#666; margin-top:6px">${p.description||''}</p>
        <div style="display:flex; gap:8px; margin-top:12px">
          <button class="btn btn-secondary" style="flex:1; border-radius:10px" onclick="editProduct(${p.id})">✏️ Editar</button>
          <button class="btn" style="flex:1; background:#E8547A; color:white; border-radius:10px" onclick="deleteProduct(${p.id})">🗑️ Eliminar</button>
        </div>
      </div>
    `;
    grid.appendChild(div);
  });
}

function populateSubcategories(cat, selectedValue){
  const sel = document.getElementById('p-sub');
  sel.innerHTML='';
  (SUBCATS[cat]||[]).forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.value; opt.textContent=o.label;
    sel.appendChild(opt);
  });
  if(selectedValue && [...sel.options].some(o=>o.value===selectedValue)){
    sel.value=selectedValue;
  } else if(sel.options.length>0){
    sel.selectedIndex=0;
  }
}

function populatePriceTypes(selected){
  const sel=document.getElementById('p-price-type');
  sel.innerHTML='';
  PRICE_TYPES.forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.value; opt.textContent=o.label;
    sel.appendChild(opt);
  });
  if(selected) sel.value=selected;
}

function renderPriceFields(type, existing){
  const c=document.getElementById('p-price-fields');
  existing = existing || {};
  c.innerHTML='';
  if(type==='size'){
    const pr=existing.prices||{pequeño:25, mediano:35, grande:45};
    c.innerHTML=`
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px">
        <label>Pequeño S/<input type="number" id="pf-peq" value="${pr.pequeño||25}" step="0.5" style="padding:8px; width:100%"></label>
        <label>Mediano S/<input type="number" id="pf-med" value="${pr.mediano||35}" step="0.5" style="padding:8px; width:100%"></label>
        <label>Grande S/<input type="number" id="pf-gra" value="${pr.grande||45}" step="0.5" style="padding:8px; width:100%"></label>
      </div>`;
  } else if(type==='size_flavor'){
    const pr=existing.prices||{pequeño:30, mediano:40, grande:50};
    const flavors = (existing.flavors||['vainilla','moca']).join(', ');
    c.innerHTML=`
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px">
        <label>Pequeño S/<input type="number" id="pf-peq" value="${pr.pequeño||30}" step="0.5" style="padding:8px; width:100%"></label>
        <label>Mediano S/<input type="number" id="pf-med" value="${pr.mediano||40}" step="0.5" style="padding:8px; width:100%"></label>
        <label>Grande S/<input type="number" id="pf-gra" value="${pr.grande||50}" step="0.5" style="padding:8px; width:100%"></label>
      </div>
      <label style="margin-top:8px; display:block">Sabores (separados por coma)<input type="text" id="pf-flavors" value="${flavors}" placeholder="vainilla, moca" style="padding:8px; width:100%"></label>
      <small style="color:#666">Ej: vainilla, moca</small>`;
  } else if(type==='fixed_size_especial'){
    const fl = existing.flavor||'maracuyá';
    const price = existing.price||60;
    c.innerHTML=`
      <label>Sabor<input type="text" id="pf-flavor" value="${fl}" placeholder="maracuyá, fresa, lúcuma..." style="padding:8px; width:100%"></label>
      <label style="margin-top:8px">Precio grande (fijo)<input type="number" id="pf-price" value="${price}" step="0.5" style="padding:8px; width:100%"></label>
      <small style="color:#666">Normalmente S/60 para todas las 3 leches especiales grandes.</small>`;
  } else if(type==='bocadito_clasico'){
    c.innerHTML=`<div style="background:#E6F7F7; padding:10px; border-radius:8px; font-size:13px">✅ Precio automático: 25u S/10 • 50u S/20 • 100u S/40. No requiere configuración.</div>`;
  } else if(type==='bocadito_empanada'){
    c.innerHTML=`<div style="background:#FFF0E6; padding:10px; border-radius:8px; font-size:13px">✅ Precio automático escalable: 25u S/20 (+S/20 cada 25u). Ej 50u S/40, 100u S/80.</div>`;
  } else if(type==='fixed'){
    const price = existing.price||6;
    const fl = existing.flavor||'';
    c.innerHTML=`
      <label>Precio S/<input type="number" id="pf-price" value="${price}" step="0.5" style="padding:8px; width:100%"></label>
      <label style="margin-top:8px">Sabor (opcional)<input type="text" id="pf-flavor" value="${fl}" placeholder="fresa, chocolate, oreo..." style="padding:8px; width:100%"></label>
      <small style="color:#666">Para postres: 3 leches S/6, heladas S/4.50</small>`;
  }
}

function buildPriceConfig(){
  const type=document.getElementById('p-price-type').value;
  if(type==='size'){
    return {type:"size", prices:{pequeño: parseFloat(document.getElementById('pf-peq').value)||25, mediano: parseFloat(document.getElementById('pf-med').value)||35, grande: parseFloat(document.getElementById('pf-gra').value)||45}};
  } else if(type==='size_flavor'){
    const flavors = (document.getElementById('pf-flavors').value||'').split(',').map(s=>s.trim()).filter(Boolean);
    return {type:"size_flavor", prices:{pequeño: parseFloat(document.getElementById('pf-peq').value)||30, mediano: parseFloat(document.getElementById('pf-med').value)||40, grande: parseFloat(document.getElementById('pf-gra').value)||50}, flavors: flavors.length? flavors : ['vainilla','moca']};
  } else if(type==='fixed_size_especial'){
    return {type:"fixed_size_especial", price: parseFloat(document.getElementById('pf-price').value)||60, flavor: (document.getElementById('pf-flavor').value||'maracuyá').trim(), size:"grande"};
  } else if(type==='bocadito_clasico'){
    return {type:"bocadito_clasico"};
  } else if(type==='bocadito_empanada'){
    return {type:"bocadito_empanada"};
  } else if(type==='fixed'){
    const cfg={type:"fixed", price: parseFloat(document.getElementById('pf-price').value)||6};
    const fl=(document.getElementById('pf-flavor').value||'').trim();
    if(fl) cfg.flavor=fl;
    return cfg;
  }
  return {type:"fixed", price:6};
}

document.addEventListener('DOMContentLoaded', ()=>{
  const pCat=document.getElementById('p-cat');
  const pSub=document.getElementById('p-sub');
  const pType=document.getElementById('p-price-type');
  if(pCat){
    pCat.addEventListener('change', ()=>{
      populateSubcategories(pCat.value);
      const firstSub = SUBCATS[pCat.value] ? SUBCATS[pCat.value][0].value : '';
      const defType = DEFAULT_PRICE_TYPE_BY_SUB[firstSub] || (pCat.value==='postres' ? 'fixed' : pCat.value==='bocaditos' ? 'bocadito_clasico' : 'size');
      populatePriceTypes(defType);
      renderPriceFields(defType, {});
    });
    pSub.addEventListener('change', ()=>{
      const defType = DEFAULT_PRICE_TYPE_BY_SUB[pSub.value] || document.getElementById('p-price-type').value;
      document.getElementById('p-price-type').value = defType;
      renderPriceFields(defType, {});
    });
    pType.addEventListener('change', ()=>{
      renderPriceFields(pType.value, {});
    });
    populateSubcategories(pCat.value);
    populatePriceTypes('size');
    renderPriceFields('size', {});
  }
});

function openProductModal(product=null){
  document.getElementById('product-modal').style.display='flex';
  if(product){
    document.getElementById('modal-title').textContent='✏️ Editar producto';
    document.getElementById('p-id').value=product.id;
    document.getElementById('p-name').value=product.name;
    document.getElementById('p-desc').value=product.description;
    document.getElementById('p-img').value=product.image_url;
    document.getElementById('p-cat').value=product.category;
    populateSubcategories(product.category, product.subcategory);
    document.getElementById('p-stock').value=product.stock;
    const ptype = product.price_config?.type || DEFAULT_PRICE_TYPE_BY_SUB[product.subcategory] || 'fixed';
    populatePriceTypes(ptype);
    renderPriceFields(ptype, product.price_config);
  } else {
    document.getElementById('modal-title').textContent='＋ Nuevo producto';
    document.getElementById('p-id').value='';
    document.getElementById('p-name').value='';
    document.getElementById('p-desc').value='';
    document.getElementById('p-img').value='';
    document.getElementById('p-cat').value='tortas';
    populateSubcategories('tortas');
    document.getElementById('p-stock').value=100;
    const defType = 'size';
    populatePriceTypes(defType);
    renderPriceFields(defType, {prices:{pequeño:25, mediano:35, grande:45}});
  }
}
function closeProductModal(){ document.getElementById('product-modal').style.display='none'; }

function editProduct(id){
  const prod = catalogCache.find(p=>p.id===id);
  if(prod) openProductModal(prod);
}

async function deleteProduct(id){
  if(!confirm('¿Eliminar producto? Esta acción es inmediata.')) return;
  const res = await fetch('/admin/api/product/'+id,{method:'DELETE'});
  const data = await res.json();
  if(data.ok){ showToast('🗑️ Eliminado'); loadCatalog(); } else showToast('Error','error');
}

document.getElementById('product-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!currentIdentifier){ showToast('Primero carga un identificador','error'); return; }
  let priceConfig;
  try{ priceConfig = buildPriceConfig(); } catch(err){ showToast('Error en configuración de precio','error'); return; }
  const payload = {
    identifier: currentIdentifier,
    name: document.getElementById('p-name').value,
    description: document.getElementById('p-desc').value,
    image_url: document.getElementById('p-img').value || 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500',
    category: document.getElementById('p-cat').value,
    subcategory: document.getElementById('p-sub').value,
    stock: parseInt(document.getElementById('p-stock').value||0),
    price_config: priceConfig
  };
  const pid = document.getElementById('p-id').value;
  let res;
  if(pid){
    res = await fetch('/admin/api/product/'+pid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  } else {
    res = await fetch('/admin/api/product',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }
  const data = await res.json();
  if(data.ok){
    showToast(pid? '✅ Guardado' : '✅ Creado');
    closeProductModal();
    loadCatalog();
  } else showToast(data.error||'Error','error');
});

async function loadHistory(){
  const q = document.getElementById('hist-q').value.trim();
  const res = await fetch('/admin/api/orders?q='+encodeURIComponent(q));
  const data = await res.json();
  const totalEl = document.getElementById('history-total');
  totalEl.innerHTML = `<div style="display:flex; gap:12px; flex-wrap:wrap"><span style="background:white; padding:10px 14px; border-radius:10px; border-left:4px solid #17A2A0"><strong>Monto total:</strong> S/ ${data.total_sum.toFixed(2)}</span><span style="background:white; padding:10px 14px; border-radius:10px; border-left:4px solid #FF6900"><strong>Pedidos:</strong> ${data.orders.length}</span>${q? `<span style="background:#FFF8EF; padding:10px 14px; border-radius:10px">Filtro: "${q}"</span>`:''}</div>`;
  const list = document.getElementById('history-list');
  list.innerHTML='';
  if(data.orders.length===0){ list.innerHTML='<div style="background:white; padding:20px; border-radius:12px; text-align:center; margin-top:12px">Sin resultados para la búsqueda.</div>'; return; }
  data.orders.forEach((o, idx)=>{
    const bg = idx%2===0 ? '#FFF8EF' : '#FFF';
    const payColor = o.payment_method==='yape' ? '#FF6900' : o.payment_method==='plin' ? '#17A2A0' : '#6E2D0F';
    const div=document.createElement('div');
    div.className='history-card';
    div.style.cssText=`background:${bg}; border:1px solid #FFE0B2; border-left:5px solid ${payColor}; border-radius:12px; padding:14px; margin-bottom:10px`;
    div.innerHTML=`
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
        <strong style="color:#6E2D0F">#${o.id} • ${o.store} <span style="background:${payColor}; color:white; padding:2px 8px; border-radius:12px; font-size:11px; margin-left:6px">${o.payment_method.toUpperCase()}</span></strong>
        <span style="font-size:12px; color:#666">${new Date(o.created_at).toLocaleString()}</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px; font-size:13px">
        <span>👤 <strong>${o.customer_name}</strong></span><span>🆔 DNI ${o.dni}</span>
        <span>📧 ${o.email}</span><span>📱 ${o.phone}</span>
      </div>
      <div style="margin-top:8px; font-weight:700; color:#17A2A0">💰 Total S/ ${o.total.toFixed(2)}</div>
      <details style="margin-top:8px; background:white; padding:8px; border-radius:8px"><summary style="cursor:pointer; color:#6E2D0F; font-weight:600">🧁 ${o.items.length} productos ↓</summary>
        <div style="margin-top:8px">
        ${o.items.map(it=>`<div style="display:flex; justify-content:space-between; font-size:13px; padding:6px 0; border-bottom:1px dashed #FFE0B2"><span>${it.product_name}<small style="display:block; color:#666">${it.variant_detail}</small></span><span>x${it.quantity} • <strong>S/ ${it.subtotal.toFixed(2)}</strong></span></div>`).join('')}
        </div>
      </details>
    `;
    list.appendChild(div);
  });
}

async function clearHistory(){
  if(!confirm('¿Borrar historial de la vista? (no se elimina de la BD, solo se oculta)')) return;
  const res = await fetch('/admin/api/orders/hide',{method:'POST'});
  const data=await res.json();
  if(data.ok){ showToast('Historial ocultado'); loadHistory(); setTimeout(()=>location.reload(),800); }
}

function showToast(msg,type){
  const t=document.getElementById('toast'); t.textContent=msg; t.className='toast show '+(type||''); setTimeout(()=>t.className='toast',2800);
}
