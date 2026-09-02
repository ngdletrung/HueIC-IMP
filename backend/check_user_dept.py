import sys
sys.path.insert(0, r"d:\Docker\HueIC IMP\backend")

from app.db.session import SessionLocal
from app.models.user import User
from app.models.department import Department

def check_dept():
    db = SessionLocal()
    users = db.query(User).all()
    for u in users:
        print(f"User '{u.username}' (id={u.id}, role={u.role}) -> department_id={u.department_id} (dept={u.department.code if u.department else 'None'})")
    
    depts = db.query(Department).all()
    for d in depts:
        print(f"Dept id={d.id}, code='{d.code}', name='{d.name}'")
    db.close()

if __name__ == "__main__":
    check_dept()
