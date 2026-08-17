import pytest

from app.services.artifacts import ArtifactStore


def test_artifact_store_writes_hashes_and_blocks_paths(tmp_path):
    store = ArtifactStore(tmp_path)
    campaign_id = "12345678-1234-1234-1234-123456789abc"
    store.write_text(campaign_id, "research.md", "hello")
    listed = store.list(campaign_id)
    assert listed[0]["name"] == "research.md"
    assert listed[0]["bytes"] == 6
    assert len(listed[0]["sha256"]) == 64
    with pytest.raises(ValueError):
        store.write_text(campaign_id, "../../secret.txt", "no")
    with pytest.raises(ValueError):
        store.campaign_dir("../../escape")
