#!/usr/bin/env python3
"""
PPT Generator - Generate PPT slide images using Google Gemini API.

Adapted for AgentHub server integration. The agent (Claude Code) calls this
script to generate slide images from a slides_plan.json.

Paths are resolved relative to this script's directory, so the agent can
use shorthand names like `--style gradient-glass`.
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# =============================================================================
# Constants
# =============================================================================

SCRIPTS_DIR = Path(__file__).parent.resolve()
STYLES_DIR = SCRIPTS_DIR / "styles"
TEMPLATES_DIR = SCRIPTS_DIR / "templates"

DEFAULT_RESOLUTION = "2K"
DEFAULT_TEMPLATE = TEMPLATES_DIR / "viewer.html"
OUTPUT_BASE_DIR = "ppt_output"


# =============================================================================
# Environment Configuration
# =============================================================================

def find_and_load_env() -> bool:
    """
    Find and load .env file from multiple locations.

    Search priority:
    1. AgentHub/ppt/.env (script directory)
    2. AgentHub/.env (server root)
    3. Parent directories up to project root
    4. System environment variables

    Returns:
        True if .env file was found and loaded, False otherwise.
    """
    env_locations = [
        SCRIPTS_DIR / ".env",
        SCRIPTS_DIR.parent / ".env",                         # AgentHub/.env
        SCRIPTS_DIR.parent.parent / ".env",                  # Project root/.env
        Path.home() / ".claude" / "skills" / "ppt-generator" / ".env",
    ]

    # Also walk up from CWD (workspace) looking for .env
    cwd = Path.cwd()
    for parent in [cwd] + list(cwd.parents):
        env_path = parent / ".env"
        if env_path.exists() and env_path not in env_locations:
            env_locations.append(env_path)
        if (parent / ".git").exists():
            break

    for env_path in env_locations:
        if env_path.exists():
            load_dotenv(env_path, override=True)
            print(f"Loaded environment from: {env_path}")
            return True

    # Fallback: system environment
    load_dotenv(override=True)
    print("Warning: No .env file found, using system environment variables")
    return False


# =============================================================================
# Style Template
# =============================================================================

def resolve_style_path(style_arg: str) -> Path:
    """
    Resolve a style argument to an actual file path.

    Supports:
    - Full paths: /absolute/path/to/style.md
    - Relative paths: ./my-style.md
    - Shorthand names: gradient-glass → styles/gradient-glass.md
    """
    style_path = Path(style_arg)
    if style_path.exists():
        return style_path

    # Try with .md extension
    with_ext = style_path.with_suffix(".md")
    if with_ext.exists():
        return with_ext

    # Try in STYLES_DIR
    in_styles = STYLES_DIR / style_path.name
    if in_styles.exists():
        return in_styles

    # Try STYLES_DIR with .md extension
    in_styles_md = STYLES_DIR / f"{style_path.name}.md"
    if in_styles_md.exists():
        return in_styles_md

    # List available styles for the error message
    available = []
    if STYLES_DIR.exists():
        available = [f.stem for f in STYLES_DIR.glob("*.md")]
    print(f"Error: Style not found: {style_arg}")
    if available:
        print(f"Available styles: {', '.join(available)}")
    sys.exit(1)


def load_style_template(style_path: Path) -> str:
    """
    Load and parse style template file.

    Args:
        style_path: Path to the style template markdown file.

    Returns:
        Extracted base prompt template string.
    """
    content = style_path.read_text(encoding="utf-8")

    # Extract base prompt template section between ## markers
    start_marker = "## "
    end_marker = "## "

    start_idx = content.find(start_marker)
    # Find second ## marker after the first one
    end_idx = content.find(end_marker, start_idx + len(start_marker))

    if start_idx == -1 or end_idx == -1:
        print("Warning: Could not parse style template markers, using full content")
        return content

    # Skip past the first ## heading and its content until the next ## heading
    extracted = content[start_idx + len(start_marker):end_idx].strip()
    if not extracted:
        print("Warning: Empty extracted style template, using full content")
        return content

    return extracted


# =============================================================================
# Prompt Generation
# =============================================================================

def generate_prompt(
    style_template: str,
    page_type: str,
    content_text: str,
    slide_number: int,
    total_slides: int,
) -> str:
    """
    Generate a prompt for a single slide.
    """
    prompt_parts = [style_template, "\n\n"]

    is_cover = page_type == "cover" or slide_number == 1
    is_data = page_type == "data" or slide_number == total_slides

    if is_cover:
        prompt_parts.append(
            f"""Please generate a cover page based on visual balance aesthetics.
