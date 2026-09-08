// Tabs
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
    renderCurrent();
  });
});
document.querySelectorAll('.sub-tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const panel = btn.closest('.tab-panel');
    panel.querySelectorAll('.sub-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderCurrent();
  });
});

function getActiveSubcategory(){
  const activePanel = document.querySelector('.tab-panel.active');
  const activeSub = activePanel.querySelector('.sub-tab.active');
  return activeSub ? activeSub.dataset.sub : null;
}
function getActiveCategory(){
  return document.querySelector('.tab.active').dataset.tab;
}

function getCfg(product){
  let c = product.price_config;
  if(typeof c === 'string'){
    try{ c = JSON.parse(c); }catch(e){
      try{ c = JSON.parse(JSON.parse(JSON.stringify(c))); }catch(_){ c = {}; }
    }
  }
  if(typeof c === 'string'){
    try{ c = JSON.parse(c); }catch(_){ c = {}; }
  }
  return c || {};
}

function priceFor(product, selected){
  const cfg = getCfg(product);
  const type = cfg.type;
  if(type==='size' || type==='size_flavor'){
    const size = selected.size || 'pequeño';
    return cfg.prices[size] || 0;
  }
  if(type==='fixed_size_especial') return cfg.price || 60;
  if(type==='bocadito_clasico'){
    const map = {"25":10,"50":20,"100":40};
    return map[selected.qty]||10;
  }
  if(type==='bocadito_empanada'){
    const qty = parseInt(selected.qty||25);
    return (qty/25)*20;
  }
  if(type==='fixed') return cfg.price||6;
  return 0;
}

function renderProducts(category, subcategory){
  const gridMap = {tortas:'grid-tortas', bocaditos:'grid-bocaditos', postres:'grid-postres'};
  const grid = document.getElementById(gridMap[category]);
  const products = window.PRODUCTS.filter(p=>p.category===category && p.subcategory===subcategory);
  grid.innerHTML = '';
  if(products.length===0){
    grid.innerHTML = '<p style="color:#666; padding:20px; background:white; border-radius:12px; text-align:center">No hay productos en esta sección.</p>';
    return;
  }
  products.forEach(p=>{
    const cfg = getCfg(p);
    let controls = '';
    let initialPrice = 0;

    if(cfg.type==='size'){
      initialPrice = cfg.prices ? (cfg.prices['pequeño'] || 25) : 25;
      controls = `<label>Tamaño
        <select class="sel-size" data-id="${p.id}">
          <option value="pequeño">Pequeño S/${cfg.prices['pequeño']}</option>
          <option value="mediano">Mediano S/${cfg.prices['mediano']}</option>
          <option value="grande">Grande S/${cfg.prices['grande']}</option>
        </select></label>`;
    } else if(cfg.type==='size_flavor'){
      initialPrice = cfg.prices ? (cfg.prices['pequeño'] || 30) : 30;
      const flavorOpts = (cfg.flavors||[]).map(f=>`<option value="${f}">${f}</option>`).join('');
      controls = `<label>Sabor<select class="sel-flavor" data-id="${p.id}">${flavorOpts}</select></label>
      <label>Tamaño<select class="sel-size" data-id="${p.id}">
        <option value="pequeño">Pequeño S/${cfg.prices['pequeño']}</option>
        <option value="mediano">Mediano S/${cfg.prices['mediano']}</option>
        <option value="grande">Grande S/${cfg.prices['grande']}</option>
      </select></label>`;
    } else if(cfg.type==='fixed_size_especial'){
      initialPrice = cfg.price || 60;
      controls = `<div style="background:#FFF8EF; padding:8px; border-radius:8px; font-size:13px; border:1px dashed #FFB04E">Sabor: <strong>${cfg.flavor || ''}</strong> • Tamaño grande • <strong>S/60</strong></div>`;
    } else if(cfg.type==='bocadito_clasico'){
      initialPrice = 10;
      controls = `<label>Cantidad
        <select class="sel-qty" data-id="${p.id}">
          <option value="25">25 unidades S/10</option>
          <option value="50">50 unidades S/20</option>
          <option value="100">100 unidades S/40</option>
        </select></label>`;
    } else if(cfg.type==='bocadito_empanada'){
      initialPrice = 20;
      controls = `<label>Cantidad
        <select class="sel-qty" data-id="${p.id}">
          <option value="25">25 unidades S/20</option>
          <option value="50">50 unidades S/40</option>
          <option value="75">75 unidades S/60</option>
          <option value="100">100 unidades S/80</option>
          <option value="125">125 unidades S/100</option>
        </select></label>`;
    } else if(cfg.type==='fixed'){
      initialPrice = cfg.price || 6;
      controls = `<p style="font-size:13px; color:#666; background:#FFF8EF; padding:6px; border-radius:8px">${cfg.flavor? 'Sabor: '+cfg.flavor:''} • S/ ${initialPrice.toFixed(2)}</p>`;
    } else {
      initialPrice = cfg.price || 0;
    }

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${p.image_url}" alt="${p.name}">
      <div class="pc-body">
        <h4>${p.name}</h4>
        <p class="pc-desc">${p.description}</p>
        <div class="stock">Stock: ${p.stock} ${p.stock<10? '⚠️ Bajo stock': ''}</div>
        <div class="pc-price" id="price-${p.id}">S/ ${Number(initialPrice).toFixed(2)}</div>
        <div class="pc-controls">
          ${controls}
          <label class="qty-selector-label">Cantidad a llevar</label>
          <div class="qty-selector">
            <button type="button" class="qty-btn-custom qty-minus" onclick="changeQty(${p.id}, -1)" aria-label="Disminuir cantidad">−</button>
            <input type="number" min="1" max="${p.stock}" value="1" class="qty-input sel-count" data-id="${p.id}" inputmode="numeric">
            <button type="button" class="qty-btn-custom qty-plus" onclick="changeQty(${p.id}, 1)" aria-label="Aumentar cantidad">+</button>
          </div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="addToCart(${p.id})">Agregar al carrito</button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.sel-size, .sel-qty, .sel-flavor').forEach(el=>{
    el.addEventListener('change', ()=>{
      const pid = parseInt(el.dataset.id);
      const prod = window.PRODUCTS.find(x=>x.id===pid);
      const card = el.closest('.product-card');
      const sel = collectSelection(card, prod);
      const price = priceFor(prod, sel);
      card.querySelector(`#price-${pid}`).textContent = 'S/ ' + Number(price).toFixed(2);
    });
  });
  grid.querySelectorAll('.qty-input').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      let v = parseInt(inp.value);
      const max = parseInt(inp.max) || 999;
      if(isNaN(v) || v < 1) v = 1;
      if(v > max) v = max;
      inp.value = v;
    });
    inp.addEventListener('blur', ()=>{
      if(!inp.value || parseInt(inp.value) < 1) inp.value = 1;
    });
  });
}

