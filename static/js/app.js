// Global cart badge sync
async function refreshCartBadge(){
  try{
    const res = await fetch('/api/cart');
    const data = await res.json();
    const badge = document.getElementById('cart-badge');
    if(badge) badge.textContent = data.count;
    const cnt = document.getElementById('cart-count');
    if(cnt) cnt.textContent = data.count;
  }catch(e){}
}
document.addEventListener('DOMContentLoaded', refreshCartBadge);
