import urllib.request
import urllib.parse
import json

def test_kpi_apis():
    base_url = "http://localhost:8000/api/v1"
    
    # 1. Login lấy token của 3 roles: admin, qtdt, ndltrung
    accounts = [
        ("admin", "HueIC@123"),
        ("qtdt", "HueIC@123"),
        ("ndltrung", "HueIC@123")
    ]
    
    tokens = {}
    for u, p in accounts:
        data = urllib.parse.urlencode({"username": u, "password": p}).encode("utf-8")
        req = urllib.request.Request(f"{base_url}/auth/login", data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                tokens[u] = res.get("access_token")
                print(f"🔑 Lấy Token thành công cho [{u}]")
        except Exception as e:
            print(f"❌ Login thất bại cho [{u}]: {e}")

    # 2. Test các API KPI với từng Token
    for u, tok in tokens.items():
        headers = {"Authorization": f"Bearer {tok}"}
        print(f"\n--- TEST KPI APIS CHO USER: [{u}] ---")
        
        # A. /kpi/spi
        try:
            req = urllib.request.Request(f"{base_url}/kpi/spi", headers=headers)
            with urllib.request.urlopen(req) as resp:
                print(f"  ✅ /kpi/spi -> {resp.status}: {resp.read().decode('utf-8')[:100]}...")
        except urllib.error.HTTPError as e:
            print(f"  ❌ /kpi/spi -> HTTP {e.code}: {e.read().decode('utf-8')}")
        except Exception as e:
            print(f"  ❌ /kpi/spi -> Lỗi: {e}")

        # B. /kpi/personal
        try:
            req = urllib.request.Request(f"{base_url}/kpi/personal", headers=headers)
            with urllib.request.urlopen(req) as resp:
                print(f"  ✅ /kpi/personal -> {resp.status}: {resp.read().decode('utf-8')[:100]}...")
        except urllib.error.HTTPError as e:
            print(f"  ❌ /kpi/personal -> HTTP {e.code}: {e.read().decode('utf-8')}")
        except Exception as e:
            print(f"  ❌ /kpi/personal -> Lỗi: {e}")

        # C. /kpi/department/4 (QTĐT có id=4 hoặc query id đầu tiên)
        try:
            req = urllib.request.Request(f"{base_url}/kpi/department/4", headers=headers)
            with urllib.request.urlopen(req) as resp:
                print(f"  ✅ /kpi/department/4 -> {resp.status}: {resp.read().decode('utf-8')[:100]}...")
        except urllib.error.HTTPError as e:
            print(f"  ❌ /kpi/department/4 -> HTTP {e.code}: {e.read().decode('utf-8')}")
        except Exception as e:
            print(f"  ❌ /kpi/department/4 -> Lỗi: {e}")

if __name__ == "__main__":
    test_kpi_apis()
