#!/usr/bin/env python3
"""
Setup Gemini File Search Store and upload PDFs.

Usage:
    source .venv/bin/activate
    python scripts/gemini_rag/setup_file_store.py
"""

import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

def main():
    # Load environment variables
    env_path = project_root / '.env.gemini'
    if not env_path.exists():
        print(f"Error: {env_path} not found.")
        print("Please copy .env.gemini.example to .env.gemini and set your API key.")
        sys.exit(1)

    load_dotenv(env_path)

    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key or api_key == 'your-gemini-api-key':
        print("Error: GOOGLE_API_KEY is not set in .env.gemini")
        sys.exit(1)

    # Import google.genai after loading env
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("Error: google-genai not installed.")
        print("Run: pip install google-genai")
        sys.exit(1)

    # Initialize client
    print("Initializing Gemini client...")
    client = genai.Client(api_key=api_key)

    # Find PDF files
    data_dir = project_root / 'data'
    pdf_files = sorted([
        f for f in data_dir.iterdir()
        if f.suffix == '.pdf' and 'part' in f.name
    ])

    if not pdf_files:
        print(f"Error: No PDF files found in {data_dir}")
        print("Expected files like: concrete_diagnostician_2024_part01_*.pdf")
        sys.exit(1)

    print(f"Found {len(pdf_files)} PDF files to upload:")
    for pdf in pdf_files:
        size_mb = pdf.stat().st_size / (1024 * 1024)
        print(f"  - {pdf.name} ({size_mb:.1f} MB)")

    # Check total size
    total_size = sum(f.stat().st_size for f in pdf_files)
    total_size_mb = total_size / (1024 * 1024)
    print(f"\nTotal size: {total_size_mb:.1f} MB")

    if total_size_mb > 1000:
        print("Warning: Total size exceeds 1GB free tier limit!")

    # Create File Search Store
    print("\nCreating File Search Store...")
    store_name = os.getenv('FILE_SEARCH_STORE_NAME', 'concrete-diagnostician-textbook')

    try:
        file_search_store = client.file_search_stores.create(
            config={'display_name': store_name}
        )
        print(f"Created store: {file_search_store.name}")
    except Exception as e:
        print(f"Error creating store: {e}")
        sys.exit(1)

    # Upload PDFs
    print("\nUploading PDFs to File Search Store...")
    uploaded_files = []

    for i, pdf_file in enumerate(pdf_files, 1):
        print(f"\n[{i}/{len(pdf_files)}] Uploading: {pdf_file.name}")

        try:
            operation = client.file_search_stores.upload_to_file_search_store(
                file=str(pdf_file),
                file_search_store_name=file_search_store.name,
                config={'display_name': pdf_file.name}
            )

            # Wait for upload to complete
            retry_count = 0
            max_retries = 60  # 5 minutes max (5 sec * 60)

            while not operation.done and retry_count < max_retries:
                time.sleep(5)
                operation = client.operations.get(operation)
                retry_count += 1
                print(f"  Waiting... ({retry_count * 5}s)")

            if operation.done:
                print(f"  Completed: {pdf_file.name}")
                uploaded_files.append(pdf_file.name)
            else:
                print(f"  Warning: Upload may not have completed for {pdf_file.name}")

        except Exception as e:
            print(f"  Error uploading {pdf_file.name}: {e}")
            continue

    # Summary
    print("\n" + "=" * 50)
    print("Upload Summary")
    print("=" * 50)
    print(f"Store Name: {file_search_store.name}")
    print(f"Successfully uploaded: {len(uploaded_files)}/{len(pdf_files)} files")

    # Update .env.gemini with store name
    print("\nUpdating .env.gemini with store name...")
    update_env_file(env_path, 'FILE_SEARCH_STORE_NAME', file_search_store.name)

    print("\nSetup complete!")
    print(f"\nNext step: Run generate_questions.py to generate questions")

def update_env_file(env_path: Path, key: str, value: str):
    """Update a key in the .env file"""
    lines = []
    key_found = False

    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith(f'{key}='):
                lines.append(f'{key}={value}\n')
                key_found = True
            else:
                lines.append(line)

    if not key_found:
        lines.append(f'\n{key}={value}\n')

    with open(env_path, 'w') as f:
        f.writelines(lines)

    print(f"  Updated {key} in {env_path}")

if __name__ == '__main__':
    main()
