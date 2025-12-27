# Category definitions for Concrete Diagnostician exam questions

CATEGORIES = {
    "materials": {
        "name": "コンクリート材料",
        "keywords": ["セメント", "骨材", "混和材", "混和剤", "水", "鉄筋"],
        "count": 37,  # 15 existing + 22 new
        "description": "コンクリートの構成材料に関する問題"
    },
    "mix-design": {
        "name": "配合設計",
        "keywords": ["水セメント比", "スランプ", "空気量", "単位水量", "単位セメント量",
                     "配合強度", "呼び強度", "細骨材率", "粗骨材", "ワーカビリティー",
                     "AE剤", "減水剤", "フライアッシュ", "高流動コンクリート"],
        "count": 25,  # 10 existing + 15 new
        "description": "コンクリートの配合設計に関する問題"
    },
    "construction": {
        "name": "施工",
        "keywords": ["打設", "締固め", "養生", "打継ぎ", "運搬", "型枠"],
        "count": 37,  # 15 existing + 22 new
        "description": "コンクリートの施工に関する問題"
    },
    "quality": {
        "name": "品質管理・検査",
        "keywords": ["圧縮強度試験", "非破壊検査", "コア採取", "反発硬度", "超音波"],
        "count": 38,  # 15 existing + 23 new
        "description": "品質管理と各種検査方法に関する問題"
    },
    "deterioration": {
        "name": "劣化・損傷",
        "keywords": ["中性化", "塩害", "ASR", "アルカリシリカ反応", "凍害", "化学的侵食", "ひび割れ"],
        "count": 50,  # 20 existing + 30 new
        "description": "コンクリートの劣化現象と損傷に関する問題"
    },
    "diagnosis": {
        "name": "調査・診断",
        "keywords": ["目視点検", "コア採取", "調査計画", "劣化予測", "健全度評価"],
        "count": 38,  # 15 existing + 23 new
        "description": "構造物の調査・診断方法に関する問題"
    },
    "repair": {
        "name": "補修・補強",
        "keywords": ["断面修復", "ひび割れ補修", "表面保護", "電気防食", "補強"],
        "count": 25,  # 10 existing + 15 new
        "description": "補修・補強工法に関する問題"
    }
}

def get_all_categories():
    """Get all category codes"""
    return list(CATEGORIES.keys())

def get_category_info(category_code: str):
    """Get category information by code"""
    return CATEGORIES.get(category_code)

def get_total_question_count():
    """Get total number of questions across all categories"""
    return sum(cat["count"] for cat in CATEGORIES.values())
