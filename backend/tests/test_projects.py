def test_list_projects_returns_published_only(client, sample_project, unpublished_project):
    response = client.get("/api/projects/")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["slug"] == "smart-relay"
    assert data["total"] == 1


def test_list_projects_empty(client):
    response = client.get("/api/projects/")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_list_projects_pagination(client, session):
    from app.models.project import Project

    for i in range(5):
        session.add(Project(
            slug=f"project-{i}", name=f"Project {i}",
            description="Desc", tags="test", is_published=True,
        ))
    session.commit()

    response = client.get("/api/projects/?skip=1&limit=2")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["skip"] == 1
    assert data["limit"] == 2


def test_list_projects_skip_beyond_total(client, sample_project):
    response = client.get("/api/projects/?skip=100")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 1


def test_get_project_by_slug(client, sample_project):
    response = client.get("/api/projects/smart-relay")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Smart Relay"
    assert data["is_published"] is True


def test_get_project_not_found(client):
    response = client.get("/api/projects/nonexistent")
    assert response.status_code == 404


def test_get_unpublished_project_returns_404(client, unpublished_project):
    response = client.get("/api/projects/secret-project")
    assert response.status_code == 404
