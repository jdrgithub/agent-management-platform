from __future__ import annotations

import shutil
import tarfile
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

from agent_sdk.manifest import AgentManifest, load_manifest

MANIFEST_NAMES = ("agent.yaml", "agent.yml")


@dataclass
class AgentPackage:
    root: Path
    manifest: AgentManifest

    @property
    def id(self) -> str:
        return self.manifest.id

    @property
    def version(self) -> str:
        return self.manifest.version


def find_manifest(root: Path) -> Path:
    for name in MANIFEST_NAMES:
        candidate = root / name
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"No agent.yaml found under {root}")


def validate_package_dir(root: Path | str) -> AgentPackage:
    root_path = Path(root).resolve()
    if not root_path.is_dir():
        raise NotADirectoryError(root_path)
    manifest_path = find_manifest(root_path)
    manifest = load_manifest(manifest_path)
    return AgentPackage(root=root_path, manifest=manifest)


def load_package(source: Path | str) -> AgentPackage:
    """Load a package from a directory, .tar.gz, .tgz, or .zip."""
    path = Path(source).resolve()
    if path.is_dir():
        return validate_package_dir(path)

    if not path.is_file():
        raise FileNotFoundError(path)

    extract_dir = Path(tempfile.mkdtemp(prefix="amp-agent-"))
    try:
        if path.suffix == ".zip" or path.name.endswith(".zip"):
            with zipfile.ZipFile(path) as zf:
                zf.extractall(extract_dir)
        elif path.suffixes[-2:] == [".tar", ".gz"] or path.suffix in {".tgz", ".tar"}:
            with tarfile.open(path, "r:*") as tf:
                tf.extractall(extract_dir)
        else:
            raise ValueError(f"Unsupported package archive: {path.name}")

        # Allow archives that wrap a single top-level directory.
        children = [p for p in extract_dir.iterdir() if not p.name.startswith(".")]
        root = children[0] if len(children) == 1 and children[0].is_dir() else extract_dir
        return validate_package_dir(root)
    except Exception:
        shutil.rmtree(extract_dir, ignore_errors=True)
        raise


def materialize_package(source: Path | str, destination: Path | str) -> AgentPackage:
    """Validate and copy a package into destination (overwrites)."""
    pkg = load_package(source)
    dest = Path(destination).resolve()
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(pkg.root, dest)
    return validate_package_dir(dest)
