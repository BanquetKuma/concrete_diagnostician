import openai
import os
import json
import re
from dotenv import load_dotenv
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery

# 環境変数の読み込み
load_dotenv(verbose=True)

def generate_rag_answer(query):
    # 環境変数の取得
    index_name = os.getenv('INDEX_NAME')
    aisearch_api_key = os.getenv('AISEARCH_API_KEY')
    aisearch_endpoint = os.getenv('AISEARCH_ENDPOINT')
    openai_api_key = os.getenv('OPENAI_API_KEY')
    openai_endpoint = os.getenv('OPENAI_ENDPOINT')
    openai_api_version = os.getenv('OPENAI_API_VERSION')
    system_prompt = os.getenv('SYSTEM_PROMPT')
    openai_model = os.getenv('OPENAI_MODEL')  # モデル名を環境変数として読み込み
    temperature = float(os.getenv('OPENAI_TEMPERATURE', 0))  # temperatureを環境変数から読み込み、デフォルトは0
    prompt_template = os.getenv('PROMPT_TEMPLATE')  # プロンプトテンプレートを環境変数として読み込み
    embedding_model = os.getenv('EMBEDDING_MODEL')  # モデル名を環境変数として読み込み
    top = int(os.getenv('NUMBER_OF_REFERENCES', 3))  # topを環境変数から読み込み、デフォルトは3

    # Azure Searchクライアントの初期化
    credential = AzureKeyCredential(aisearch_api_key)
    search_client = SearchClient(endpoint=aisearch_endpoint, index_name=index_name, credential=credential)
    
    # OpenAI クライアントの初期化
    openai_client = openai.AzureOpenAI(azure_endpoint=openai_endpoint, api_key=openai_api_key, api_version=openai_api_version)
    
    # ハイブリッド検索の実行
    def hybridSearch(query_text):
        def get_embeddings(text):
            embedding = openai_client.embeddings.create(input=[text], model=embedding_model)
            return embedding.data[0].embedding
        
        embd = get_embeddings(query_text)
        vector_query2 = VectorizedQuery(vector=embd, k_nearest_neighbors=3, fields="ContentVector")
        vector_query3 = VectorizedQuery(vector=embd, k_nearest_neighbors=3, fields="SummaryVector")
        
        results = search_client.search(query_type='semantic',
                                       search_text=query_text,
                                       vector_queries=[vector_query2, vector_query3],
                                       semantic_configuration_name="q2-semantic_configuration",
                                       top=top)
        rag_list = []
        for result in results:
            text = json.dumps(result, ensure_ascii=False)
            rag_list.append(text)
        return rag_list
    
    # 回答生成用のプロンプトを作成
    def createPrompt(query_text, rag_list):
        prompt = prompt_template.format(query_text=query_text)  # プロンプトテンプレートからプロンプトを生成
        for src in rag_list:
            item = json.loads(src)
            ragitem = f"""Title:{item['Title']}\nMajorCategory:{item['MajorCategory']}\nSubCategory:{item['SubCategory']}\nContent:{item['Content']}\n
        ---\n"""
            prompt += ragitem
        return prompt
    
    # 質問に対する回答を生成
    def get_answer(question, system_prompt):
        response = openai_client.chat.completions.create(
            model=openai_model,  # 環境変数から取得したモデル名を使用
            temperature=temperature,  # 環境変数から取得したtemperatureを使用
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ])
        return response.choices[0].message.content.strip()

    # 検索結果からページ番号とファイル名の組みを抽出する関数
    def search_page_and_file(text):
        # 正規表現パターンを作成
        page_pattern = r"'page_number': (\d+)"
        file_pattern = r"'file_name': '([^']+)'"
        # 正規表現で全ての数字を抽出
        page_matches = re.findall(page_pattern , text)
        file_matches = re.findall(file_pattern , text)
        page_numbers = [int(match) for match in page_matches]
        file_names = [match for match in file_matches]

        # 要素の組み合わせをタプルとして作成し、一意の組み合わせを抽出
        unique_combinations = set(zip(page_numbers, file_names))

        # unique_combinationsをソートするための関数
        def sort_key(item):
            file_name, page_number = item
            return file_name, page_number
        # unique_combinationsをソート
        sorted_combinations = sorted(unique_combinations, key=sort_key)
        return sorted_combinations
    
    # メインの処理フロー
    rag_list = hybridSearch(query)
    prompt = createPrompt(query, rag_list)
    documenttitle = ""
    for src in rag_list:
        item = json.loads(src)
        ragitem = f"""Title:{item['Title']} MajorCategory:{item['MajorCategory']} SubCategory:{item['SubCategory']}\n"""
        documenttitle += ragitem
    
    # 回答生成
    rag_answer = get_answer(prompt, system_prompt)
    qa_results = []
    qa_results.append({
        '質問' : query,
        'LLM回答' : rag_answer,
        '検索されたドキュメント':documenttitle
    })
    
    # 最終的にリターンする項目のリスト
    response_results = []
    #print("# 質問：", "\n",qa_results[0]['質問'],"\n")
    # RAG回答に含まれる"/"の削除
    pattern = r"\\."
    cleaned_text = re.sub(pattern, "", qa_results[0]['LLM回答'])
    cleaned_text = cleaned_text.replace("\n\n", "\n")
    #print("# 回答：", "\n",cleaned_text,"\n")
    #print("# 参照ファイル (関連性の高い順)：")
    # 参照ファイルのリストを作成
    reference_text_list = []
    # ファイルの有無を確認するためのフラグ
    file_exists = False
    # ファイルが無いことを確認するためのフラグ
    file_not_exists= False
    for rag_text in rag_list:
        try:
            #print(" ", search_page_and_file(rag_text)[0][1])
            reference_text_list.append(search_page_and_file(rag_text)[0][1])
            file_exists = True
        except IndexError:
            if file_exists:
                pass
            else:
                if not file_not_exists:
                    #print(" 該当する資料がありません。")
                    reference_text_list.append("該当する資料がありません。")
                    file_not_exists = True

    response_results.append({
        '質問' : qa_results[0]['質問'],
        'LLM回答' : cleaned_text,
        '検索されたドキュメント':reference_text_list
    })
    return response_results

if __name__ == '__main__':
    query = "生徒が躓きやすいところを幾つか挙げてください"
    answer = generate_rag_answer(query)
    print("# 質問：", "\n",answer [0]['質問'],"\n")
    print("# 回答：", "\n",answer [0]['LLM回答'],"\n")
    print("# 参照ファイル (関連性の高い順)：")
    for file in answer[0]['検索されたドキュメント']:
        print(" ", file)
