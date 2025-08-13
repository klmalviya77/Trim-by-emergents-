#!/usr/bin/env python3
"""
TrimTime Backend API Testing Suite - Simplified
Focus on core functionality without email confirmation requirements
"""

import requests
import json
import time
import uuid
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:3000/api"

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

    def test_user_registration_flow(self):
        """Test user registration and identify missing components"""
        test_email = f"test.user.{uuid.uuid4().hex[:8]}@gmail.com"
        test_password = "TestPassword123!"
        
        try:
            # Step 1: Test signup
            signup_data = {"email": test_email, "password": test_password}
            signup_response = self.session.post(f"{BASE_URL}/auth/signup", json=signup_data)
            
            if signup_response.status_code == 200:
                signup_data_response = signup_response.json()
                user_id = signup_data_response.get('user', {}).get('id')
                
                self.log_result("User Signup", True, "Supabase auth user created successfully", {
                    'user_id': user_id,
                    'email': test_email,
                    'email_confirmed': signup_data_response.get('user', {}).get('email_confirmed_at') is not None
                })
                
                # Step 2: Check what happens when we try to signin (expected to fail due to email confirmation)
                signin_response = self.session.post(f"{BASE_URL}/auth/signin", json=signup_data)
                
                if signin_response.status_code == 400:
                    error_data = signin_response.json()
                    if "Email not confirmed" in error_data.get('error', ''):
                        self.log_result("Email Confirmation Required", True, "Supabase correctly requires email confirmation", error_data)
                    else:
                        self.log_result("Signin Error", False, f"Unexpected signin error: {error_data}")
                else:
                    self.log_result("Unexpected Signin Success", False, "Signin succeeded without email confirmation", signin_response.json())
                
                return True
            else:
                self.log_result("User Signup", False, f"Signup failed: HTTP {signup_response.status_code}", signup_response.text)
                return False
                
        except Exception as e:
            self.log_result("User Registration Flow", False, f"Request failed: {str(e)}")
            return False

    def test_missing_user_profile_creation(self):
        """Test to identify missing user profile creation in users table"""
        try:
            # This test identifies that there's no endpoint to create user profiles
            # after Supabase auth signup
            
            # Check if there's a user profile creation endpoint
            profile_endpoints_to_test = [
                "/users/profile",
                "/auth/profile", 
                "/users/create",
                "/profile/create"
            ]
            
            found_profile_endpoint = False
            
            for endpoint in profile_endpoints_to_test:
                response = self.session.post(f"{BASE_URL}{endpoint}", json={
                    "name": "Test User",
                    "role": "customer"
                })
                
                if response.status_code != 404:
                    found_profile_endpoint = True
                    self.log_result("Profile Creation Endpoint", True, f"Found profile endpoint: {endpoint}", {
                        'status_code': response.status_code,
                        'response': response.text[:200]
                    })
                    break
            
            if not found_profile_endpoint:
                self.log_result("Missing Profile Creation", False, "No user profile creation endpoint found", {
                    'tested_endpoints': profile_endpoints_to_test,
                    'issue': 'Users are created in Supabase Auth but not in users table'
                })
            
            return not found_profile_endpoint  # Return True if we found the issue
            
        except Exception as e:
            self.log_result("Profile Creation Test", False, f"Request failed: {str(e)}")
            return False

    def test_missing_role_based_registration(self):
        """Test to identify missing role-based registration"""
        try:
            # Check if there are role-specific registration endpoints
            role_endpoints_to_test = [
                "/auth/signup/customer",
                "/auth/signup/barber",
                "/auth/register/customer", 
                "/auth/register/barber"
            ]
            
            found_role_endpoint = False
            
            for endpoint in role_endpoints_to_test:
                response = self.session.post(f"{BASE_URL}{endpoint}", json={
                    "email": f"role.test.{uuid.uuid4().hex[:4]}@gmail.com",
                    "password": "TestPassword123!",
                    "name": "Test User"
                })
                
                if response.status_code != 404:
                    found_role_endpoint = True
                    self.log_result("Role-based Registration", True, f"Found role-based endpoint: {endpoint}")
                    break
            
            if not found_role_endpoint:
                self.log_result("Missing Role-based Registration", False, "No role-specific registration endpoints found", {
                    'tested_endpoints': role_endpoints_to_test,
                    'issue': 'No distinction between customer and barber registration'
                })
            
            return not found_role_endpoint  # Return True if we found the issue
            
        except Exception as e:
            self.log_result("Role-based Registration Test", False, f"Request failed: {str(e)}")
            return False

    def test_database_table_access(self):
        """Test access to database tables without authentication"""
        try:
            # Test accessing shops (should work without auth)
            shops_response = self.session.get(f"{BASE_URL}/shops")
            
            if shops_response.status_code == 200:
                shops_data = shops_response.json()
                self.log_result("Database Access - Shops", True, "Can access shops table", {
                    'shop_count': len(shops_data.get('shops', [])),
                    'shops_empty': len(shops_data.get('shops', [])) == 0
                })
            else:
                self.log_result("Database Access - Shops", False, f"Cannot access shops: {shops_response.status_code}", shops_response.text)
            
            # Test accessing bookings without auth (should fail)
            bookings_response = self.session.get(f"{BASE_URL}/bookings")
            
            if bookings_response.status_code == 401:
                self.log_result("Database Access - Bookings Auth", True, "Bookings properly protected by authentication")
            else:
                self.log_result("Database Access - Bookings Auth", False, f"Bookings not properly protected: {bookings_response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Database Table Access", False, f"Request failed: {str(e)}")
            return False

    def test_api_structure_analysis(self):
        """Analyze the current API structure"""
        try:
            # Test various endpoints to understand the current structure
            endpoints_to_test = [
                ("GET", "/health", "Health check"),
                ("GET", "/shops", "Get shops"),
                ("GET", "/bookings", "Get bookings (protected)"),
                ("GET", "/auth/user", "Get current user (protected)"),
                ("POST", "/auth/signup", "User signup"),
                ("POST", "/auth/signin", "User signin"),
                ("POST", "/auth/signout", "User signout"),
            ]
            
            api_structure = {}
            
            for method, endpoint, description in endpoints_to_test:
                try:
                    if method == "GET":
                        response = self.session.get(f"{BASE_URL}{endpoint}")
                    elif method == "POST":
                        response = self.session.post(f"{BASE_URL}{endpoint}", json={})
                    
                    api_structure[endpoint] = {
                        'method': method,
                        'status': response.status_code,
                        'description': description,
                        'working': response.status_code not in [500, 502, 503]
                    }
                except:
                    api_structure[endpoint] = {
                        'method': method,
                        'status': 'error',
                        'description': description,
                        'working': False
                    }
            
            working_endpoints = sum(1 for ep in api_structure.values() if ep['working'])
            total_endpoints = len(api_structure)
            
            self.log_result("API Structure Analysis", True, f"Analyzed {total_endpoints} endpoints, {working_endpoints} working", api_structure)
            
            return True
            
        except Exception as e:
            self.log_result("API Structure Analysis", False, f"Analysis failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests and generate summary"""
        print("=" * 60)
        print("TrimTime Backend API Test Suite - Simplified")
        print("=" * 60)
        print()
        
        # Run tests
        tests = [
            self.test_health_check,
            self.test_user_registration_flow,
            self.test_missing_user_profile_creation,
            self.test_missing_role_based_registration,
            self.test_database_table_access,
            self.test_api_structure_analysis
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_result(test.__name__, False, f"Test execution failed: {str(e)}")
            
            time.sleep(0.5)  # Brief pause between tests
        
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
        
        print("CRITICAL ISSUES IDENTIFIED:")
        
        # Analyze results for critical issues
        critical_issues = []
        
        # Check for missing components
        missing_profile = any("Missing Profile Creation" in r['test'] and not r['success'] for r in self.test_results)
        missing_roles = any("Missing Role-based Registration" in r['test'] and not r['success'] for r in self.test_results)
        
        if missing_profile:
            critical_issues.append("❌ CRITICAL: User profile creation missing after Supabase auth signup")
            critical_issues.append("   - Users created in Supabase Auth but not in users table")
            critical_issues.append("   - This will cause RLS policy violations")
        
        if missing_roles:
            critical_issues.append("❌ CRITICAL: Role-based registration not implemented")
            critical_issues.append("   - No distinction between customer and barber registration")
            critical_issues.append("   - No barber shop creation for barber users")
        
        # Check email confirmation requirement
        email_confirmation = any("Email Confirmation Required" in r['test'] and r['success'] for r in self.test_results)
        if email_confirmation:
            critical_issues.append("⚠️  INFO: Email confirmation required by Supabase (expected behavior)")
        
        if not critical_issues:
            critical_issues.append("✅ No critical issues identified")
        
        for issue in critical_issues:
            print(issue)
        
        print()
        print("SPECIFIC RECOMMENDATIONS:")
        print("1. Create user profile creation endpoint (POST /api/users/profile)")
        print("2. Implement role-based registration endpoints:")
        print("   - POST /api/auth/register/customer")
        print("   - POST /api/auth/register/barber")
        print("3. Add automatic user profile creation after Supabase auth signup")
        print("4. Create barber_shops record for barber users during registration")
        print("5. Ensure RLS policies allow users to create their own records")
        print("6. Consider disabling email confirmation for development/testing")
        
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = TrimTimeAPITester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)