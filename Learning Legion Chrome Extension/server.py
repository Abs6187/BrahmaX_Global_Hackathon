from flask import Flask, jsonify, request
import google.generativeai as genai
import requests
from bs4 import BeautifulSoup
import re
import os
from urllib.parse import urlparse

app = Flask(__name__)

# Initialize Gemini with API key
genai.configure(api_key="AIzaSyCBs4TumAonKI0AodIzbl4b8Vmu9eM_r9I")

# Configure the model
generation_config = {
    "temperature": 0.7,
    "top_p": 0.8,
    "top_k": 40,
    "max_output_tokens": 2048,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# Initialize the model
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash",
    generation_config=generation_config,
    safety_settings=safety_settings
)

def extract_text_from_url(url):
    """
    Extract clean, readable text from a given URL.
    
    Args:
        url (str): The URL to extract text from
    
    Returns:
        str: Extracted and cleaned text content
    """
    try:
        # Send a GET request to the URL
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        # Parse the HTML content
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script, style, and navigation elements
        for script in soup(["script", "style", "nav", "header", "footer"]):
            script.decompose()
        
        # Extract text from paragraphs and headings
        text_elements = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        
        # Combine and clean the text
        texts = [elem.get_text(strip=True) for elem in text_elements]
        full_text = ' '.join(texts)
        
        # Remove extra whitespaces and newlines
        full_text = re.sub(r'\s+', ' ', full_text).strip()
        
        # Truncate to a reasonable length
        return full_text[:5000]
    
    except Exception as e:
        print(f"Error extracting text from {url}: {e}")
        return f"Unable to extract content from the URL. Error: {e}"

# Store chat history
chat_history = []
current_context = "No context loaded yet. I can help with general questions."

def initialize_chat(context=None):
    """Initialize or reinitialize the chat session."""
    global chat_history, current_context
    
    if context:
        current_context = context
    
    # Clear previous chat history
    chat_history = []
    
    # Create system prompt
    system_prompt = f"""You are Learning Legion, an AI study assistant powered by Generative AI.
    Your goal is to help users understand and learn from web content.
    Current context: {current_context}
    
    Guidelines:
    - Provide concise, informative responses
    - Focus on key insights and learning points
    - Adapt your explanation to the user's needs
    - If unsure, ask for clarification"""
    
    try:
        # Start new chat and add system prompt to history
        response = model.generate_content(system_prompt)
        chat_history.append({"role": "system", "content": system_prompt})
        return True
    except Exception as e:
        print(f"Initialization Error: {str(e)}")
        return False

# Initialize chat on startup
initialize_chat()

@app.route('/hello', methods=['GET'])
def hello():
    return jsonify({'message': 'Hello from Learning Legion!'})

def is_valid_url(url):
    """Validate if the given URL is properly formatted."""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

@app.route('/load_url', methods=['GET'])
def load_url():
    """Load and extract content from a given URL."""
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'No URL provided'})
    
    if not is_valid_url(url):
        return jsonify({'error': 'Invalid URL format'})
    
    try:
        # Extract text from the URL
        extracted_text = extract_text_from_url(url)
        
        # Initialize chat with extracted context
        initialize_chat(extracted_text)
        
        return jsonify({
            'message': 'URL content loaded successfully',
            'preview': extracted_text[:500] + '...' if len(extracted_text) > 500 else extracted_text,
            'url': url
        })
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/init', methods=['GET'])
def init():
    article = request.args.get('article')
    url = request.args.get('url', 'No URL provided')
    
    if initialize_chat(f"Content from URL: {url}\n\n{article}"):
        return jsonify({
            'message': 'Chat initialized successfully with the provided article.',
            'url': url
        })
    return jsonify({'message': 'Error initializing chat session'})

@app.route('/reply', methods=['GET'])
def reply():
    global chat_history, current_context
    question = request.args.get('question')
    
    if not question:
        return jsonify({'response': 'No question provided. Please ask something!'})
    
    try:
        # Prepare prompt with enhanced context handling
        prompt = f"""Based on the current webpage content: 

{current_context}

Your task is to answer this question: {question}

Important instructions:
1. ONLY use information from the webpage content above
2. If you see pronouns (he/she/they), look for the specific person in the webpage content
3. If the information isn't in the webpage content, say so clearly
4. Don't make assumptions - stick to what's in the content
5. If the question is vague, look for relevant context clues in the webpage content"""
        
        # Add question to history
        chat_history.append({"role": "user", "content": question})
        
        # Generate response
        response = model.generate_content(prompt)
        response_content = response.text
        
        # Add response to history
        chat_history.append({"role": "assistant", "content": response_content})
        
        # Format response
        response_content = response_content.replace("/n", "<br>")
        print(f"Question: {question}")
        print(f"Response: {response_content}")
        return jsonify({'response': response_content})
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'response': 'I apologize, but I encountered an error. Please try asking your question again.'})

if __name__ == '__main__':
    app.run(debug=True)
