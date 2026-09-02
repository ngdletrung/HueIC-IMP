import sys
sys.path.insert(0, r"d:\Docker\HueIC IMP\backend")

from app.db.session import SessionLocal
from app.models.user import User
from app.models.department import Department
from app.core.security import verify_password, get_password_hash

def check_users():
    db = SessionLocal()
    print("=== DANH SÁCH USER TRONG DATABASE ===")
    users = db.query(User).all()
    for u in users:
        dept_name = u.department.name if u.department else "None"
        dept_code = u.department.code if u.department else "None"
        print(f"ID: {u.id} | Username: '{u.username}' | Email: '{u.email}' | Role: {u.role} | Dept: [{dept_code}] {dept_name} | Active: {u.is_active}")
        
        # Test password 'Hueic@123'
        is_p1 = verify_password("Hueic@123", u.hashed_password)
        is_p2 = verify_password("admin123", u.hashed_password)
        is_p3 = verify_password("123456", u.hashed_password)
        is_p4 = verify_password("Hueic@2026", u.hashed_password)
        
        valid_pwd = []
        if is_p1: valid_pwd.append("Hueic@123")
        if is_p2: valid_pwd.append("admin123")
        if is_p3: valid_pwd.append("123456")
        if is_p4: valid_pwd.append("Hueic@2026")
        
        print(f"   -> Valid passwords: {valid_pwd if valid_pwd else 'NO MATCH (unknown hash)'}")

    db.close()

if __name__ == "__main__":
    check_users()
