import unittest
from fastapi.testclient import TestClient
from main import app, USERS_DB, seed_data_if_empty, seed_policies_if_empty
import os
import json

class TestMultiTenantIsolation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Initialize the TestClient
        cls.client = TestClient(app)
        # Seed test data for Company A, Company B, and Security HQ
        for tenant_id in ["technova-demo", "aegispoint-demo", "tenant-security-hq"]:
            seed_data_if_empty(tenant_id)
            seed_policies_if_empty(tenant_id)

    def login(self, email, password):
        resp = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(resp.status_code, 200, f"Login failed for {email}")
        data = resp.json()
        return data["access_token"]

    def test_unauthorized_access_rejected(self):
        # Accessing endpoints without header should reject with 401
        endpoints = [
            ("/api/history", "GET"),
            ("/api/audits", "GET"),
            ("/api/violations", "GET"),
            ("/api/policies/assigned-to-me", "GET"),
            ("/api/notifications", "GET"),
            ("/api/hr/sla-settings", "GET"),
        ]
        for url, method in endpoints:
            if method == "GET":
                resp = self.client.get(url)
            else:
                resp = self.client.post(url)
            self.assertEqual(resp.status_code, 401, f"URL {url} did not reject unauthenticated request with 401.")

    def test_malformed_token_rejected(self):
        headers = {"Authorization": "Bearer not-a-valid-token-at-all"}
        resp = self.client.get("/api/history", headers=headers)
        self.assertEqual(resp.status_code, 401)

    def test_tenant_data_isolation_history(self):
        # Alice (Company A HR Auditor) login
        alice_token = self.login("hr.alice@company-a.com", "passwordA123")
        headers_a = {"Authorization": f"Bearer {alice_token}"}
        
        # Charlie (Company B HR Auditor) login
        charlie_token = self.login("hr.charlie@company-b.com", "passwordB123")
        headers_b = {"Authorization": f"Bearer {charlie_token}"}

        # Fetch histories
        resp_a = self.client.get("/api/history", headers=headers_a)
        self.assertEqual(resp_a.status_code, 200)
        history_a = resp_a.json()

        resp_b = self.client.get("/api/history", headers=headers_b)
        self.assertEqual(resp_b.status_code, 200)
        history_b = resp_b.json()

        # Both tenants have their respective separate data
        self.assertIsNotNone(history_a)
        self.assertIsNotNone(history_b)
        
        # Let's verify that a created audit in A is only visible in A
        # (Since they are separate files, audit IDs won't leak)
        ids_a = {item["id"] for item in history_a}
        ids_b = {item["id"] for item in history_b}
        intersection = ids_a.intersection(ids_b)
        self.assertEqual(len(intersection), 0, "Tenant A and Tenant B share audit histories, isolation violated!")

    def test_cross_tenant_audit_access_blocked(self):
        alice_token = self.login("hr.alice@company-a.com", "passwordA123")
        headers_a = {"Authorization": f"Bearer {alice_token}"}

        charlie_token = self.login("hr.charlie@company-b.com", "passwordB123")
        headers_b = {"Authorization": f"Bearer {charlie_token}"}

        # Get Alice's audits
        resp_a = self.client.get("/api/history", headers=headers_a)
        history_a = resp_a.json()
        self.assertGreater(len(history_a), 0)
        audit_id_a = history_a[0]["id"]

        # Charlie tries to view Alice's audit -> should return 404
        resp_blocked = self.client.get(f"/api/audits/{audit_id_a}", headers=headers_b)
        self.assertEqual(resp_blocked.status_code, 404, "Cross-tenant audit leakage: Charlie accessed Alice's audit record!")

    def test_employee_role_isolation(self):
        # Alice (Company A HR) has full access to violations
        alice_token = self.login("hr.alice@company-a.com", "passwordA123")
        headers_hr = {"Authorization": f"Bearer {alice_token}"}
        resp_hr = self.client.get("/api/violations", headers=headers_hr)
        self.assertEqual(resp_hr.status_code, 200)

        # Bob (Company A Employee) can only see violations assigned to him
        bob_token = self.login("employee.bob@company-a.com", "passwordA123")
        headers_emp = {"Authorization": f"Bearer {bob_token}"}
        resp_emp = self.client.get("/api/violations", headers=headers_emp)
        self.assertEqual(resp_emp.status_code, 200)
        
        # Check that Bob's returned violations are only assigned to Bob (EMP-TN-1042)
        vios = resp_emp.json()
        for v in vios:
            self.assertEqual(v["assigned_employee_id"], "EMP-TN-1042", "Employee Bob accessed a violation assigned to another user.")

    def test_cross_tenant_violation_remediation_blocked(self):
        # Charlie (Company B HR) login
        charlie_token = self.login("hr.charlie@company-b.com", "passwordB123")
        headers_b = {"Authorization": f"Bearer {charlie_token}"}

        # Get Company A Alice's violations
        alice_token = self.login("hr.alice@company-a.com", "passwordA123")
        headers_a = {"Authorization": f"Bearer {alice_token}"}
        resp_a = self.client.get("/api/violations", headers=headers_a)
        vios_a = resp_a.json()
        self.assertGreater(len(vios_a), 0)
        violation_id_a = vios_a[0]["id"]

        # Charlie tries to review/approve Alice's violation -> should return 404
        resp_action = self.client.post(
            f"/api/violations/{violation_id_a}/review",
            json={"action": "APPROVE"},
            headers=headers_b
        )
        self.assertEqual(resp_action.status_code, 404, "Cross-tenant violation remediation was processed instead of blocked!")

    def test_non_hr_roles_blocked_from_auditing(self):
        bob_token = self.login("employee.bob@company-a.com", "passwordA123")
        headers = {"Authorization": f"Bearer {bob_token}"}
        
        # Employee bob tries to initiate audit -> should reject with 403
        resp = self.client.post(
            "/api/audit",
            data={"hr_email": "employee.bob@company-a.com"},
            files=[
                ("policy_files", ("policy.pdf", b"some policy text", "application/pdf")),
                ("log_files", ("logs.csv", b"some log entries", "text/csv"))
            ],
            headers=headers
        )
        self.assertEqual(resp.status_code, 403, "Non-HR employee bob was allowed to run audit scan!")

if __name__ == "__main__":
    unittest.main()
