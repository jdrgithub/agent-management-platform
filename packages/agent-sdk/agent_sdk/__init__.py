"""Agent Management Platform — agent contract SDK."""

from agent_sdk.manifest import AgentManifest, load_manifest
from agent_sdk.package import AgentPackage, load_package, validate_package_dir
from agent_sdk.runtime import AgentContext, AgentResult, normalize_result

__all__ = [
    "AgentContext",
    "AgentManifest",
    "AgentPackage",
    "AgentResult",
    "load_manifest",
    "load_package",
    "normalize_result",
    "validate_package_dir",
]

__version__ = "0.1.0"
