import os
import re
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import whisper

app = Flask(__name__)
CORS(app)

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "qwen3:4b"
whisper_model = whisper.load_model("base")

chatHistory = []

@app.route('/message', methods=['POST'])
def handle_text():
    global chatHistory

    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'Message is empty'}), 400

    prompt = data['message']
    print('Received text message:', prompt)

    chatHistory.append({'role': 'user', 'content': prompt})

    try:
        payload = {
            "model": MODEL_NAME,
            "messages": chatHistory,
            "stream": False
        }

        response = requests.post(OLLAMA_URL, json=payload)
        print('Ollama status code:', response.status_code)

        if response.status_code != 200:
            return jsonify({'error': 'Ollama failed'}), 500

        ollama_response = response.json()
        cleaned_content = re.sub(
            r"<think>.*?</think>",
            "",
            ollama_response['message']['content'],
            flags=re.DOTALL
        ).strip()

        chatHistory.append({'role': 'assistant', 'content': cleaned_content})

        return jsonify({'message': cleaned_content})

    except Exception as e:
        print("Error:", e)
        return jsonify({'error': 'Server error'}), 500

@app.route('/audio', methods=['POST'])
def handle_audio():
    global chatHistory

    audio_file = request.files.get('audio')
    if not audio_file:
        return jsonify({'error': 'No audio file provided'}), 400
    print('Got Audio File')

    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio_file:
        temp_audio_file.write(audio_file.read())
        temp_audio_path = temp_audio_file.name

    print('Temp audio path:', temp_audio_path)

    try:
         
        result = whisper_model.transcribe(temp_audio_path)
        prompt = result['text'].strip()
        print('Transcription:', prompt)

         
        chatHistory.append({'role': 'user', 'content': prompt})

         
        payload = {
            "model": MODEL_NAME,
            "messages": chatHistory,
            "stream": False
        }

        response = requests.post(OLLAMA_URL, json=payload)
        print('Ollama status code:', response.status_code)

        if response.status_code != 200:
            return jsonify({'error': 'Ollama failed'}), 500

        ollama_response = response.json()
        cleaned_content = re.sub(
            r"<think>.*?</think>",
            "",
            ollama_response['message']['content'],
            flags=re.DOTALL
        ).strip()

        
        chatHistory.append({'role': 'assistant', 'content': cleaned_content})

         
        return jsonify({
            'message': cleaned_content,
            'transcription':prompt})

    except Exception as e:
        print("Error:", e)
        return jsonify({'error': 'Server error'}), 500

    finally:
         
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
