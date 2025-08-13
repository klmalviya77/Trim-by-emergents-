#!/usr/bin/env python3
"""
TrimTime Backend API Testing Suite
Tests authentication, user registration, and database operations
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:3000/api"
SUPABASE_URL = "https://wdpwhvbkbmyrwcqwdlrb.supabase.co"

class TrimTimeAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'details': details
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
        print()

    def test_health_check(self):
        """Test the health check endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok' and 'message' in data:
                    self.log_result("Health Check", True, "API is running correctly", data)
                    return True
                else:
                    self.log_result("Health Check", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Health Check", False, f"Request failed: {str(e)}")
            return False

    def test_customer_registration(self):
        """Test customer registration flow"""
        # Generate unique test data with valid email format
        test_email = f"customer.{uuid.uuid4().hex[:8]}@gmail.com"
        test_password = "TestPassword123!"
        
        try:
            # Step 1: Basic signup
            signup_data = {
                "email": test_email,
                "password": test_password
            }
            
            response = self.session.post(f"{BASE_URL}/auth/signup", json=signup_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'user' in data and data['user']:
                    user_id = data['user']['id']
                    self.log_result("Customer Signup", True, "Basic auth signup successful", {
                        'user_id': user_id,
                        'email': test_email
                    })
                    
                    # Step 2: Try to create user profile (this is what's likely missing)
                    # This should happen automatically or via a separate endpoint
                    # Let's test if we can access user data
                    
                    # First, let's try to sign in to get a session
                    signin_response = self.session.post(f"{BASE_URL}/auth/signin", json=signup_data)
                    if signin_response.status_code == 200:
                        self.log_result("Customer Signin", True, "Signin after signup successful")
                        
                        # Try to get user profile
                        user_response = self.session.get(f"{BASE_URL}/auth/user")
                        if user_response.status_code == 200:
                            self.log_result("Get User Profile", True, "Can retrieve user profile")
                        else:
                            self.log_result("Get User Profile", False, f"Cannot get user profile: {user_response.status_code}", user_response.text)
                    else:
                        self.log_result("Customer Signin", False, f"Signin failed: {signin_response.status_code}", signin_response.text)
                    
                    return True
                else:
                    self.log_result("Customer Signup", False, "No user data in response", data)
                    return False
            else:
                self.log_result("Customer Signup", False, f"Signup failed: HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Customer Registration", False, f"Request failed: {str(e)}")
            return False

    def test_barber_registration(self):
        """Test barber registration flow"""
        # Generate unique test data with valid email format
        test_email = f"barber.{uuid.uuid4().hex[:8]}@gmail.com"
        test_password = "TestPassword123!"
        
        try:
            # Step 1: Basic signup (same as customer for now)
            signup_data = {
                "email": test_email,
                "password": test_password
            }
            
            response = self.session.post(f"{BASE_URL}/auth/signup", json=signup_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'user' in data and data['user']:
                    user_id = data['user']['id']
                    self.log_result("Barber Signup", True, "Basic auth signup successful", {
                        'user_id': user_id,
                        'email': test_email
                    })
                    
                    # Step 2: Check if there's a way to create barber profile
                    # This should create a barber_shops record
                    # Let's check if there are any barber-specific endpoints
                    
                    # Sign in first
                    signin_response = self.session.post(f"{BASE_URL}/auth/signin", json=signup_data)
                    if signin_response.status_code == 200:
                        # Try to access shops endpoint (should be empty for new barber)
                        shops_response = self.session.get(f"{BASE_URL}/shops")
                        if shops_response.status_code == 200:
                            shops_data = shops_response.json()
                            self.log_result("Get Shops", True, f"Can access shops endpoint", {
                                'shop_count': len(shops_data.get('shops', []))
                            })
                        else:
                            self.log_result("Get Shops", False, f"Cannot access shops: {shops_response.status_code}", shops_response.text)
                    
                    return True
                else:
                    self.log_result("Barber Signup", False, "No user data in response", data)
                    return False
            else:
                self.log_result("Barber Signup", False, f"Signup failed: HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Barber Registration", False, f"Request failed: {str(e)}")
            return False

    def test_authentication_flow(self):
        """Test complete authentication flow"""
        test_email = f"auth.test.{uuid.uuid4().hex[:8]}@gmail.com"
        test_password = "TestPassword123!"
        
        try:
            # Step 1: Signup
            signup_data = {"email": test_email, "password": test_password}
            signup_response = self.session.post(f"{BASE_URL}/auth/signup", json=signup_data)
            
            if signup_response.status_code != 200:
                self.log_result("Auth Flow - Signup", False, f"Signup failed: {signup_response.status_code}", signup_response.text)
                return False
            
            # Step 2: Signin
            signin_response = self.session.post(f"{BASE_URL}/auth/signin", json=signup_data)
            
            if signin_response.status_code == 200:
                self.log_result("Auth Flow - Signin", True, "Signin successful")
                
                # Step 3: Access protected endpoint
                user_response = self.session.get(f"{BASE_URL}/auth/user")
                if user_response.status_code == 200:
                    self.log_result("Auth Flow - Protected Access", True, "Can access protected endpoints")
                else:
                    self.log_result("Auth Flow - Protected Access", False, f"Cannot access protected endpoint: {user_response.status_code}", user_response.text)
                
                # Step 4: Signout
                signout_response = self.session.post(f"{BASE_URL}/auth/signout", json={})
                if signout_response.status_code == 200:
                    self.log_result("Auth Flow - Signout", True, "Signout successful")
                    
                    # Step 5: Try to access protected endpoint after signout
                    protected_response = self.session.get(f"{BASE_URL}/auth/user")
                    if protected_response.status_code == 401:
                        self.log_result("Auth Flow - Post-Signout Protection", True, "Protected endpoints properly secured after signout")
                    else:
                        self.log_result("Auth Flow - Post-Signout Protection", False, f"Protected endpoint accessible after signout: {protected_response.status_code}")
                else:
                    self.log_result("Auth Flow - Signout", False, f"Signout failed: {signout_response.status_code}", signout_response.text)
                
                return True
            else:
                self.log_result("Auth Flow - Signin", False, f"Signin failed: {signin_response.status_code}", signin_response.text)
                return False
                
        except Exception as e:
            self.log_result("Authentication Flow", False, f"Request failed: {str(e)}")
            return False

    def test_database_operations(self):
        """Test database operations and RLS policies"""
        test_email = f"db.test.{uuid.uuid4().hex[:8]}@gmail.com"
        test_password = "TestPassword123!"
        
        try:
            # Create and signin user
            signup_data = {"email": test_email, "password": test_password}
            signup_response = self.session.post(f"{BASE_URL}/auth/signup", json=signup_data)
            
            if signup_response.status_code != 200:
                self.log_result("DB Test - User Creation", False, f"Cannot create user: {signup_response.status_code}", signup_response.text)
                return False
            
            signin_response = self.session.post(f"{BASE_URL}/auth/signin", json=signup_data)
            if signin_response.status_code != 200:
                self.log_result("DB Test - User Signin", False, f"Cannot signin: {signin_response.status_code}", signin_response.text)
                return False
            
            user_data = signin_response.json()['user']
            user_id = user_data['id']
            
            self.log_result("DB Test - User Creation", True, "User created and signed in", {'user_id': user_id})
            
            # Test 1: Try to get user bookings (should work even if empty)
            bookings_response = self.session.get(f"{BASE_URL}/bookings")
            if bookings_response.status_code == 200:
                bookings_data = bookings_response.json()
                self.log_result("DB Test - Get Bookings", True, "Can retrieve bookings", {
                    'booking_count': len(bookings_data.get('bookings', []))
                })
            else:
                self.log_result("DB Test - Get Bookings", False, f"Cannot get bookings: {bookings_response.status_code}", bookings_response.text)
            
            # Test 2: Try to get shops (should work)
            shops_response = self.session.get(f"{BASE_URL}/shops")
            if shops_response.status_code == 200:
                shops_data = shops_response.json()
                self.log_result("DB Test - Get Shops", True, "Can retrieve shops", {
                    'shop_count': len(shops_data.get('shops', []))
                })
            else:
                self.log_result("DB Test - Get Shops", False, f"Cannot get shops: {shops_response.status_code}", shops_response.text)
            
            # Test 3: Try to create a booking (this might fail due to RLS or missing shop)
            if shops_response.status_code == 200:
                shops_data = shops_response.json()
                if shops_data.get('shops'):
                    # Try to book with first available shop
                    shop_id = shops_data['shops'][0]['id']
                    booking_data = {
                        "shopId": shop_id,
                        "service": "Haircut"
                    }
                    
                    booking_response = self.session.post(f"{BASE_URL}/bookings", json=booking_data)
                    if booking_response.status_code == 200:
                        self.log_result("DB Test - Create Booking", True, "Can create booking")
                    else:
                        self.log_result("DB Test - Create Booking", False, f"Cannot create booking: {booking_response.status_code}", booking_response.text)
                else:
                    self.log_result("DB Test - Create Booking", False, "No shops available to test booking")
            
            return True
            
        except Exception as e:
            self.log_result("Database Operations", False, f"Request failed: {str(e)}")
            return False

    def test_error_scenarios(self):
        """Test error handling scenarios"""
        try:
            # Test 1: Invalid credentials
            invalid_signin = self.session.post(f"{BASE_URL}/auth/signin", json={
                "email": "nonexistent@test.com",
                "password": "wrongpassword"
            })
            
            if invalid_signin.status_code == 400:
                self.log_result("Error Handling - Invalid Credentials", True, "Properly rejects invalid credentials")
            else:
                self.log_result("Error Handling - Invalid Credentials", False, f"Unexpected response: {invalid_signin.status_code}")
            
            # Test 2: Malformed requests
            malformed_response = self.session.post(f"{BASE_URL}/auth/signin", json={
                "invalid": "data"
            })
            
            if malformed_response.status_code >= 400:
                self.log_result("Error Handling - Malformed Request", True, "Properly handles malformed requests")
            else:
                self.log_result("Error Handling - Malformed Request", False, f"Accepts malformed request: {malformed_response.status_code}")
            
            # Test 3: Non-existent endpoints
            not_found_response = self.session.get(f"{BASE_URL}/nonexistent")
            
            if not_found_response.status_code == 404:
                self.log_result("Error Handling - Not Found", True, "Properly returns 404 for non-existent endpoints")
            else:
                self.log_result("Error Handling - Not Found", False, f"Unexpected response for non-existent endpoint: {not_found_response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Error Scenarios", False, f"Request failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests and generate summary"""
        print("=" * 60)
        print("TrimTime Backend API Test Suite")
        print("=" * 60)
        print()
        
        # Run tests
        tests = [
            self.test_health_check,
            self.test_customer_registration,
            self.test_barber_registration,
            self.test_authentication_flow,
            self.test_database_operations,
            self.test_error_scenarios
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_result(test.__name__, False, f"Test execution failed: {str(e)}")
            
            time.sleep(1)  # Brief pause between tests
        
        # Generate summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"❌ {result['test']}: {result['message']}")
                    if result['details']:
                        print(f"   Details: {result['details']}")
            print()
        
        print("CRITICAL ISSUES IDENTIFIED:")
        
        # Analyze results for critical issues
        critical_issues = []
        
        # Check for missing user registration
        signup_tests = [r for r in self.test_results if 'Signup' in r['test']]
        profile_tests = [r for r in self.test_results if 'Profile' in r['test']]
        
        if any(not r['success'] for r in profile_tests):
            critical_issues.append("❌ User profile creation missing after signup - RLS policies likely failing")
        
        # Check for authentication issues
        auth_tests = [r for r in self.test_results if 'Auth' in r['test']]
        if any(not r['success'] for r in auth_tests):
            critical_issues.append("❌ Authentication flow has critical issues")
        
        # Check for database issues
        db_tests = [r for r in self.test_results if 'DB Test' in r['test']]
        if any(not r['success'] for r in db_tests):
            critical_issues.append("❌ Database operations failing - likely RLS policy violations")
        
        if not critical_issues:
            critical_issues.append("✅ No critical issues identified")
        
        for issue in critical_issues:
            print(issue)
        
        print()
        print("RECOMMENDATIONS:")
        print("1. Implement user profile creation in users table after auth signup")
        print("2. Add role-based registration (customer vs barber)")
        print("3. Create barber_shops records for barber users")
        print("4. Verify RLS policies allow users to create their own records")
        print("5. Add proper error handling for database operations")
        
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = TrimTimeAPITester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)