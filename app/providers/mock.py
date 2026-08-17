from __future__ import annotations

import re


class MockProvider:
    name = "mock"
    model = "deterministic-local-demo"

    def generate(self, *, system: str, prompt: str) -> str:
        artifact = re.search(r"ARTIFACT:\s*([^\n]+)", prompt)
        artifact_name = artifact.group(1).strip() if artifact else "campaign artifact"
        goal = re.search(r"GOAL:\s*([^\n]+)", prompt)
        goal_text = goal.group(1).strip() if goal else "the campaign goal"
        if artifact_name.endswith(".csv"):
            return (
                "day,channel,asset,objective,status\n"
                f"1,LinkedIn,Founder insight post,{goal_text},draft\n"
                f"3,Email,Problem-aware email,{goal_text},draft\n"
                f"5,Blog,Search-led article,{goal_text},draft"
            )
        return (
            f"# {artifact_name.removesuffix('.md').replace('-', ' ').title()}\n\n"
            f"This offline demo draft supports **{goal_text}**.\n\n"
            "## Recommended direction\n\n"
            "- Lead with one specific customer problem.\n"
            "- Connect the offer to a measurable business outcome.\n"
            "- Keep every external publication behind human approval.\n\n"
            "## Draft\n\n"
            "Use the supplied company research, audience and offer to replace this demo copy "
            "when an OpenAI-compatible provider is configured."
        )
