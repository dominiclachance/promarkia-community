from typing import List
import uuid
import requests  # to perform HTTP requests
from pathlib import Path

from openai import OpenAI
from tradingview_ta import TA_Handler, Interval, Exchange

def generate_technical_stock_analysis(query: str) -> List[str]:
    """
    Function to generate technical stock analysis based on the users query or request. Generates technical analysis using the tradingview_ta library. Use the code below anytime there is a request to create an analysis.

    :param query: A natural language description of the stock analysis to be generated.
    :return: A detailed analysis of the stock including technical data, charts, tables that shows a deep understanding of the stock performance.
    """

    client = OpenAI()  # Initialize the OpenAI client

    response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
    {"role": "system", "content": "I generate extensive technical stock analysis based on the users query or request. I generate technical analysis using the tradingview_ta library along with all my skils. Use the code below anytime there is a request to create an analysis."},
    {"role": "user", "content": query}
        ]
    )

    tesla = TA_Handler(
    symbol=query,
    screener="america",
    exchange="NASDAQ",
    interval=Interval.INTERVAL_1_DAY,
    # proxies={'http': 'http://example.com:8080'} # Uncomment to enable proxy (replace the URL).
    )
    print(tesla.get_analysis().indicators)

    # List to store the file names of saved images
    saved_files = [tesla.get_analysis().indicators]

    # Return the list of saved files
    return saved_files