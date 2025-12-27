from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from ..services.automation_service import automation_service
from ..services.gemini_service import gemini_service
from datetime import datetime

router = APIRouter(
    prefix="/automation/research",
    tags=["automation"],
    responses={404: {"description": "Not found"}},
)

class GenerateRequest(BaseModel):
    prompt: str

@router.post("/gen_content")
def generate_content_api(request: GenerateRequest):
    """Generate text via Gemini (synchronous wrapper)"""
    return {"text": gemini_service.generate_content(request.prompt)}

class StartResearchRequest(BaseModel):
    symbols: List[str]
    prompt_id: int
    prompt_content: str 

@router.post("/start")
async def start_research(request: StartResearchRequest):
    result = automation_service.start_research(request.symbols, request.prompt_content)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.post("/stop")
async def stop_research():
    return automation_service.stop_research()

    return automation_service.get_status()

# News Summary
from ..database import Stock, engine, Session
from sqlmodel import select

class NewsItem(BaseModel):
    title: str
    date: str = ""

class SummarizeNewsRequest(BaseModel):
    symbol: str
    news_items: List[NewsItem]

@router.post("/news/summarize")
def summarize_news(request: SummarizeNewsRequest):
    """
    Summarize list of news items in Japanese using Gemini.
    Updates Stock.news_summary_jp in DB.
    """
    if not request.news_items:
        return {"summary": "ニュースが提供されていません。"}

    # Construct Prompt
    news_text = "\n".join([f"- {item.title} ({item.date})" for item in request.news_items[:10]]) # Limit to 10
    
    prompt = f"""
以下の銘柄の最新ニュースを基に、市場のセンチメントと重要な出来事を日本語で要約してください。
銘柄: {request.symbol}

【ニュース一覧】
{news_text}

【制約】
- 日本語で出力すること
- 300文字以内で簡潔にまとめること
- 投資家にとって重要な情報を優先すること（決算、新製品、提携、アナリスト評価など）
- "ニュースによると"などの前置きは省略し、要点から始めること
- 追加の提案は不要です
"""
    
    try:
        # Generate
        summary = gemini_service.generate_content(prompt)
        
        # Clean up error prefixes if any (though gemini_service returns "Error:..." on failure)
        if summary.startswith("Error:"):
            return {"summary": summary, "error": True}

        # Save to DB
        with Session(engine) as session:
            stock = session.exec(select(Stock).where(Stock.symbol == request.symbol)).first()
            if stock:
                stock.news_summary_jp = summary
                stock.updated_at = datetime.utcnow()
                session.add(stock)
                session.commit()
                
        return {"summary": summary}
        
    except Exception as e:
        return {"summary": f"Error generating summary: {str(e)}", "error": True}
