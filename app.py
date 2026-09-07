import os
import json
import re
from datetime import datetime
from functools import wraps

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash, abort
from flask_sqlalchemy import SQLAlchemy

# Configuración dual de bases de datos
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

# Configurar dos bases de datos
# Base de datos 1: Usuarios (productos, tiendas, órdenes)
app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI_USERS']
db_users = SQLAlchemy(app)

# Base de datos 2: Panel de administración (datos administrativos)
app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI_ADMIN']
db_admin = SQLAlchemy(app)

# Modelos de la base de datos para usuarios (clientes)
class Store(db_users.Model):
    __tablename__ = "stores"
    id = db_users.Column(db_users.Integer, primary_key=True)
    name = db_users.Column(db_users.String(120), nullable=False)
    slug = db_users.Column(db_users.String(80), unique=True, nullable=False)
    address = db_users.Column(db_users.String(200), default="")
    image_url = db_users.Column(db_users.String(500), default="")
    identifier = db_users.Column(db_users.String(50), unique=True, nullable=False)  # oculto, solo visible en código / admin
    is_open = db_users.Column(db_users.Boolean, default=True)
    phone = db_users.Column(db_users.String(30), default="943846909")
    products = db_users.relationship("Product", backref="store", cascade="all, delete-orphan", lazy=True)
    orders = db_users.relationship("Order", backref="store", lazy=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "slug": self.slug, "address": self.address, "image_url": self.image_url, "identifier": self.identifier, "is_open": self.is_open}

class Product(db_users.Model):
    __tablename__ = "products"
    id = db_users.Column(db_users.Integer, primary_key=True)
    store_id = db_users.Column(db_users.Integer, db_users.ForeignKey("stores.id"), nullable=False)
    category = db_users.Column(db_users.String(30), nullable=False)  # tortas, bocaditos, postres
    subcategory = db_users.Column(db_users.String(50), nullable=False)
    name = db_users.Column(db_users.String(120), nullable=False)
    description = db_users.Column(db_users.String(500), default="")
    image_url = db_users.Column(db_users.String(500), default="")
    stock = db_users.Column(db_users.Integer, default=100)
    # JSON con configuración de precio: {"type":"size","prices":{"pequeño":25,...}, "flavors":[...]}
    price_config = db_users.Column(db_users.Text, default="{}")
    is_active = db_users.Column(db_users.Boolean, default=True)

    def get_price_config(self):
        try:
            return json.loads(self.price_config) if self.price_config else {}
        except:
            return {}

    def to_dict(self):
        return {
            "id": self.id, "store_id": self.store_id, "category": self.category,
            "subcategory": self.subcategory, "name": self.name, "description": self.description,
            "image_url": self.image_url, "stock": self.stock, "price_config": self.get_price_config(),
            "is_active": self.is_active
        }

class Order(db_users.Model):
    __tablename__ = "orders"
    id = db_users.Column(db_users.Integer, primary_key=True)
    store_id = db_users.Column(db_users.Integer, db_users.ForeignKey("stores.id"), nullable=False)
    customer_name = db_users.Column(db_users.String(120), nullable=False)
    dni = db_users.Column(db_users.String(20), nullable=False)
    email = db_users.Column(db_users.String(120), nullable=False)
    phone = db_users.Column(db_users.String(30), nullable=False)
    payment_method = db_users.Column(db_users.String(30), nullable=False)  # yape, plin, tarjeta
    total = db_users.Column(db_users.Float, nullable=False, default=0)
    status = db_users.Column(db_users.String(30), default="nuevo")
    created_at = db_users.Column(db_users.DateTime, default=datetime.utcnow)
    # para historial borrable sin borrar BD real: soft delete flag solo visual
    hidden = db_users.Column(db_users.Boolean, default=False)
    items = db_users.relationship("OrderItem", backref="order", cascade="all, delete-orphan", lazy=True)

