def test_list_tools_empty(client):
    response = client.get("/api/tools/")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["skip"] == 0
    assert data["limit"] == 20


def test_list_tools_returns_tools(client, sample_tool):
    response = client.get("/api/tools/")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["slug"] == "serial-monitor"
    assert data["total"] == 1


def test_list_tools_pagination(client, session):
    from app.models.tool import Tool

    for i in range(5):
        session.add(Tool(slug=f"tool-{i}", name=f"Tool {i}", description="Desc", status="active"))
    session.commit()

    response = client.get("/api/tools/?skip=2&limit=2")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["skip"] == 2
    assert data["limit"] == 2


def test_list_tools_skip_beyond_total(client, sample_tool):
    response = client.get("/api/tools/?skip=100")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 1


def test_get_tool_by_slug(client, sample_tool):
    response = client.get("/api/tools/serial-monitor")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Serial Monitor"
    assert data["status"] == "active"


def test_get_tool_not_found(client):
    response = client.get("/api/tools/nonexistent")
    assert response.status_code == 404
