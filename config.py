import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "pasteleria-tortas-secret-key-2026")
    
    # Dual MySQL database configuration for AlwaysData
    # Database 1: for all users (public data - products, stores, orders)
    SQLALCHEMY_DATABASE_URI_USERS = os.getenv("DATABASE_URL_USERS") or f"mysql+pymysql://usuario:{os.getenv('DB_PASSWORD_USERS', 'password_users')}@mysql-xxx.alwaysdata.net/pasteleria_usuarios"
    
    # Database 2: for admin panel (administrative data)
    SQLALCHEMY_DATABASE_URI_ADMIN = os.getenv("DATABASE_URL_ADMIN") or f"mysql+pymysql://admin:{os.getenv('DB_PASSWORD_ADMIN', 'password_admin')}@mysql-xxx.alwaysdata.net/pasteleria_admin"
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    ADMIN_USER = os.getenv("ADMIN_USER", "admin")
    ADMIN_PASS = os.getenv("ADMIN_PASS", "Pasteleria2026")
    
    # Color palette - Pasteleria y Tortas
    --vaina-culo:#E7C196;    /* Fondo principal - 60% de la web - colores vainilla/hueso */
    --café-intenso:#382417;  /* Textos, estructura - 30% de la web */
    --miel:#C57938;          /* Botones de acción - 10% de la web */
    --caramelo-tostado:#6D3C1C; /* Alternativa para botones */
    
    # Derivados más claros para fondos
    --hueso:#FDFDFD;         /* Blanco hueso aún más claro para áreas extensas */
    --crema:#FFF8EF;         /* Crema suave */