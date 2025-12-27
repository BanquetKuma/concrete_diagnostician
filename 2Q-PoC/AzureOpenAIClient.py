from setting import IniFileReader
import os
import asyncio
from dataclasses import dataclass, asdict
from openai import AzureOpenAI
import json
import fitz
import io
import base64
from PIL import Image

@dataclass
class AzureOpenAIClient:
    def __init__(self, api_key, azure_endpoint, api_version):
        # self.ini_reader = IniFileReader('setting.ini')
        # self.api_key = self.ini_reader.get_value('AZURE_OPENAI', 'api_key')
        # self.azure_endpoint = self.ini_reader.get_value('AZURE_OPENAI', 'azure_endpoint')
        # self.api_version = self.ini_reader.get_value('AZURE_OPENAI', 'api_version')

        self.api_key = api_key #"7905e0809f6244b8b0a28cb8fff2f92c"
        self.azure_endpoint = azure_endpoint #"https://openai-tmcallgenai-canada.openai.azure.com/"
        self.api_version = api_version #"2023-07-01-preview"

        self.openai_client = AzureOpenAI(azure_endpoint=self.azure_endpoint, api_key=self.api_key, api_version=self.api_version)

    def encode_pdf_first_page_as_image(self, pdf_path):
        # PDFを開く
        pdf_document = fitz.open(pdf_path)
        
        # 最初のページを取得
        page = pdf_document.load_page(0)
        
        # ページを画像に変換
        pix = page.get_pixmap()
        
        # 画像をPIL Imageに変換
        img = Image.open(io.BytesIO(pix.tobytes()))
        
        # 画像をバイナリデータとして保存
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        
        # Base64エンコード
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return img_str

    def create_image_prompt(self, deployment, image_path, text, temperature=0.0, presence_penalty=0.0, frequency_penalty=0.0, top_p=1.0, seed=42, response_format={}):
        base64_image = self.encode_pdf_first_page_as_image(image_path)
        image_url = "data:image/png;base64," + base64_image  # PNG形式の画像

        completion = self.openai_client.chat.completions.create(
            model=deployment,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": text
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url
                            }
                        }
                    ]
                }
            ],
            temperature=temperature,
            presence_penalty=presence_penalty,
            frequency_penalty=frequency_penalty,
            top_p=top_p,
            seed=seed,
            response_format=response_format
        )
        return completion.choices[0].message.content

    def get_embedding(self, model, text):
        response = self.openai_client.embeddings.create(input=text, model=model)
        embedding = response.data[0].embedding
        return embedding

    def get_completion_with_tools(self, model, messages,temperature,tools={}):
        response = self.openai_client.chat.completions.create(model=model,messages=messages,temperature=temperature,tools=tools)
        message = response.choices[0].message
        #print(message)

        if message.tool_calls[0].function.name is None:
            return message.content
        else:
            return json.loads(message.tool_calls[0].function.arguments)
    
    def get_completion(self, model, messages, response_format={}):
        response = ""
        message = ""
        if response_format != {}:
            response = self.openai_client.chat.completions.create(
                model=model,messages=messages,temperature=0.0,presence_penalty=0.0,frequency_penalty=0.0,top_p=1.0,seed=42,response_format=response_format)
            message = response.choices[0].message
        
        if response_format == {}:
            response = self.openai_client.chat.completions.create(model=model,messages=messages,temperature=0)
            message = response.choices[0].message

        return message.content

    def get_completion2(self, model, messages,temperature, tools={}):
        response = self.openai_client.chat.completions.create(model=model,messages=messages,temperature=temperature,tools=tools)
        message = response.choices[0].message
        #print(message.tool_calls[0].function.arguments)

        if message.tool_calls is None:
            return message.content
        else:
            if message.tool_calls[0].function.name == "split_by_theme2":
                dict=eval(message.tool_calls[0].function.arguments)
                Incident = dict['Incident'] +' --- '+ dict['Qusetion_list'].replace("\n", "  ")
                #print(Incident)
                Solution = ''
                for index, d in enumerate(dict['Solution']):
                    value_list = list(d.values())  
                    Solution =Solution+'###'+value_list[0].replace("\n", "  ")+' --- '+value_list[1].replace("\n", "  ")+'### '
                #print(Solution)
                arguments=f"{{\
                    \n\"Incident\":\"{Incident}\",\
                    \n\"Trend\":\"{dict['Trend']}\",\
                    \n\"Solution\":\"{Solution}\"\
                    \n}}"
                #print(arguments)
                return json.loads(arguments)
            return json.loads(message.tool_calls[0].function.arguments)
    
    def get_completion3(self, model, messages,temperature, tools={}):
        response = self.openai_client.chat.completions.create(model=model,messages=messages,temperature=temperature,tools=tools)
        message = response.choices[0].message
        #print(message.tool_calls[0].function.arguments)

        if message.tool_calls is None:
            return message.content
        else:
            return json.loads(message.tool_calls[0].function.arguments)