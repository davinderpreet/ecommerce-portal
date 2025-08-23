import requests
import json
import time

# Railway deployment URL
BASE_URL = "https://ecommerce-portal-production.up.railway.app/api"

def test_bestbuy_connection():
    print("🚀 Testing BestBuy Connection on Railway Deployment\n")
    
    # Step 1: Create test user
    print("1. Creating test user...")
    test_user = {
        "email": f"bestbuy-test-{int(time.time())}@example.com",
        "password": "testpass123",
        "firstName": "BestBuy",
        "lastName": "Tester"
    }
    
    try:
        register_response = requests.post(f"{BASE_URL}/auth/register", json=test_user)
        if register_response.status_code == 201:
            auth_token = register_response.json()["token"]
            print("✅ Test user created successfully")
        else:
            print(f"❌ User creation failed: {register_response.text}")
            return
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return
    
    # Step 2: Test BestBuy API connection
    print("\n2. Testing BestBuy API connection...")
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    try:
        bestbuy_response = requests.get(f"{BASE_URL}/bestbuy/test", headers=headers)
        result = bestbuy_response.json()
        
        print(f"Status Code: {bestbuy_response.status_code}")
        print(f"Response: {json.dumps(result, indent=2)}")
        
        if result.get("success"):
            print("\n✅ BestBuy Connection Test PASSED!")
            print(f"   Platform: {result.get('platform', 'Unknown')}")
            print(f"   API Key: {result.get('apiKey', 'Hidden')}")
            
            if result.get("data"):
                print(f"   Account Data: {json.dumps(result['data'], indent=4)}")
        else:
            print(f"\n❌ BestBuy Connection Test FAILED: {result.get('message')}")
            
            if result.get("troubleshooting"):
                print("\n💡 Troubleshooting suggestions:")
                for key, value in result["troubleshooting"].items():
                    print(f"   - {key}: {value}")
                    
    except Exception as e:
        print(f"❌ BestBuy test error: {e}")

if __name__ == "__main__":
    test_bestbuy_connection()
