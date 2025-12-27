# Prompt templates for question generation

QUESTION_GENERATION_SYSTEM_PROMPT = """あなたはコンクリート診断士試験の出題者です。
提供された教科書の内容に基づいて、四肢択一問題を作成してください。

【重要な条件】
1. 教科書の内容に忠実に出題すること
2. 選択肢は紛らわしいが、明確に区別可能にすること
3. 解説は教科書の該当箇所を明示すること
4. 実務で重要な知識を優先的に出題すること
5. 正解は1つだけであること

【解説の書き方 - 非常に重要】
解説には必ず以下の内容を含めてください：
- 正解の選択肢が正しい理由
- 各不正解選択肢が誤りである理由（選択肢ごとに具体的に説明）
- 教科書の該当ページやセクションの参照

【出力形式】
必ず以下のJSON形式で出力してください。JSON以外のテキストは含めないでください。

【重要】教科書から十分な情報が見つからない場合でも、以下のいずれかを行ってください：
1. 見つかった情報を基に可能な限り問題を作成する
2. 一般的なコンクリート工学の知識を基に問題を作成する（その場合は source.book に "一般知識" と記載）

絶対にJSON以外の説明文を出力しないでください。
"""

def get_question_generation_prompt(category_name: str, keywords: list, count: int, batch_number: int = 1) -> str:
    """Generate the prompt for question generation"""
    keywords_str = ", ".join(keywords)

    return f"""【分野】{category_name}
【キーワード】{keywords_str}
【生成数】{count}問

上記の分野について、教科書の内容に基づいて{count}問の四肢択一問題を作成してください。

【出力形式】以下のJSON配列形式で出力してください。
[
  {{
    "id": "gen-{category_name}-{batch_number:03d}",
    "year": 2024,
    "number": 1,
    "category": "{category_name}",
    "text": "問題文をここに記述",
    "choices": [
      {{"id": "a", "text": "選択肢1", "isCorrect": false}},
      {{"id": "b", "text": "選択肢2", "isCorrect": true}},
      {{"id": "c", "text": "選択肢3", "isCorrect": false}},
      {{"id": "d", "text": "選択肢4", "isCorrect": false}}
    ],
    "correctChoiceId": "b",
    "explanation": "【正解】b: ～が正しい理由を説明。【誤り】a: ～が誤りである理由。c: ～が誤りである理由。d: ～が誤りである理由。（参照：教科書p.XX）",
    "source": {{"book": "この1冊で合格！コンクリート診断士2024年版", "page": 45, "section": "3.2.1"}}
  }}
]

【注意事項】
- 各問題のidは連番で "gen-{category_name}-001", "gen-{category_name}-002" のようにしてください
- isCorrectがtrueの選択肢は必ず1つだけにしてください
- correctChoiceIdは正解の選択肢のidと一致させてください
- 教科書に記載のある内容のみを出題してください
- 解説には必ず「正解の理由」と「各不正解選択肢が誤りである理由」を含めてください
- 解説には該当する教科書のページ番号やセクションを含めてください
"""

def get_single_question_prompt(category_name: str, keywords: list, topic: str = None) -> str:
    """Generate prompt for a single test question"""
    keywords_str = ", ".join(keywords)
    topic_instruction = f"\n【特定トピック】{topic}" if topic else ""

    return f"""【分野】{category_name}
【キーワード】{keywords_str}{topic_instruction}

上記の分野について、教科書の内容に基づいて1問の四肢択一問題を作成してください。

【出力形式】以下のJSON形式で出力してください。
{{
  "id": "test-001",
  "year": 2024,
  "number": 1,
  "category": "{category_name}",
  "text": "問題文",
  "choices": [
    {{"id": "a", "text": "選択肢1", "isCorrect": false}},
    {{"id": "b", "text": "選択肢2", "isCorrect": true}},
    {{"id": "c", "text": "選択肢3", "isCorrect": false}},
    {{"id": "d", "text": "選択肢4", "isCorrect": false}}
  ],
  "correctChoiceId": "b",
  "explanation": "【正解】b: ～が正しい理由を説明。【誤り】a: ～が誤りである理由。c: ～が誤りである理由。d: ～が誤りである理由。（参照：教科書p.XX）",
  "source": {{"book": "この1冊で合格！コンクリート診断士2024年版", "page": 45, "section": "3.2.1"}}
}}

【重要】解説には必ず以下を含めてください：
- 正解の選択肢が正しい理由
- 各不正解選択肢（a, c, d）が誤りである具体的な理由
- 教科書の該当ページ番号
"""
