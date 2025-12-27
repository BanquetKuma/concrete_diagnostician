#!/usr/bin/env python3
"""
Azure Functions - Custom Web API Skill for Embedding Conversion
Purpose: Generate embeddings with explicit Float32 type conversion
"""

import os
import json
import logging
import struct
import numpy as np
import azure.functions as func
from openai import AzureOpenAI
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Azure OpenAI client
client = AzureOpenAI(
    api_key=os.getenv('AZURE_OPENAI_API_KEY'),
    api_version=os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview'),
    azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT')
)

app = func.FunctionApp()


class Float32Encoder(json.JSONEncoder):
    """Custom JSON encoder that converts numpy float32 to Python float"""
    def default(self, obj):
        if isinstance(obj, np.float32):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def generate_embedding_float32(text: str) -> List[float]:
    """
    Generate embedding and explicitly convert to Float32

    Args:
        text: Input text for embedding generation

    Returns:
        List of floats (Float32) representing the embedding vector
    """
    try:
        # Get embedding from Azure OpenAI
        response = client.embeddings.create(
            input=text,
            model=os.getenv('AZURE_OPENAI_EMBEDDING_DEPLOYMENT', 'text-embedding-3-small')
        )

        # Extract embedding data (Float64 by default)
        embedding_float64 = response.data[0].embedding

        # Convert to numpy array with explicit Float32 dtype
        embedding_float32 = np.array(embedding_float64, dtype=np.float32)

        # Convert to Python list with Float32 precision
        # Round to 7 significant digits (Float32 precision)
        float32_list = []
        for value in embedding_float32:
            # Convert np.float32 to Python float, rounding to Float32 precision
            # Float32 has ~7 decimal digits of precision
            rounded = round(float(value), 7)
            float32_list.append(rounded)

        return float32_list

    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise


@app.function_name(name="GenerateEmbedding")
@app.route(route="embedding", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def generate_embedding(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure AI Search Custom Web API Skill endpoint

    Expected input format:
    {
        "values": [
            {
                "recordId": "unique-id",
                "data": {
                    "text": "text to embed"
                }
            }
        ]
    }

    Returns:
    {
        "values": [
            {
                "recordId": "unique-id",
                "data": {
                    "vector": [0.123, 0.456, ...]
                },
                "errors": null,
                "warnings": null
            }
        ]
    }
    """
    logger.info('Processing embedding generation request')

    try:
        # Parse request body
        req_body = req.get_json()

        if not req_body or 'values' not in req_body:
            return func.HttpResponse(
                json.dumps({
                    "error": "Invalid request format. Expected 'values' array."
                }),
                status_code=400,
                mimetype="application/json"
            )

        # Process each record
        results = []
        for record in req_body['values']:
            record_id = record.get('recordId')
            text = record.get('data', {}).get('text', '')

            try:
                # Generate Float32 embedding
                vector = generate_embedding_float32(text)

                results.append({
                    "recordId": record_id,
                    "data": {
                        "vector": vector
                    },
                    "errors": None,
                    "warnings": None
                })

            except Exception as e:
                logger.error(f"Error processing record {record_id}: {str(e)}")
                results.append({
                    "recordId": record_id,
                    "data": {},
                    "errors": [{
                        "message": f"Failed to generate embedding: {str(e)}"
                    }],
                    "warnings": None
                })

        # Return response with custom JSON encoder
        response_json = json.dumps(
            {"values": results},
            cls=Float32Encoder
        )

        return func.HttpResponse(
            response_json,
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": f"Internal server error: {str(e)}"
            }),
            status_code=500,
            mimetype="application/json"
        )
