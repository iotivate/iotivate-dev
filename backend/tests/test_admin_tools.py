class TestAdminToolsAuth:
    def test_regular_user_gets_403(self, client, auth_headers):
        response = client.get("/api/admin/tools", headers=auth_headers)
        assert response.status_code == 403

    def test_unauthenticated_gets_401(self, client):
        response = client.get("/api/admin/tools")
        assert response.status_code == 401


class TestAdminToolsCRUD:
    def test_list_tools(self, client, admin_headers, sample_tool):
        response = client.get("/api/admin/tools", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 1

    def test_list_tools_pagination(self, client, admin_headers, session):
        from app.models.tool import Tool

        for i in range(3):
            session.add(Tool(slug=f"tool-{i}", name=f"Tool {i}", description="Desc", status="active"))
        session.commit()

        response = client.get("/api/admin/tools?skip=1&limit=2", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3

    def test_create_tool(self, client, admin_headers):
        response = client.post("/api/admin/tools", headers=admin_headers, json={
            "slug": "new-tool",
            "name": "New Tool",
            "description": "A brand new tool.",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["slug"] == "new-tool"
        assert data["status"] == "coming_soon"

    def test_create_tool_duplicate_slug(self, client, admin_headers, sample_tool):
        response = client.post("/api/admin/tools", headers=admin_headers, json={
            "slug": "serial-monitor",
            "name": "Duplicate",
            "description": "Duplicate slug.",
        })
        assert response.status_code == 409

    def test_update_tool(self, client, admin_headers, sample_tool):
        response = client.put(
            f"/api/admin/tools/{sample_tool.id}",
            headers=admin_headers,
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_tool_not_found(self, client, admin_headers):
        response = client.put(
            "/api/admin/tools/9999",
            headers=admin_headers,
            json={"name": "Nope"},
        )
        assert response.status_code == 404

    def test_delete_tool(self, client, admin_headers, sample_tool):
        response = client.delete(
            f"/api/admin/tools/{sample_tool.id}",
            headers=admin_headers,
        )
        assert response.status_code == 204

        # Verify it's gone
        response = client.get("/api/admin/tools", headers=admin_headers)
        assert response.json()["total"] == 0

    def test_delete_tool_not_found(self, client, admin_headers):
        response = client.delete("/api/admin/tools/9999", headers=admin_headers)
        assert response.status_code == 404
