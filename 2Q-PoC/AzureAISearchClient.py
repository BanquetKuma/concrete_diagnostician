# Databricks notebook source
# AzureAISearchClient定義

import requests
import json
  
class AzureAISearchClient:
    def __init__(self, service_name, api_version, api_key):
        self.service_name = service_name
        self.api_version = api_version
        self.api_key = api_key
 
    def get_indexes(self):
        url = f"https://{self.service_name}.search.windows.net/indexes?api-version={self.api_version}"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return [d.get("name") for d in response.json()["value"]]
 
    def delete_index(self, index_name):
        url = f"https://{self.service_name}.search.windows.net/indexes/{index_name}?api-version={self.api_version}"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        response = requests.delete(url, headers=headers)
        if response.status_code == 404:
            print(f"Not found {index_name}")
        else:
            response.raise_for_status()
 
    def create_index(self, index_name, index_schema):
        url = f"https://{self.service_name}.search.windows.net/indexes/{index_name}?api-version={self.api_version}"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
 
        # Create the JSON payload for the index schema
        payload = {
            "name": index_name, **index_schema
        }
        payload_json = json.dumps(payload)
 
        # Make the request to create the index
        response = requests.put(url, headers=headers, data=payload_json)
        response.raise_for_status()
        return response.json()
 
    def add_documents(self, index_name, documents):
        url = f"https://{self.service_name}.search.windows.net/indexes/{index_name}/docs/index?api-version={self.api_version}"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "value": documents
        }
        payload_json = json.dumps(payload)
        response = requests.post(url, headers=headers, data=payload_json)
        response.raise_for_status()
        return response.json()
 
    def search(self, index_name, question, select: list, filter, k=3):
        url = f"https://{self.service_name}.search.windows.net/indexes/{index_name}/docs/search?api-version={self.api_version}"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "search": question,
            "select": ", ".join(select),
            "queryType": "semantic",
            "semanticConfiguration": "semantic_rank",
            "captions": "extractive",
            "answers": "extractive|count-3",
            #"filter":filter,
            "top": k,
            #"orderby":"search.score() desc"
        }
        payload_json = json.dumps(payload)
        response = requests.post(url, headers=headers, data=payload_json)
        response.raise_for_status()
        return response.json().get("value")
 
    def hybrid_search(self, index_name, question, question_vector, select: list, filter, k=3):
        url = f"https://{self.service_name}.search.windows.net/indexes/{index_name}/docs/search?api-version={self.api_version}"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "vectorQueries": [
                {
                    "vector": question_vector,
                    "fields": "incidentvector",
                    "kind": "vector",
                    "exhaustive": True,
                    "k" : k
                }
            ],
            "search": question,
            "select": ", ".join(select),
            "filter":filter,
            "top": k
        }
        payload_json = json.dumps(payload)
        response = requests.post(url, headers=headers, data=payload_json)
        response.raise_for_status()
        return response.json().get("value")
 
    def semantic_hybrid_search(self, index_name, question, question_vector, select: list,filter, k=3):
        url = f"https://{self.service_name}.search.windows.net/indexes/{index_name}/docs/search?api-version={self.api_version}"
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "vectorQueries": [
                {
                    "vector": question_vector,
                    "fields": "incidentvector",
                    "kind": "vector",
                    "k" : k
                }
            ],
            "search": question,
            "select": ", ".join(select),
            "filter":filter,
            "top": k,
            "queryType": "semantic",
            "semanticConfiguration": "semantic_rank",
            "captions": "extractive",
            "answers": "extractive"
        }
        payload_json = json.dumps(payload)
        response = requests.post(url, headers=headers, data=payload_json)
        response.raise_for_status()
        return response.json().get("value")
 


# COMMAND ----------

# dbutils.library.restartPython()