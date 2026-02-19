"""Seed the database with initial data. Run with: python -m app.seed"""

from sqlmodel import Session

from app.database import engine, create_db_and_tables
from app.models.tool import Tool
from app.models.project import Project


def seed():
    create_db_and_tables()
    with Session(engine) as session:
        tools = [
            Tool(
                slug="esp32-web-flasher",
                name="ESP32 Web Flasher",
                description="Flash ESP32 firmware directly from your browser using Web Serial API.",
                status="coming_soon",
            ),
            Tool(
                slug="wirelessear-installer",
                name="WirelessEar Installer",
                description="One-click installer for the WirelessEar project firmware.",
                status="coming_soon",
            ),
            Tool(
                slug="stl-viewer",
                name="STL Viewer",
                description="Preview 3D-printable STL files in your browser. Rotate, zoom, measure dimensions, and inspect models before printing.",
                status="active",
            ),
        ]
        projects = [
            Project(
                slug="wirelessear",
                name="WirelessEar",
                description="A wireless audio monitoring system built with ESP32.",
                tags="ESP32,Audio,Wi-Fi",
            ),
        ]
        for tool in tools:
            session.merge(tool)
        for project in projects:
            session.merge(project)
        session.commit()
    print("Database seeded.")


if __name__ == "__main__":
    seed()
