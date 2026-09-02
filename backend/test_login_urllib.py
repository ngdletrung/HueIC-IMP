import urllib.request
import json

def test_logins():
    base_url = "http://localhost:8000/api/v1/auth/login"
    accounts = [
        ("admin", "HueIC@123"),
        ("thcgiang", "HueIC@123"),
        ("qtdt", "HueIC@123"),
        ("ndltrung", "HueIC@123"),
        ("hvnhuong@hueic.edu.vn", "HueIC@123")
    ]
    
    print("=== TEST ĐĂNG NHẬP QUA API ===")
    for username, password in accounts:
        payload = json.dumps({"username": username, "password": password}).encode("utf-8")
        req = urllib.request.Request(base_url, data=payload, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    u = data.get("user", {})
                    print(f"✅ Đăng nhập THÀNH CÔNG: '{username}' | Role: {u.get('role')} | Name: {u.get('full_name')}")
                else:
                    print(f"❌ Đăng nhập THẤT BẠI: '{username}' -> Code {response.status}")
        except urllib.error.HTTPError as e:
            print(f"❌ Đăng nhập THẤT BẠI: '{username}' -> HTTP {e.code}: {e.read().decode('utf-8')}")
        except Exception as e:
            print(f"⚠️ Lỗi kết nối: {e}")

if __name__ == "__main__":
    test_logins()
