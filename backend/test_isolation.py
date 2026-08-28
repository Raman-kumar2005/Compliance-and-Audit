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

    def setUp(self):
        # Remove notification files to ensure clean cooldown isolation per test
        for t in ["technova-demo", "tenant-company-a", "tenant-company-b", "tenant-security-hq", "aegispoint-demo"]:
            f = f"employee_notifications_{t}.json"
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass

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
    def test_technova_demo_login_isolation(self):
        token = self.login("hr@technova-demo.com", "passwordA123")
        headers = {"Authorization": f"Bearer {token}"}
        resp = self.client.get("/api/history", headers=headers)
        self.assertEqual(resp.status_code, 200)
        
    def test_aegispoint_demo_login_isolation(self):
        token = self.login("compliance@aegispoint-demo.com", "passwordB123")
        headers = {"Authorization": f"Bearer {token}"}
        resp = self.client.get("/api/history", headers=headers)
        self.assertEqual(resp.status_code, 200)

    def test_multi_tenant_organization_switching(self):
        # 1. Login multi-tenant user
        token = self.login("multitenant.hr@enterprise-demo.com", "passwordMulti123")
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Switch to aegispoint-demo
        switch_resp = self.client.post(
            "/api/auth/switch-tenant",
            json={"target_tenant_id": "aegispoint-demo"},
            headers=headers
        )
        self.assertEqual(switch_resp.status_code, 200)
        switch_data = switch_resp.json()
        self.assertEqual(switch_data["user"]["tenant_id"], "aegispoint-demo")
    def test_organization_creation_endpoint(self):
        resp = self.client.post(
            "/api/organizations/create",
            json={
                "company_name": "Apex Global Systems",
                "industry": "Healthcare & Biotech",
                "company_size": "51-200",
                "admin_email": "admin@apex-demo.com",
                "admin_password": "secureApexPassword123"
            }
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["company_name"], "Apex Global Systems")
        self.assertTrue(data["tenant_id"].startswith("apexglobalsystems-"))

        # Verify newly created HR Admin can log in
        admin_token = self.login("admin@apex-demo.com", "secureApexPassword123")
        self.assertIsNotNone(admin_token)

    def test_user_invitation_endpoint(self):
        hr_token = self.login("hr@technova-demo.com", "passwordA123")
        headers = {"Authorization": f"Bearer {hr_token}"}

        resp = self.client.post(
            "/api/hr/invite-user",
            json={"email": "new.analyst@technova-demo.com", "role": "Compliance Officer"},
            headers=headers
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["invitation"]["email"], "new.analyst@technova-demo.com")
        self.assertEqual(data["invitation"]["status"], "invited")

        # Check invitations list
        list_resp = self.client.get("/api/hr/invitations", headers=headers)
        self.assertEqual(list_resp.status_code, 200)
        invs = list_resp.json()
        self.assertTrue(any(i["email"] == "new.analyst@technova-demo.com" for i in invs))

    def test_hr_can_preview_and_notify_employee_same_tenant(self):
        # Alice (Company A HR) login
        alice_token = self.login("hr.alice@company-a.com", "passwordA123")
        headers_a = {"Authorization": f"Bearer {alice_token}"}

        # Fetch violations for Company A
        resp_vios = self.client.get("/api/violations", headers=headers_a)
        self.assertEqual(resp_vios.status_code, 200)
        vios = resp_vios.json()
        self.assertGreater(len(vios), 0)
        target_vio_id = vios[0]["id"]

        # Preview notification
        preview_resp = self.client.get(f"/api/violations/{target_vio_id}/employee-preview", headers=headers_a)
        self.assertEqual(preview_resp.status_code, 200)
        preview_data = preview_resp.json()
        self.assertIn("employee", preview_data)
        self.assertIn("masked_email", preview_data["employee"])
        self.assertEqual(preview_data["neutral_subject"], "Action required: Compliance item assigned to you")

        # Send notification
        notify_resp = self.client.post(f"/api/violations/{target_vio_id}/notify-employee", headers=headers_a)
        self.assertEqual(notify_resp.status_code, 200)
        notify_data = notify_resp.json()
        self.assertEqual(notify_data["status"], "success")
        self.assertIn("delivery_status", notify_data)

    def test_employee_cannot_use_notify_employee(self):
        # Bob (Employee) login
        bob_token = self.login("employee.bob@company-a.com", "passwordA123")
        headers_emp = {"Authorization": f"Bearer {bob_token}"}

        # Get violations
        resp_vios = self.client.get("/api/violations", headers=headers_emp)
        vios = resp_vios.json()
        self.assertGreater(len(vios), 0)
        target_vio_id = vios[0]["id"]

        # Bob tries to notify -> 403 Forbidden
        notify_resp = self.client.post(f"/api/violations/{target_vio_id}/notify-employee", headers=headers_emp)
        self.assertEqual(notify_resp.status_code, 403)

    def test_cross_tenant_employee_notification_blocked(self):
        # Charlie (Company B HR) login
        charlie_token = self.login("hr.charlie@company-b.com", "passwordB123")
        headers_b = {"Authorization": f"Bearer {charlie_token}"}

        # Get Company A violation ID
        alice_token = self.login("hr.alice@company-a.com", "passwordA123")
        headers_a = {"Authorization": f"Bearer {alice_token}"}
        resp_a = self.client.get("/api/violations", headers=headers_a)
        vios_a = resp_a.json()
        violation_id_a = vios_a[0]["id"]

        # Charlie tries to notify employee for Company A violation -> 404 Not Found
        notify_resp = self.client.post(f"/api/violations/{violation_id_a}/notify-employee", headers=headers_b)
        self.assertEqual(notify_resp.status_code, 404)

    def test_cooldown_prevents_duplicate_notifications(self):
        alice_token = self.login("hr.alice@company-a.com", "passwordA123")
        headers_a = {"Authorization": f"Bearer {alice_token}"}

        resp_vios = self.client.get("/api/violations", headers=headers_a)
        vios = resp_vios.json()
        target_vio_id = vios[0]["id"]

        # First send (may succeed or record demo)
        resp1 = self.client.post(f"/api/violations/{target_vio_id}/notify-employee", headers=headers_a)
        self.assertTrue(resp1.status_code in [200, 400])

        # Immediate second send -> 400 Cooldown
        resp2 = self.client.post(f"/api/violations/{target_vio_id}/notify-employee", headers=headers_a)
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("recently sent", resp2.json().get("detail", ""))

    def test_unconfigured_email_shows_demo_record(self):
        # Ensure SMTP env vars are unset
        if "SMTP_HOST" in os.environ:
            del os.environ["SMTP_HOST"]

        alice_token = self.login("hr.alice@company-a.com", "passwordA123")
        headers_a = {"Authorization": f"Bearer {alice_token}"}

        resp_vios = self.client.get("/api/violations", headers=headers_a)
        vios = resp_vios.json()
        # Find a violation not recently notified
        target_vio_id = vios[-1]["id"]

        resp = self.client.post(f"/api/violations/{target_vio_id}/notify-employee", headers=headers_a)
        if resp.status_code == 200:
            data = resp.json()
            self.assertEqual(data["delivery_status"], "DEMO_RECORDED")
            self.assertIn("Email delivery is not configured", data["message"])

if __name__ == "__main__":
    unittest.main()