function changeQty(productId, delta){
  const input = document.querySelector(`.qty-input[data-id="${productId}"]`);
  if(!input) return;
  let cur = parseInt(input.value) || 1;
  const max = parseInt(input.max) || 999;
  cur += delta;
  if(cur < 1) cur = 1;
  if(cur > max) cur = max;
  input.value = cur;
  input.dispatchEvent(new Event('input'));
}

function collectSelection(card, product){
  const cfg = getCfg(product);
  let sel = {};
  if(cfg.type==='size' || cfg.type==='size_flavor' || cfg.type==='fixed_size_especial'){
    const sizeEl = card.querySelector('.sel-size');
    if(sizeEl) sel.size = sizeEl.value;
    else sel.size = 'grande';
    const flavEl = card.querySelector('.sel-flavor');
    if(flavEl) sel.flavor = flavEl.value;
    else if(cfg.flavor) sel.flavor = cfg.flavor;
  }
  if(cfg.type==='bocadito_clasico' || cfg.type==='bocadito_empanada'){
    const qtyEl = card.querySelector('.sel-qty');
    if(qtyEl) sel.qty = qtyEl.value;
  }
  return sel;
}

async function addToCart(productId){
  const prod = window.PRODUCTS.find(p=>p.id===productId);
  const priceEl = document.getElementById(`price-${productId}`);
  const card = priceEl ? priceEl.closest('.product-card') : document.querySelector(`button[onclick="addToCart(${productId})"]`).closest('.product-card');
  const sel = collectSelection(card, prod);
  const countEl = card.querySelector('.sel-count');
  const quantity = parseInt(countEl.value||1);
  if(quantity < 1 || quantity > prod.stock){ showToast('Cantidad inválida','error'); return; }
  const variant = {};
  if(sel.size) variant.size = sel.size;
  if(sel.flavor) variant.flavor = sel.flavor;
  if(sel.qty) variant.qty = sel.qty;

  const res = await fetch('/api/cart/add',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({product_id: productId, store_id: window.STORE_ID, variant, quantity})
  });
  const data = await res.json();
  if(data.ok){
    showToast('Fue agregado a su carrito');
    const cnt = document.getElementById('cart-count');
    if(cnt) cnt.textContent = data.count;
    if(typeof refreshCartBadge === 'function'){
      try{ refreshCartBadge(); }catch(e){}
    } else {
      const badge = document.getElementById('cart-badge');
      if(badge) badge.textContent = data.count;
    }
  } else {
    showToast(data.error||'Error','error');
  }
}

let _toastTimer = null;
function showToast(msg, type){
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id='toast'; t.className='toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show '+(type||'');
  if(_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>{ t.className='toast'; }, 4000);
}

function renderCurrent(){
  const cat = getActiveCategory();
  const sub = getActiveSubcategory();
  renderProducts(cat, sub);
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderCurrent();
});