class OrderItem(db_users.Model):
    __tablename__ = "order_items"
    id = db_users.Column(db_users.Integer, primary_key=True)
    order_id = db_users.Column(db_users.Integer, db_users.ForeignKey("orders.id"), nullable=False)
    product_id = db_users.Column(db_users.Integer, db_users.ForeignKey("products.id"), nullable=True)
    product_name = db_users.Column(db_users.String(120), nullable=False)
    variant_detail = db_users.Column(db_users.String(300), default="")  # ej: "Sabor: maracuyá | Tamaño: grande"
    quantity = db_users.Column(db_users.Integer, default=1)
    unit_price = db_users.Column(db_users.Float, nullable=False)
    subtotal = db_users.Column(db_users.Float, nullable=False)

# Modelos para la base de datos de administración
class AdminSetting(db_admin.Model):
    __tablename__ = "admin_settings"
    id = db_admin.Column(db_admin.Integer, primary_key=True)
    key = db_admin.Column(db_admin.String(80), unique=True, nullable=False)
    value = db_admin.Column(db_admin.String(500), default="")
    updated_at = db_admin.Column(db_admin.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AdminLog(db_admin.Model):
    __tablename__ = "admin_logs"
    id = db_admin.Column(db_admin.Integer, primary_key=True)
    action = db_admin.Column(db_admin.String(100), nullable=False)
    user_id = db_admin.Column(db_admin.Integer, nullable=True)
    ip_address = db_admin.Column(db_admin.String(50), nullable=True)
    created_at = db_admin.Column(db_admin.DateTime, default=datetime.utcnow)

# ===================== HELPERS =====================
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged"):
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorated

def calculate_price(product_dict_or_obj, selected):
    """Calcula precio según selección. selected = {size, flavor, qty_option}"""
    cfg = product_dict_or_obj.get_price_config() if hasattr(product_dict_or_obj, 'get_price_config') else product_dict_or_obj.get("price_config", {})
    ptype = cfg.get("type", "fixed")
    if ptype == "size":
        size = selected.get("size", "pequeño")
        return float(cfg.get("prices", {}).get(size, 0))
    elif ptype == "size_flavor":
        size = selected.get("size", "pequeño")
        return float(cfg.get("prices", {}).get(size, 0))
    elif ptype == "fixed_size_especial":
        return float(cfg.get("price", 60))
    elif ptype == "bocadito_clasico":
        qty = selected.get("qty", "25")
        mapping = {"25":10, "50":20, "100":40}
        return float(mapping.get(str(qty), 10))
    elif ptype == "bocadito_empanada":
        qty = int(selected.get("qty", 25))
        units = max(1, qty // 25)
        return float(units * 20)
    elif ptype == "fixed":
        return float(cfg.get("price", 6))
    return 0.0

def get_cart():
    return session.get("cart", [])

def save_cart(cart):
    session["cart"] = cart
    session.modified = True

def cart_total(cart):
    return round(sum(float(i.get("subtotal",0)) for i in cart), 2)

# ===================== SEED DATA =====================
def seed_data():
    # Usar la base de datos de usuarios
    with app.app_context():
        db_users.create_all()
        
        # Verificar si ya existen datos
        existing = Store.query.first()
        if existing:
            # Already seeded, just ensure products exist
            if Product.query.first():
                return
        
        stores_data = [
            {"name":"Pastelería Tortas Perú - Centro","slug":"centro","address":"Av. Principal N°123","identifier":"PT-CENTRO-2026-A7X9","image_url":"https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600"},
            {"name":"Pastelería Tortas Perú - Miraflores","slug":"miraflores","address":"Jirón de la Selva N°456","identifier":"PT-MIRA-2026-B3K1","image_url":"https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600"},
            {"name":"Pastelería Tortas Perú - Surco","slug":"surco","address":"Av. Industriales N°789","identifier":"PT-SURCO-2026-C8M2","image_url":"https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600"},
            {"name":"Pastelería Tortas Perú - Gamarra","slug":"gamarra","address":"Jirón Real N°3444","identifier":"PT-GAMARRA-2026-D4N5","image_url":"https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600"},
            {"name":"Pastelería Tortas Perú - San Juan","slug":"san-juan","address":"Regional, Los Pasajes N°4145","identifier":"PT-SANJUAN-2026-E9P6","image_url":"https://images.unsplash.com/photo-1571115177098-8ed21de65d8e?w=600"},
        ]
        
        existing_store_ids = {s.slug for s in Store.query.all()}
        
        for sd in stores_data:
            if sd["slug"] not in existing_store_ids:
                s = Store(**sd)
                db_users.session.add(s)
        
        db_users.session.commit()
        stores = Store.query.all()
        
        # Helper para crear productos
        def add_product(store, category, subcategory, name, desc, img, stock, cfg):
            p = Product(store_id=store.id, category=category, subcategory=subcategory, name=name, description=desc, image_url=img, stock=stock, price_config=json.dumps(cfg))
            db_users.session.add(p)
        
        for store in stores:
            # --- TORTAS ---
            # Tortas de queque
            add_product(store,"tortas","queque","Torta de Queque","Bizcocho esponjoso tradicional, ideal para cumpleaños.","https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500",80, {"type":"size","prices":{"pequeño":25,"mediano":35,"grande":45}})
            # Tortas selva negra (vainilla y moca)
            add_product(store,"tortas","selva_negra","Torta Selva Negra","Clásica selva negra con cerezas y crema chantilly.","https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500",60, {"type":"size_flavor","prices":{"pequeño":30,"mediano":40,"grande":50},"flavors":["vainilla","moca"]})
            # Tortas 3 leches (moca, vainilla)
            add_product(store,"tortas","tres_leches","Torta Tres Leches Clásica","Húmeda y cremosa tres leches tradicional.","https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=500",60, {"type":"size_flavor","prices":{"pequeño":30,"mediano":40,"grande":50},"flavors":["moca","vainilla"]})
            # Tortas 3 leches especial sabores (grande 60)
            for sabor in ["maracuyá","fresa","lúcuma","mango","coco","café"]:
                add_product(store,"tortas","tres_leches_especial",f"Torta 3 Leches - {sabor.capitalize()}","Tres leches especial sabor "+sabor+", tamaño grande.", "https://images.unsplash.com/photo-1542826438-bd32f43d626f?w=500",40, {"type":"fixed_size_especial","price":60,"flavor":sabor,"size":"grande"})
            # --- BOCADITOS ---
            for b in ["queso","jamón","orejitas","conito","alfajorcito","bizcotela"]:
                add_product(store,"bocaditos","bocadito_clasico",f"Bocadito de {b.capitalize()}","Bocaditos dulces/salados perfectos para mesas.","https://images.unsplash.com/photo-1551024506-0bccd828d307?w=500",200, {"type":"bocadito_clasico","name":b})
            for emp in ["carne","pollo"]:
                add_product(store,"bocaditos","empanada",f"Empanada de {emp.capitalize()}","Empanada horneada jugosa.","https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=500",150, {"type":"bocadito_empanada","name":emp})
            # --- POSTRES ---
            for sabor in ["fresa","clásica (vainilla)","maracuyá","limón","moca/café","mango","coco","lúcuma"]:
                add_product(store,"postres","postre_tres_leches",f"Postre 3 Leches - {sabor.capitalize()}","Vasito individual 3 leches.","https://images.unsplash.com/photo-1488477181946-64290103bb53?w=500",100, {"type":"fixed","price":6,"flavor":sabor})
            for sabor in ["selva negra","chocolate"]:
                add_product(store,"postres","postre_queque",f"Postre Queque - {sabor.capitalize()}","Porción de queque de chocolate.","https://images.unsplash.com/photo-1559620192-032c4bc4674e?w=500",100, {"type":"fixed","price":6,"flavor":sabor})
            for sabor in ["torta helada clásica","helada de oreo"]:
                add_product(store,"postres","postre_helada",f"Postre Helado - {sabor.capitalize()}","Postre frío de chocolate.","https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500",100, {"type":"fixed","price":4.5,"flavor":sabor})
        
        db_users.session.commit()
        print("Seed completado con 5 tiendas y catálogo para base de usuarios.")

# ===================== RUTAS PÚBLICAS =====================
@app.route("/")
def index():
    stores = Store.query.all()
    return render_template("index.html", stores=stores)

@app.route("/tienda/<slug>")
def tienda(slug):
    store = Store.query.filter_by(slug=slug).first_or_404()
    products = Product.query.filter_by(store_id=store.id, is_active=True).all()
    grouped = {"tortas":[],"bocaditos":[],"postres":[]}
    for p in products:
        grouped[p.category].append(p)
    return render_template("tienda.html", store=store, grouped=grouped, products=products)

@app.route("/carrito")
def carrito():
    cart = get_cart()
    total = cart_total(cart)
    return render_template("carrito.html", cart=cart, total=total)

@app.route("/checkout")
def checkout_page():
    cart = get_cart()
    if not cart:
        flash("Tu carrito está vacío","warning")
        return redirect(url_for("index"))
    total = cart_total(cart)
    return render_template("checkout.html", cart=cart, total=total)

@app.route("/compra-exitosa/<int:order_id>")
def compra_exitosa(order_id):
    order = Order.query.get_or_404(order_id)
    return render_template("exito.html", order=order)

# ===================== API CART =====================
@app.route("/api/cart/add", methods=["POST"])
def api_cart_add():
    data = request.get_json()
    product_id = data.get("product_id")
    store_id = data.get("store_id")
    variant = data.get("variant", {})  # {size, flavor, qty}
    qty_units = int(data.get("quantity", 1))  # cantidad de veces que compra ese producto (ej 2 tortas)
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error":"Producto no encontrado"}), 404
    cfg = product.get_price_config()
    # calcular precio unitario según variante
    selected = {}
    if cfg.get("type") in ["size","size_flavor","fixed_size_especial"]:
        selected["size"] = variant.get("size","pequeño" if cfg.get("type")!="fixed_size_especial" else "grande")
        selected["flavor"] = variant.get("flavor")
    elif cfg.get("type") in ["bocadito_clasico","bocadito_empanada"]:
        selected["qty"] = variant.get("qty","25")
    unit_price = calculate_price(product, selected)
    # detalle variante para mostrar
    detail_parts=[]
    if selected.get("flavor"):
        detail_parts.append(f"Sabor: {selected['flavor']}")
    if selected.get("size"):
        detail_parts.append(f"Tamaño: {selected['size']}")
    if selected.get("qty"):
        detail_parts.append(f"Cantidad: {selected['qty']} unidades")
    variant_detail = " | ".join(detail_parts) if detail_parts else "Estándar"
    # verificar stock
    if product.stock < qty_units:
        return jsonify({"error":"Stock insuficiente"}), 400
    cart = get_cart()
    # buscar si ya existe mismo producto+variante
    found=False
    for item in cart:
        if item["product_id"]==product_id and item["variant_detail"]==variant_detail and item["unit_price"]==unit_price:
            item["quantity"] += qty_units
            item["subtotal"] = round(item["quantity"]*item["unit_price"],2)
            found=True
            break
    if not found:
        cart.append({
            "product_id": product.id,
            "store_id": product.store_id,
            "store_slug": product.store.slug if product.store else "",
            "store_name": product.store.name if product.store else "",
            "name": product.name,
            "image_url": product.image_url,
            "variant_detail": variant_detail,
            "unit_price": unit_price,
            "quantity": qty_units,
            "subtotal": round(unit_price*qty_units,2),
            "category": product.category
        })
    save_cart(cart)
    return jsonify({"ok":True, "cart":cart, "total":cart_total(cart), "count": sum(i["quantity"] for i in cart)})

@app.route("/api/cart/update", methods=["POST"])
def api_cart_update():
    data = request.get_json()
    idx = int(data.get("index", -1))
    action = data.get("action")  # increase, decrease, set
    quantity = data.get("quantity")
    cart = get_cart()
    if idx <0 or idx >= len(cart):
        return jsonify({"error":"Índice inválido"}),400
    if action=="increase":
        cart[idx]["quantity"]+=1
    elif action=="decrease":
        cart[idx]["quantity"]-=1
        if cart[idx]["quantity"]<=0:
            cart.pop(idx)
            save_cart(cart)
            return jsonify({"ok":True,"cart":cart,"total":cart_total(cart)})
    elif action=="set" and quantity is not None:
        q=int(quantity)
        if q<=0:
            cart.pop(idx)
        else:
            cart[idx]["quantity"]=q
    elif quantity is not None:
        cart[idx]["quantity"]=int(quantity)
    if idx < len(cart):
        cart[idx]["subtotal"]= round(cart[idx]["quantity"]*cart[idx]["unit_price"],2)
    save_cart(cart)
    return jsonify({"ok":True,"cart":cart,"total":cart_total(cart)})

@app.route("/api/cart/remove", methods=["POST"])
def api_cart_remove():
    data=request.get_json()
    idx=int(data.get("index",-1))
    cart=get_cart()
    if 0 <= idx < len(cart):
        cart.pop(idx)
        save_cart(cart)
    return jsonify({"ok":True,"cart":cart,"total":cart_total(cart)})

@app.route("/api/cart", methods=["GET"])
def api_cart_get():
    cart=get_cart()
    return jsonify({"cart":cart,"total":cart_total(cart),"count":sum(i["quantity"] for i in cart)})

@app.route("/api/cart/clear", methods=["POST"])
def api_cart_clear():
    save_cart([])
    return jsonify({"ok":True})

# ===================== CHECKOUT POST CON WHATSAPP =====================
@app.route("/api/checkout", methods=["POST"])
def api_checkout():
    data=request.get_json()
    cart=get_cart()
    if not cart:
        return jsonify({"error":"Carrito vacío"}),400
    nombre=data.get("nombre","").strip()
    dni=data.get("dni","").strip()
    email=data.get("email","").strip()
    phone=data.get("phone","").strip()
    payment=data.get("payment_method","yape")
    
    if not all([nombre,dni,email,phone]):
        return jsonify({"error":"Faltan datos del cliente"}),400
    
    # Validar celular peruano: 9 dígitos empezando por 9
    if not re.match(r'^9\d{8}$', phone):
        return jsonify({"error":"Celular inválido: debe tener 9 dígitos y empezar con 9"}),400
    
    if not re.match(r'^\d{8}$', dni):
        return jsonify({"error":"DNI inválido: debe tener 8 dígitos"}),400
    
    # Asumir todos los items son de la misma tienda (o tomar la primera)
    store_id = cart[0].get("store_id")
    store = Store.query.get(store_id)
    total = cart_total(cart)
    
    # CREAR ORDEN EN BASE DE DATOS
    order = Order(store_id=store_id, customer_name=nombre, dni=dni, email=email, phone=phone, payment_method=payment, total=total)
    db_users.session.add(order)
    db_users.session.flush()
    
    for c in cart:
        oi = OrderItem(order_id=order.id, product_id=c["product_id"], product_name=c["name"], variant_detail=c["variant_detail"], quantity=c["quantity"], unit_price=c["unit_price"], subtotal=c["subtotal"])
        db_users.session.add(oi)
        # descontar stock
        prod=Product.query.get(c["product_id"])
        if prod:
            prod.stock = max(0, prod.stock - c["quantity"])
    db_users.session.commit()
    save_cart([])
    
    # ENVIAR MENSAJE A WHATSAPP
    whatsapp_message = f"Hola! Acabo de realizar una reserva de mi compra de tortas en su página web. Aquí le adjunto la foto del pago de Yape."
    whatsapp_url = f"https://wa.me/51943846909?text={whatsapp_message}"
    
    return jsonify({"ok":True,"order_id":order.id,"whatsapp_url":whatsapp_url})

@app.route("/checkout", methods=["POST"])
def checkout_post():
    # fallback form submit
    cart=get_cart()
    if not cart:
        return redirect(url_for("index"))
    nombre=request.form.get("nombre","")
    dni=request.form.get("dni","")
    email=request.form.get("email","")
    phone=request.form.get("phone","")
    payment=request.form.get("payment_method","yape")
    store_id=cart[0].get("store_id")
    total=cart_total(cart)
    order=Order(store_id=store_id,customer_name=nombre,dni=dni,email=email,phone=phone,payment_method=payment,total=total)
    db_users.session.add(order)
    db.session.flush()
    for c in cart:
        oi=OrderItem(order_id=order.id,product_id=c["product_id"],product_name=c["name"],variant_detail=c["variant_detail"],quantity=c["quantity"],unit_price=c["unit_price"],subtotal=c["subtotal"])
        db.session.add(oi)
    db.session.commit()
    save_cart([])
    return redirect(url_for("compra_exitosa",order_id=order.id))

# ===================== MICROSERVICIOS: COMUNICACIÓN AUTOMÁTICA =====================
# Microservicio de notificaciones - se comunica con el servicio principal
# Cuando una orden es nueva, este microservicio envía notificación por WhatsApp

def notificar_nueva_pedido(order_id, customer_name, phone, total, items_summary):
    """
    Función para notificar nuevos pedidos mediante WhatsApp.
    Esta función puede ser llamada por un microservicio separado o como tarea programada.
    """
    whatsapp_message = f"🧁 NUEVO PEDIDO #{order_id}\n"
    whatsapp_message += f"Cliente: {customer_name}\n"
    whatsapp_message += f"Teléfono: {phone}\n"
    whatsapp_message += f"Total: S/ {total:.2f}\n"
    whatsapp_message += f"Productos: {items_summary}\n"
    whatsapp_message += "Acabo de realizar una reserva de mi compra de tortas en su página web."
    
    whatsapp_url = f"https://wa.me/51943846909?text={whatsapp_message.replace(' ', '%20')}"
    return whatsapp_url

# ===================== ADMIN =====================
@app.route("/admin/login", methods=["GET","POST"])
def admin_login():
    if request.method=="POST":
        user=request.form.get("username")
        pwd=request.form.get("password")
        if user==app.config["ADMIN_USER"] and pwd==app.config["ADMIN_PASS"]:
            session["admin_logged"]=True
            return redirect(url_for("admin_dashboard"))
        flash("Credenciales incorrectas","danger")
    return render_template("admin/login.html")

@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_logged",None)
    return redirect(url_for("admin_login"))

@app.route("/admin")
def admin_redirect():
    if session.get("admin_logged"):
        return redirect(url_for("admin_dashboard"))
    return redirect(url_for("admin_login"))

@app.route("/admin/dashboard")
@login_required
def admin_dashboard():
    stores=Store.query.all()
    orders=Order.query.filter_by(hidden=False).order_by(Order.created_at.desc()).all()
    total_sum = db_users.session.query(db_users.func.sum(Order.total)).filter_by(hidden=False).scalar() or 0
    products=Product.query.all()
    return render_template("admin/dashboard.html", stores=stores, orders=orders, total_sum=total_sum, products=products)

# API admin productos
@app.route("/admin/api/products", methods=["GET"])
@login_required
def admin_api_products():
    identifier = request.args.get("identifier")
    if identifier:
        store=Store.query.filter_by(identifier=identifier).first()
        if not store:
            return jsonify({"error":"Identificador no encontrado"}),404
        prods=Product.query.filter_by(store_id=store.id).all()
    else:
        prods=Product.query.all()
    return jsonify([p.to_dict() for p in prods])

@app.route("/admin/api/stores", methods=["GET"])
@login_required
def admin_api_stores():
    stores=Store.query.all()
    return jsonify([s.to_dict() for s in stores])

@app.route("/admin/api/product", methods=["POST"])
@login_required
def admin_create_product():
    data=request.get_json()
    identifier=data.get("identifier")
    store=Store.query.filter_by(identifier=identifier).first()
    if not store:
        return jsonify({"error":"Identificador inválido"}),400
    try:
        p=Product(
            store_id=store.id,
            category=data.get("category"),
            subcategory=data.get("subcategory","general"),
            name=data.get("name"),
            description=data.get("description",""),
            image_url=data.get("image_url",""),
            stock=int(data.get("stock",100)),
            price_config=json.dumps(data.get("price_config",{}))
        )
        db_users.session.add(p)
        db_users.session.commit()
        return jsonify({"ok":True,"product":p.to_dict()})
    except Exception as e:
        return jsonify({"error":str(e)}),500

@app.route("/admin/api/product/<int:pid>", methods=["PUT"])
@login_required
def admin_update_product(pid):
    p=Product.query.get_or_404(pid)
    data=request.get_json()
    p.category=data.get("category",p.category)
    p.subcategory=data.get("subcategory",p.subcategory)
    p.name=data.get("name",p.name)
    p.description=data.get("description",p.description)
    p.image_url=data.get("image_url",p.image_url)
    if "stock" in data:
        p.stock=int(data["stock"])
    if "price_config" in data:
        p.price_config=json.dumps(data["price_config"])
    if "is_active" in data:
        p.is_active=bool(data["is_active"])
    db_users.session.commit()
    return jsonify({"ok":True,"product":p.to_dict()})

@app.route("/admin/api/product/<int:pid>", methods=["DELETE"])
@login_required
def admin_delete_product(pid):
    p=Product.query.get_or_404(pid)
    db_users.session.delete(p)
    db_users.session.commit()
    return jsonify({"ok":True})

@app.route("/admin/api/orders", methods=["GET"])
@login_required
def admin_api_orders():
    q=request.args.get("q","").strip().lower()
    query=Order.query.filter_by(hidden=False)
    if q:
        query=query.filter(db_users.or_(db_users.func.lower(Order.customer_name).like(f"%{q}%"), Order.dni.like(f"%{q}%")))
    orders=query.order_by(Order.created_at.desc()).all()
    result=[]
    for o in orders:
        result.append({
            "id":o.id,"store":o.store.name if o.store else "","customer_name":o.customer_name,"dni":o.dni,"email":o.email,"phone":o.phone,"payment_method":o.payment_method,"total":o.total,"created_at":o.created_at.isoformat(),"status":o.status,
            "items":[{"product_name":i.product_name,"variant_detail":i.variant_detail,"quantity":i.quantity,"unit_price":i.unit_price,"subtotal":i.subtotal} for i in o.items]
        })
    total = sum(o.total for o in orders)
    return jsonify({"orders":result,"total_sum":total})

@app.route("/admin/api/orders/hide", methods=["POST"])
@login_required
def admin_hide_history():
    # borra visualmente (hidden=True) pero no borra BD real
    Order.query.update({Order.hidden: True})
    db_users.session.commit()
    return jsonify({"ok":True})

@app.route("/admin/api/orders/<int:oid>/status", methods=["PUT"])
@login_required
def admin_update_order_status(oid):
    o=Order.query.get_or_404(oid)
    data=request.get_json()
    o.status=data.get("status",o.status)
    db_users.session.commit()
    return jsonify({"ok":True})

# ===================== INIT =====================
@app.before_request
def before_first():
    # ensure tables exist (solo primera vez)
    if not hasattr(app, "_seed_done"):
        with app.app_context():
            try:
                seed_data()
            except Exception as e:
                print("seed error",e)
        app._seed_done=True

@app.context_processor
def inject_cart():
    cart=get_cart()
    return {"cart_count": sum(i["quantity"] for i in cart), "cart_total": cart_total(cart)}

if __name__=="__main__":
    with app.app_context():
        db_users.create_all()
        seed_data()
    port=int(os.getenv("PORT",5000))
    app.run(host="0.0.0.0",port=port,debug=True)