Place a large complex 3D glass object in the center, overlaid with bold text:

{content_text}

Background with extended aurora waves."""
        )
    elif is_data:
        prompt_parts.append(
            f"""Please generate a data/summary page using split-screen design.
Left side: typeset the following text.
Right side: floating large glowing 3D data visualization:

{content_text}"""
        )
    else:
        prompt_parts.append(
            f"""Please generate a content page using Bento grid layout.
Organize the following content in modular rounded rectangle containers.
Container material must be frosted glass with blur effect:

{content_text}"""
        )

    return "".join(prompt_parts)


# =============================================================================
# Image Generation
# =============================================================================

def get_gemini_client():
    """Initialize and return Gemini API client."""
    try:
        from google import genai
    except ImportError:
        print("Error: google-genai library not installed", file=sys.stderr)
        print("Please run: pip install google-genai", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not set", file=sys.stderr)
        print("Please set GEMINI_API_KEY in your .env file or environment", file=sys.stderr)
        print("Example: GEMINI_API_KEY=your-key-here", file=sys.stderr)
        sys.exit(1)

    return genai.Client(api_key=api_key)


def generate_slide(
    prompt: str,
    slide_number: int,
    output_dir: str,
    resolution: str = DEFAULT_RESOLUTION,
) -> Optional[str]:
    """
    Generate a single PPT slide image using Gemini API.

    Returns:
        Path to saved image, or None if generation failed.
    """
    from google.genai import types

    print(f"Generating slide {slide_number}...", flush=True)

    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio="16:9",
                    image_size=resolution,
                ),
            ),
        )

        for part in response.parts:
            if part.inline_data is not None:
                image = part.as_image()
                image_dir = os.path.join(output_dir, "images")
                os.makedirs(image_dir, exist_ok=True)
                image_path = os.path.join(
                    image_dir, f"slide-{slide_number:02d}.png"
                )
                image.save(image_path)
                print(f"  Slide {slide_number} saved: {image_path}", flush=True)
                return image_path

        print(f"  Slide {slide_number} failed: No image data in response", flush=True)
        return None

    except Exception as e:
        print(f"  Slide {slide_number} failed: {e}", flush=True)
        return None


# =============================================================================
# Output Generation
# =============================================================================

def generate_viewer_html(
    output_dir: str,
    slide_count: int,
    template_path: Path,
) -> str:
    """Generate HTML viewer for slides playback."""
    html_template = template_path.read_text(encoding="utf-8")

    # Generate image list
    slides_list = [f"'images/slide-{i:02d}.png'" for i in range(1, slide_count + 1)]

    # Replace placeholder
    html_content = html_template.replace(
        "/* IMAGE_LIST_PLACEHOLDER */",
        ",\n            ".join(slides_list),
    )

    html_path = os.path.join(output_dir, "index.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"  Viewer HTML generated: {html_path}", flush=True)
    return html_path


def save_prompts(output_dir: str, prompts_data: Dict[str, Any]) -> str:
    """Save all prompts to JSON file."""
    prompts_path = os.path.join(output_dir, "prompts.json")
    with open(prompts_path, "w", encoding="utf-8") as f:
        json.dump(prompts_data, f, ensure_ascii=False, indent=2)
    print(f"  Prompts saved: {prompts_path}", flush=True)
    return prompts_path


# =============================================================================
# Main Entry Point
# =============================================================================

def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure argument parser."""
    parser = argparse.ArgumentParser(
        description="PPT Generator - Generate PPT images using Gemini API (AgentHub Edition)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_ppt.py --plan slides_plan.json --style gradient-glass
  python generate_ppt.py --plan slides_plan.json --style styles/vector-illustration.md --resolution 4K
  python generate_ppt.py --plan slides_plan.json --style gradient-glass --output my_ppt

Available styles: gradient-glass, vector-illustration

Environment:
  GEMINI_API_KEY: Google AI API key (required)
""",
    )

    parser.add_argument(
        "--plan",
        required=True,
        help="Path to slides plan JSON file",
    )
    parser.add_argument(
        "--style",
        required=True,
        help="Style name (gradient-glass, vector-illustration) or path to .md file",
    )
    parser.add_argument(
        "--resolution",
        choices=["2K", "4K"],
        default=DEFAULT_RESOLUTION,
        help=f"Image resolution (default: {DEFAULT_RESOLUTION})",
    )
    parser.add_argument(
        "--output",
        help=f"Output directory path (default: {OUTPUT_BASE_DIR}/TIMESTAMP)",
    )
    parser.add_argument(
        "--template",
        help="HTML template path (default: templates/viewer.html relative to script)",
    )

    return parser


def main() -> None:
    """Main entry point for PPT generation."""
    # Load environment variables
    find_and_load_env()

    # Parse arguments
    parser = create_argument_parser()
    args = parser.parse_args()

    # Resolve style path
    style_path = resolve_style_path(args.style)
    print(f"Style: {style_path.name}")

    # Load slides plan
    plan_path = Path(args.plan)
    if not plan_path.exists():
        print(f"Error: Plan file not found: {args.plan}", file=sys.stderr)
        sys.exit(1)
    slides_plan = json.loads(plan_path.read_text(encoding="utf-8"))

    # Load style template
    style_template = load_style_template(style_path)

    # Resolve template path
    if args.template:
        template_path = Path(args.template)
        if not template_path.exists():
            # Try relative to TEMPLATES_DIR
            template_path = TEMPLATES_DIR / args.template
        if not template_path.exists():
            print(f"Warning: Template not found: {args.template}, using default")
            template_path = DEFAULT_TEMPLATE
    else:
        template_path = DEFAULT_TEMPLATE

    # Create output directory
    if args.output:
        output_dir = args.output
        # If output looks like a simple name (no path separators), use it as subdir
        # Otherwise use as-is
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = f"{OUTPUT_BASE_DIR}/{timestamp}"

    os.makedirs(os.path.join(output_dir, "images"), exist_ok=True)

    # Print configuration
    slides = slides_plan.get("slides", [])
    total_slides = len(slides)

    print("=" * 60)
    print("PPT Generator (AgentHub)")
    print("=" * 60)
    print(f"Title: {slides_plan.get('title', 'Untitled')}")
    print(f"Style: {style_path.stem}")
    print(f"Resolution: {args.resolution}")
    print(f"Slides: {total_slides}")
    print(f"Output: {output_dir}")
    print("=" * 60)
    print()

    # Initialize results
    generated_images: List[str] = []
    failed_slides: List[int] = []
    prompts_data: Dict[str, Any] = {
        "metadata": {
            "title": slides_plan.get("title", "Untitled Presentation"),
            "total_slides": total_slides,
            "resolution": args.resolution,
            "style": str(style_path),
            "generated_at": datetime.now().isoformat(),
        },
        "slides": [],
    }

    # Generate each slide
    for slide_info in slides:
        slide_number = slide_info["slide_number"]
        page_type = slide_info.get("page_type", "content")
        content_text = slide_info["content"]

        # Generate prompt
        prompt = generate_prompt(
            style_template,
            page_type,
            content_text,
            slide_number,
            total_slides,
        )

        # Generate image
        image_path = generate_slide(prompt, slide_number, output_dir, args.resolution)

        if image_path:
            generated_images.append(image_path)
        else:
            failed_slides.append(slide_number)

        # Record prompt data
        prompts_data["slides"].append({
            "slide_number": slide_number,
            "page_type": page_type,
            "content": content_text,
            "prompt": prompt,
            "image_path": image_path,
        })

        print()

    # Save prompts
    save_prompts(output_dir, prompts_data)

    # Generate viewer HTML
    viewer_path = generate_viewer_html(output_dir, total_slides, template_path)

    # Print structured result (for agent to parse)
    print()
    print("=" * 60)
    print("Generation Complete!")
    print("=" * 60)
    print(f"Success: {len(generated_images)}/{total_slides} slides")
    if failed_slides:
        print(f"Failed slides: {failed_slides}")
    print(f"Output directory: {output_dir}")
    print(f"Viewer HTML: {viewer_path}")
    print()

    # Print JSON result block that the agent can parse
    result = {
        "status": "success" if len(generated_images) == total_slides else "partial",
        "total": total_slides,
        "generated": len(generated_images),
        "failed": failed_slides,
        "output_dir": output_dir,
        "viewer_html": viewer_path,
        "images": generated_images,
    }
    print("---RESULT---")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("---END RESULT---")

    if failed_slides:
        sys.exit(1)


if __name__ == "__main__":
    main()
