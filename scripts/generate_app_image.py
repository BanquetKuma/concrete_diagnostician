#!/usr/bin/env python3
"""
Generate app illustration using Gemini Imagen API.

Usage:
    source .venv/bin/activate
    python scripts/generate_app_image.py
"""

import os
import sys
import base64
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
project_root = Path(__file__).parent.parent
load_dotenv(project_root / '.env.gemini')

def generate_image():
    """Generate app illustration using Gemini Imagen API"""

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in .env.gemini")
        sys.exit(1)

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("Installing google-genai package...")
        os.system(f"{sys.executable} -m pip install google-genai")
        from google import genai
        from google.genai import types

    # Initialize client
    client = genai.Client(api_key=api_key)

    # Prompt for concrete diagnostician exam app illustration
    prompt = """
    Create a modern, clean illustration for a mobile app about concrete diagnostician certification exam preparation.

    The illustration should include:
    - A stylized concrete structure or bridge in the background
    - Study elements like books or a tablet device
    - Professional, educational atmosphere
    - Modern flat design style with clean lines
    - Color palette: professional blue and gray tones with warm accents
    - Suitable for a mobile app header image
    - Minimalist and friendly design
    - No text in the image

    Style: Modern flat illustration, suitable for a Japanese professional certification study app
    """

    print("Generating image with Gemini Imagen API...")
    print(f"Prompt: {prompt[:100]}...")

    try:
        # Use Imagen 3 model for image generation
        response = client.models.generate_images(
            model='imagen-3.0-generate-002',
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9",
                safety_filter_level="BLOCK_MEDIUM_AND_ABOVE",
            )
        )

        # Save the generated image
        output_dir = project_root / 'assets' / 'images'
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / 'app_hero.png'

        if response.generated_images:
            image = response.generated_images[0]
            image.image.save(str(output_path))
            print(f"\nImage saved to: {output_path}")
            print("Image generation complete!")
            return str(output_path)
        else:
            print("No image was generated")
            return None

    except Exception as e:
        print(f"Error generating image: {e}")

        # Try alternative approach with Gemini 2.0 Flash
        print("\nTrying with Gemini 2.0 Flash experimental image generation...")
        try:
            response = client.models.generate_content(
                model='gemini-2.0-flash-exp',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=['IMAGE', 'TEXT']
                )
            )

            # Extract and save image from response
            output_dir = project_root / 'assets' / 'images'
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / 'app_hero.png'

            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    mime_type = part.inline_data.mime_type
                    print(f"Found inline data with mime type: {mime_type}")

                    if mime_type.startswith('image/'):
                        # The data might be bytes directly or base64 encoded
                        raw_data = part.inline_data.data

                        if isinstance(raw_data, bytes):
                            image_data = raw_data
                        else:
                            # Try base64 decode if it's a string
                            try:
                                image_data = base64.b64decode(raw_data)
                            except:
                                image_data = raw_data.encode() if isinstance(raw_data, str) else raw_data

                        # Determine extension from mime type
                        ext = 'png' if 'png' in mime_type else 'jpg'
                        output_path = output_dir / f'app_hero.{ext}'

                        with open(output_path, 'wb') as f:
                            f.write(image_data)

                        print(f"\nImage saved to: {output_path}")
                        print(f"File size: {len(image_data)} bytes")
                        return str(output_path)

            # Also check for text response with image description
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'text') and part.text:
                    print(f"Text response: {part.text[:200]}...")

            print("No valid image found in response")
            return None

        except Exception as e2:
            print(f"Error with Gemini 2.0 Flash: {e2}")
            import traceback
            traceback.print_exc()
            return None


if __name__ == '__main__':
    generate_image()
