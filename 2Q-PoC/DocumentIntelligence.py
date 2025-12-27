from typing import List
import requests
import time
import glob
import json
import re
import pypdf
import os
import fitz
import mimetypes
from dataclasses import dataclass
from PIL import Image
from mimetypes import guess_type
import json

@dataclass
class DocumentIntelligenceClient:
    """google style docstring
    Args:
        endpoint (str): The endpoint for the Document Intelligence service.
        key (str): The subscription key for the Document Intelligence service.
        api_version (str): The version of the Document Intelligence API to use.
        custom_flag (bool): A flag to indicate whether to use a custom model.
        """
    endpoint: str 
    key: str 
    api_version: str 
    custom_flag:bool = False

    def _request(self, file_url: str, model_id: str, pages: int = 1) -> str:
        """google style docstring
        overview:
        Sends a request to analyze a file using the specified model.
        Args:
            file_url (str): The URL of the file to analyze.
            model_id (str): The ID of the model to use for analysis.
            pages (int): The number of pages to analyze.
        Returns:
            str: The request ID for the analysis request.
            """
        url = f"{self.endpoint}documentintelligence/documentModels/{model_id}:analyze?api-version={self.api_version}&pages={pages}"
        headers = {"Ocp-Apim-Subscription-Key": self.key}
        response = requests.post(url, headers=headers, json={"urlSource": file_url})
        return response.headers["apim-request-id"]
    
    def _get_result(self, request_id: str, model_id: str, format_name: str) -> dict:
        """google style docstring
        overview:
        Gets the result of an analysis request.
        Args:
            request_id (str): The request ID for the analysis request.
            model_id (str): The ID of the model used for analysis.
        Returns:
            dict: The result of the analysis request."""
        url = f"{self.endpoint}documentintelligence/documentModels/" \
              + f"{model_id}/analyzeResults/{request_id}?api-version={self.api_version}&outputContentFormat={format_name}"
        headers = {"Ocp-Apim-Subscription-Key": self.key}
        return requests.get(url, headers=headers).json()

    # 段落番号を取得するための関数
    def _get_paragraph_numbers(self, elements_data: dict) -> list:
        """google style docstring
        overview:
        Gets the paragraph numbers from the elements data.
        Args:
            elements_data (dict): A dictionary containing the elements data.
        Returns:
            list: A list of paragraph numbers."""
        paragraph_numbers = []
        if elements_data.get('elements'):
            for paragraph in elements_data['elements']:
                paragraph_numbers.append(paragraph.split('/')[-1])  # '/paragraphs/4' のような形式なので、最後の番号を取得
        return paragraph_numbers

    # 段落番号に対応するContentを結合するための関数
    def _merge_paragraphs(self, paragraph_numbers: list, content_data: list) -> str:
        """google style docstring
        overview:
        Merges the content of paragraphs based on the paragraph numbers.
        Args:
            paragraph_numbers (list): A list of paragraph numbers.
            content_data (list): A list of content data.
        Returns:
            str: A string representing the merged content."""
        merged_content = []
        if paragraph_numbers:
            for paragraph_num in paragraph_numbers:
                # 段落番号が一致するContentを検索
                for index, content in enumerate(content_data):
                    if f'/paragraphs/{index + 1}' == f'/paragraphs/{paragraph_num}':
                        merged_content.append(content['content'])
        return ' '.join(merged_content)

    def _ocr_to_markdown(self, table: dict) -> str:
        """google style docstring
        Converts an OCR-detected table into a Markdown formatted table.
        Args:
            table (dict): A dictionary representing the OCR-detected table. 
                          Expected keys include 'caption' for the table's caption 
                          and 'cells' which is a list of cell dictionaries. Each cell 
                          dictionary should contain 'rowIndex', 'columnIndex', 'content', 
                          and optionally 'columnSpan'.
        Returns:
            str: A string representing the table in Markdown format.
        """
        # 元の方法でテーブルをマークダウン形式に変換
        caption = table.get('caption', {}).get('content', 'Table')
        markdown_table = f"## {caption}\n\n"

        rows = {}
        max_col_index = 0
        for cell in table.get('cells', []):
            row_index = cell['rowIndex']
            col_index = cell['columnIndex']
            col_span = cell.get('columnSpan', 1)
            content = cell.get('content', '')

            if row_index not in rows:
                rows[row_index] = {}
            rows[row_index][col_index] = {'content': content, 'col_span': col_span}
            max_col_index = max(max_col_index, col_index + col_span - 1)

        header_row = []
        separator_row = []
        for col_index in range(max_col_index + 1):
            cell = rows.get(0, {}).get(col_index, {})
            content = cell.get('content', '')
            col_span = cell.get('col_span', 1)
            header_row.append(content)
            separator_row.append('---' * col_span)

        markdown_table += '| ' + ' | '.join(header_row) + ' |\n'
        markdown_table += '| ' + ' | '.join(separator_row) + ' |\n'

        for row_index in range(1, len(rows)):
            row_content = []
            for col_index in range(max_col_index + 1):
                cell = rows.get(row_index, {}).get(col_index, {})
                content = cell.get('content', '')
                col_span = cell.get('col_span', 1)
                row_content.append(content)
                if col_span > 1:
                    row_content.extend([''] * (col_span - 1))

            markdown_table += '| ' + ' | '.join(row_content) + ' |\n'

        return markdown_table

    def get_raw_result(self, url, retry_count=2, waiting_time=5, model="prebuilt-read")-> dict:
        """google style docstring
        overview:
        Analyzes a file using the specified model and returns the raw result.
        Args:
            url (str): The URL of the file to analyze.
            retry_count (int): The number of times to retry the request.
            waiting_time (int): The time to wait between retries.
            model (str): The model to use for analysis.
        Returns:
            dict: The result of the analysis request."""
        # デフォルトで "prebuilt-read" モデルを使用していますが、他のモデルも指定可能か？
        request_id = self._request(url, model)
        for count in range(retry_count):
            time.sleep(waiting_time)
            result = self._get_result(request_id, model)
            if result.get("status", "failed") == "succeeded":
                break
        return result

    def _to_output_format(self, result: dict) -> List[dict]:
        """google style docstring
        overview:
        Converts the result of an analysis request to the desired output format.
        Args:
            result (dict): The result of the analysis request.
        Returns:
            [dict]: A list of dictionaries containing the output content."""
        if self.custom_flag:
            annlyze_result = self.fields_analyze(result)
        else:
            if result["analyzeResult"]["content"]:
                annlyze_result = result["analyzeResult"]["content"].replace("\"","").replace("\'","")
            else:
                annlyze_result = result["analyzeResult"]["content"]
        pages = result["analyzeResult"]["pages"]
        lines_text = [{
            "page_number": page["pageNumber"],
            "content": " ".join([line.get("content") for line in page["lines"]]),
        } for page in pages]
        for text in lines_text:
            if text.get("content"):
                # ダブルクォートとシングルクォートを無条件に削除している　⇒　良いか否かは不明
                #text["content"].replace("\"","").replace("\'","")
                text["content"] = text["content"].replace("\"","").replace("\'","")
        return (annlyze_result,lines_text)

    def get_raw_result_from_binary(self, file_content, format_name ,retry_count=100, waiting_time=5)-> dict:
        """google style docstring
        overview:
        Analyzes a file using the specified model and returns the raw result.
        Args:
            file_content (bytes): The content of the file to analyze.
            format_name (str): The format of the output content.
            retry_count (int): The number of times to retry the request.
            waiting_time (int): The time to wait between retries.
        Returns:
            dict: The result of the analysis request."""
        if self.custom_flag:
            model =  format_name
        else:
            model = 'prebuilt-layout'
        url = f"{self.endpoint}documentintelligence/documentModels/{model}:analyze?api-version={self.api_version}&outputContentFormat={format_name}"
        headers = {
            "Content-Type": "application/pdf",# pdfファイルの場合。他のファイル形式の場合は適宜変更
            "Ocp-Apim-Subscription-Key": self.key
        }

        response = requests.post(url=url, headers=headers, data=file_content)   
        request_id = response.headers["apim-request-id"]

        for count in range(retry_count):
            result = self._get_result(request_id, model,format_name)
            if result.get("status", "failed") == "succeeded":
                return result
                # return self._to_output_format(result)
            time.sleep(waiting_time)
        return result
    
    def get_ocr_result(self, file_path, format_name='text')-> dict:
        """google style docstring
        overview:
        Analyzes a file using the specified model and returns the OCR result.
        Args:
            file_path (str): The path to the file to analyze.
            format_name (str): The format of the output content.
        Returns:
            dict: The OCR result of the analysis request."""
        with open(file_path, "rb") as f:
            file_content = f.read()
        return self.get_raw_result_from_binary(file_content,format_name)
    
    def fields_analyze(self, result:dict)-> dict:
        """google style docstring
        overview:
        Analyzes the fields in the result of an analysis request.
        Args:
            result (dict): The result of the analysis request.
        Returns:
            dict: A dictionary containing the fields and their content."""
        fields_string = dict(filter(lambda x: x[1]['type']=='string',result["analyzeResult"]["documents"][0]["fields"].items()))
        fields_string_list=[]
        for field in fields_string:
            if fields_string[field].get("content"):
                fields_string_list.append((field, fields_string[field].get("content").replace("\"","").replace("\'","")))
            else:
                fields_string_list.append((field, fields_string[field].get("content")))
        return dict(fields_string_list)
    
    def split_and_merge_pdf(self, input_file_path,split_file_dir,chunk_size)-> list:
        """google style docstring
        overview:
        Splits a PDF file into smaller files and merges the OCR results.
        Args:
            input_file_path (str): The path to the input file.
            split_file_dir (str): The directory to save the split files.
            chunk_size (int): The number of pages to process at a time.
        Returns:
            list: A list of dictionaries containing the OCR results."""
        file_name = os.path.basename(input_file_path)
        file_name_without_extension = os.path.splitext(file_name)[0]
        pdf_len = len(pypdf.PdfReader(input_file_path).pages)
        if pdf_len > 1800:# 1800ページ以上の場合は分割してOCRを実行
            os.makedirs(f"{split_file_dir}/{file_name_without_extension}",exist_ok=True)
            for i in range(0, pdf_len, chunk_size):
                merger = pypdf.PdfMerger()
                merger.append(input_file_path, pages=pypdf.PageRange(f'{i}:{i + chunk_size}'))
                merger.write(f"{split_file_dir}/{file_name_without_extension}/{file_name_without_extension}_from_{i+1}_to_{i + chunk_size}.pdf")
                merger.close()
            merged_result = []
            split_file_list = glob.glob(os.path.join(f"{split_file_dir}/{file_name_without_extension}", '*'))
            for split_file_path in split_file_list:
                split_file_result = self.get_ocr_result(split_file_path)
                pattern = r'_from_(\d+)_to_\d+\.pdf'
                from_number = re.search(pattern, split_file_path).group(1)
                diff = int(from_number) - 1
                for r in split_file_result:
                    r["page_number"] = r["page_number"] + diff
                    merged_result.append(r)
            return merged_result
        else:# 1800ページ以下の場合はそのままOCRを実行
            return self.get_ocr_result(input_file_path)

    def merge_bounding_regions(self, bounding_regions)-> list:
        """google style docstring
        overview:
        Merges a list of bounding regions into a single polygon.
        Args:
            bounding_regions (list): A list of bounding region dictionaries.
        Returns:
            list: A list of polygon coordinates representing the merged bounding region.
        """
        if not bounding_regions:
            return []  
    
        min_x = float('inf')  
        min_y = float('inf')  
        max_x = float('-inf')  
        max_y = float('-inf')  
    
        for region in bounding_regions:  
            polygon = region["polygon"]  
            for i in range(0, len(polygon), 2):  
                x = polygon[i]  
                y = polygon[i + 1]  
                if x < min_x:  
                    min_x = x  
                if y < min_y:  
                    min_y = y  
                if x > max_x:  
                    max_x = x  
                if y > max_y:  
                    max_y = y  
    
        merged_polygon = [  
            min_x, min_y,  # 左上  
            max_x, min_y,  # 右上  
            max_x, max_y,  # 右下  
            min_x, max_y   # 左下  
        ]  
    
        return merged_polygon
    
    def is_within_table_or_figure(self, paragraph, regions)-> bool:
        """google style docstring
        overview:
        Determines whether a paragraph is within the table or figure regions.
        Args:
            paragraph (dict): A paragraph dictionary.
            regions (list): A list of region polygons.
        Returns:
            bool: True if the paragraph is within the table or figure regions, False otherwise."""
        px1, py1, px2, py2, px3, py3, px4, py4 = paragraph["boundingRegions"][0]["polygon"]  
        for region in regions:
            rx1, ry1, rx2, ry2, rx3, ry3, rx4, ry4 = region
            if (rx1 <= px1 <= rx2 and ry1 <= py1 <= ry3) or (rx1 <= px3 <= rx2 and ry1 <= py3 <= ry3):
                return True
        return False
    
    def is_within_exclusion_zone(self, bounding_regions, exclusion_zones)-> bool:  
        """google style docstring
        overview:
        Determines whether the bounding regions are within the exclusion zones.
        Args:
            bounding_regions (list): A list of bounding region dictionaries.
            exclusion_zones (list): A list of exclusion zone polygons.
        Returns:
            bool: True if the bounding regions are within the exclusion zones, False otherwise.
            """
        for bounding_region in bounding_regions:  
            polygon = bounding_region.get("polygon", [])  
            if not isinstance(polygon, list):  
                continue
    
            px1, py1, px2, py2, px3, py3, px4, py4 = polygon  
    
            for zone in exclusion_zones:
                zx1, zy1, zx2, zy2, zx3, zy3, zx4, zy4 = zone  
                if (px1 <= zx1 <= px2 and py1 <= zy1 <= py3) or (px1 <= zx3 <= px2 and py1 <= zy3 <= py3):
                    return True
    
        return False
    
    def _concatenate_paragraphs(self, paragraphs)-> str:
        """google style docstring
        overview:
        Concatenates the content of a list of paragraphs.
        Args:
            paragraphs (list): A list of paragraph dictionaries.
        Returns:
            str: A string representing the concatenated content of the paragraphs."""
        return ' '.join(paragraph["content"] for paragraph in paragraphs)
     
    def extract_content_by_page(self, extract_keyword, file_path, file_name, result: dict) -> list:
        """google style docstring
        overview:
        Extracts content from the OCR result by page.
        Args:
            extract_keyword (list): A list of keywords to extract.
            file_path (str): The path to the file being processed.
            file_name (str): The name of the file being processed.
            result (dict): The result of the OCR analysis.
        Yields:
            dict: A dictionary containing the extracted content."""
        analyze_result = result["analyzeResult"]
        pages = analyze_result.get("pages", [])  
        paragraphs = analyze_result.get("paragraphs", [])  
        tables = analyze_result.get("tables", [])  
        figures = analyze_result.get("figures", [])  
        extracted_pages = []  
        caution_keywords = extract_keyword

        id = 1
        
        for page in pages:  
            page_number = page["pageNumber"]
            print(f"{page_number}ページ処理開始")
            
            content_by_type = []  
            elements = []
            exclusion_zones = []

            # 除外ゾーンの設定
            for paragraph in paragraphs:
                if paragraph["boundingRegions"][0]["pageNumber"] == page_number:
                    if paragraph["content"] == "Infineon":
                        exclusion_zones.append(paragraph["boundingRegions"][0]["polygon"])

            # 各要素の抽出
            for paragraph in paragraphs:  
                if paragraph["boundingRegions"][0]["pageNumber"] == page_number:
                    if paragraph["content"] == "Infineon":
                        continue
                    elements.append((paragraph, "paragraph"))  
            
            for table in tables:  
                if table["boundingRegions"][0]["pageNumber"] == page_number:  
                    elements.append((table, "table"))  
            
            for figure in figures:  
                if figure["boundingRegions"][0]["pageNumber"] == page_number:
                    if self.is_within_exclusion_zone(figure["boundingRegions"], exclusion_zones):
                        continue
                    elements.append((figure, "figure"))  
            
            # 上下位置でソート
            elements.sort(key=lambda x: x[0]["boundingRegions"][0]["polygon"][1])  
            
            # 図・表の領域リスト
            table_figure_regions = []  
            
            # 各要素の分類と処理
            for element, element_type in elements:  
                if element.get("role") in ["pageHeader", "pageFooter", "pageNumber"]:  
                    continue

                content = element.get("content", "")
                classified_type = "その他の文章"

                if element_type == "table":  
                    content = self._ocr_to_markdown(element)  # テーブルをマークダウン形式に変換
                    merged_polygon = self.merge_bounding_regions(element["boundingRegions"])
                    table_figure_regions.append(merged_polygon)
                    classified_type = "表"
                    
                elif element_type == "figure":  
                    # 図の中の段落を結合して一つの塊にする
                    # figure_paragraphs = [
                    #     paragraph for paragraph in paragraphs
                    #     if self.is_within_table_or_figure(paragraph, [self.merge_bounding_regions(element["boundingRegions"])])
                    # ]
                    paragraph_numbers = self._get_paragraph_numbers(element)
                    content = self._merge_paragraphs(paragraph_numbers, analyze_result["paragraphs"])
                    merged_polygon = self.merge_bounding_regions(element["boundingRegions"])
                    table_figure_regions.append(merged_polygon)
                    classified_type = "図"
                    
                elif any(keyword in content.lower() for keyword in caution_keywords):
                    if self.is_within_table_or_figure(element, table_figure_regions):  
                        classified_type = "図・表内の注意点"  
                    else:  
                        classified_type = "図・表外の注意点"
                        
                elif element.get("role") == "sectionHeading":  
                    classified_type = "章タイトル"  

                content_by_type.append({
                    "type": classified_type,  
                    "content": content,  
                    "boundingRegions": element.get("boundingRegions", [])  
                })
            
            # "その他の文章" で図・表内に含まれるものをフィルタリング
            filtered_content_by_type = []
            for p in content_by_type:
                if p["type"] == "その他の文章" and self.is_within_table_or_figure(p, table_figure_regions):
                    continue  
                filtered_content_by_type.append(p)

            # フィルタリング後の内容を処理
            for p in filtered_content_by_type:
                merged_region = self.merge_bounding_regions(p["boundingRegions"])
                figure_table_type = None  
                if p["type"] == "表":  
                    figure_table_type = 1  
                elif p["type"] == "図":
                    figure_table_type = 0
                
                yield {
                    "id": id,
                    "file_name": file_name,
                    "file_path": str(file_path),
                    "page_number": page_number,
                    "type": p["type"],
                    "figure_table_type": figure_table_type,
                    "content": p["content"],  
                    "region": merged_region
                }

                id += 1

    def get_processed_result(self, file_path, split_file_path, extract_file_path, chunk_size, extract_keyword, file_name, format_name='', page_range=None):
        """google style docstring
        overview:
        Processes a file by splitting it into smaller files and extracting content.
        Args:
            file_path (str): The path to the file to process.
            split_file_path (str): The path to save the split files.
            extract_file_path (str): The path to save the extracted files.
            chunk_size (int): The number of pages to process at a time.
            extract_keyword (list): A list of keywords to extract.
            file_name (str): The name of the file being processed.
            format_name (str): The format of the output content.
            page_range (tuple): A tuple containing the start and end page numbers to process.
        Returns:
            list: A list of dictionaries containing the extracted content.
        """
        total_pages = len(pypdf.PdfReader(file_path).pages)
        
        if page_range is not None:  
            start_page, end_page = page_range
            print(f"全ページ数: {total_pages}, start_page: {start_page}, end_page: {end_page}")

            if start_page < 1 or end_page > total_pages:  
                raise ValueError("ページ数を超過しています")

            base_name = os.path.splitext(file_name)[0]  
            extract_file_name = f"{base_name}_{start_page}_to_{end_page}_extracted.pdf"
            extract_file_full_path = os.path.join(extract_file_path, extract_file_name)

            input_file_path = extract_file_full_path
        else:  
            input_file_path = file_path

        print("OCR開始")
        processed_result = self.split_and_merge_pdf(input_file_path, split_file_path, chunk_size)
        print("OCR終了")
        return list(self.extract_content_by_page(extract_keyword, file_path, file_name, processed_result))
