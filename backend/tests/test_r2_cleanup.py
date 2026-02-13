import json
from unittest.mock import MagicMock, patch

from app.models.project import Project
from app.services.r2_cleanup import extract_r2_urls_from_project, delete_r2_objects


class TestExtractR2Urls:
    @patch("app.services.r2_cleanup.settings")
    def test_extracts_download_urls(self, mock_settings):
        mock_settings.r2_public_url = "https://files.iotivate.dev"
        project = Project(
            slug="test", name="Test", description="Test", tags="",
            downloads_json=json.dumps([
                {"name": "file.stl", "url": "https://files.iotivate.dev/projects/file.stl", "type": "stl"},
                {"name": "other.pdf", "url": "https://example.com/other.pdf", "type": "pdf"},
            ]),
        )
        urls = extract_r2_urls_from_project(project)
        assert urls == ["https://files.iotivate.dev/projects/file.stl"]

    @patch("app.services.r2_cleanup.settings")
    def test_extracts_circuit_url(self, mock_settings):
        mock_settings.r2_public_url = "https://files.iotivate.dev"
        project = Project(
            slug="test", name="Test", description="Test", tags="",
            circuit_json=json.dumps({
                "src": "https://files.iotivate.dev/projects/circuit.png",
                "downloadUrl": "https://files.iotivate.dev/projects/circuit.pdf",
            }),
        )
        urls = extract_r2_urls_from_project(project)
        assert len(urls) == 2

    @patch("app.services.r2_cleanup.settings")
    def test_extracts_firmware_url(self, mock_settings):
        mock_settings.r2_public_url = "https://files.iotivate.dev"
        project = Project(
            slug="test", name="Test", description="Test", tags="",
            firmware_json=json.dumps({
                "name": "fw", "version": "1.0", "price": 0,
                "firmwareUrl": "https://files.iotivate.dev/firmware/fw.bin",
            }),
        )
        urls = extract_r2_urls_from_project(project)
        assert urls == ["https://files.iotivate.dev/firmware/fw.bin"]

    @patch("app.services.r2_cleanup.settings")
    def test_no_r2_url_configured(self, mock_settings):
        mock_settings.r2_public_url = ""
        project = Project(
            slug="test", name="Test", description="Test", tags="",
            downloads_json=json.dumps([{"name": "f", "url": "https://x.com/f", "type": "stl"}]),
        )
        urls = extract_r2_urls_from_project(project)
        assert urls == []

    @patch("app.services.r2_cleanup.settings")
    def test_handles_corrupt_json(self, mock_settings):
        mock_settings.r2_public_url = "https://files.iotivate.dev"
        project = Project(
            slug="test", name="Test", description="Test", tags="",
            downloads_json="not valid json",
        )
        urls = extract_r2_urls_from_project(project)
        assert urls == []

    @patch("app.services.r2_cleanup.settings")
    def test_handles_no_json_fields(self, mock_settings):
        mock_settings.r2_public_url = "https://files.iotivate.dev"
        project = Project(
            slug="test", name="Test", description="Test", tags="",
        )
        urls = extract_r2_urls_from_project(project)
        assert urls == []


class TestDeleteR2Objects:
    @patch("app.services.r2_cleanup.settings")
    def test_deletes_objects(self, mock_settings):
        mock_settings.r2_bucket_name = "test-bucket"
        mock_client = MagicMock()

        urls = [
            "https://files.iotivate.dev/projects/file1.stl",
            "https://files.iotivate.dev/projects/file2.pdf",
        ]
        deleted = delete_r2_objects(urls, r2_client=mock_client)

        assert deleted == 2
        assert mock_client.delete_object.call_count == 2
        mock_client.delete_object.assert_any_call(Bucket="test-bucket", Key="projects/file1.stl")
        mock_client.delete_object.assert_any_call(Bucket="test-bucket", Key="projects/file2.pdf")

    def test_returns_zero_for_empty_urls(self):
        assert delete_r2_objects([]) == 0

    @patch("app.services.r2_cleanup.settings")
    def test_handles_delete_failure(self, mock_settings):
        mock_settings.r2_bucket_name = "test-bucket"
        mock_client = MagicMock()
        mock_client.delete_object.side_effect = [None, Exception("S3 error")]

        urls = [
            "https://files.iotivate.dev/a.bin",
            "https://files.iotivate.dev/b.bin",
        ]
        deleted = delete_r2_objects(urls, r2_client=mock_client)
        assert deleted == 1

    @patch("app.services.r2_cleanup.settings")
    def test_no_r2_client(self, mock_settings):
        mock_settings.r2_bucket_name = "test-bucket"
        with patch("app.services.r2_cleanup.delete_r2_objects.__module__"):
            pass
        # When r2_client is None and get_r2_client returns None
        with patch("app.api.upload.get_r2_client", return_value=None):
            deleted = delete_r2_objects(["https://files.iotivate.dev/a.bin"])
            assert deleted == 0
