class TestAdminProjectsAuth:
    def test_regular_user_gets_403(self, client, auth_headers):
        response = client.get("/api/admin/projects", headers=auth_headers)
        assert response.status_code == 403

    def test_unauthenticated_gets_401(self, client):
        response = client.get("/api/admin/projects")
        assert response.status_code == 401


class TestAdminProjectsCRUD:
    def test_list_includes_unpublished(self, client, admin_headers, sample_project, unpublished_project):
        response = client.get("/api/admin/projects", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        slugs = [p["slug"] for p in data["items"]]
        assert "smart-relay" in slugs
        assert "secret-project" in slugs
        assert data["total"] == 2

    def test_list_projects_pagination(self, client, admin_headers, session):
        from app.models.project import Project

        for i in range(5):
            session.add(Project(
                slug=f"proj-{i}", name=f"Proj {i}",
                description="Desc", tags="t", is_published=True,
            ))
        session.commit()

        response = client.get("/api/admin/projects?skip=2&limit=2", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5

    def test_create_project(self, client, admin_headers):
        response = client.post("/api/admin/projects", headers=admin_headers, json={
            "slug": "new-project",
            "name": "New Project",
            "description": "A test project.",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["slug"] == "new-project"
        assert data["is_published"] is False

    def test_create_project_duplicate_slug(self, client, admin_headers, sample_project):
        response = client.post("/api/admin/projects", headers=admin_headers, json={
            "slug": "smart-relay",
            "name": "Duplicate",
            "description": "Duplicate slug.",
        })
        assert response.status_code == 409

    def test_update_project(self, client, admin_headers, sample_project):
        response = client.put(
            f"/api/admin/projects/{sample_project.id}",
            headers=admin_headers,
            json={"name": "Updated Relay"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Relay"

    def test_update_project_not_found(self, client, admin_headers):
        response = client.put(
            "/api/admin/projects/9999",
            headers=admin_headers,
            json={"name": "Nope"},
        )
        assert response.status_code == 404

    def test_delete_project(self, client, admin_headers, sample_project):
        response = client.delete(
            f"/api/admin/projects/{sample_project.id}",
            headers=admin_headers,
        )
        assert response.status_code == 204

    def test_delete_project_not_found(self, client, admin_headers):
        response = client.delete("/api/admin/projects/9999", headers=admin_headers)
        assert response.status_code == 404

    def test_get_single_project(self, client, admin_headers, sample_project):
        response = client.get(
            f"/api/admin/projects/{sample_project.id}",
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["slug"] == "smart-relay"
