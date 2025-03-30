from flask import Flask, request, jsonify, render_template, session
from flask_session import Session
import os
import json
from groq import Groq
from gtts import gTTS
from io import BytesIO
import base64

app = Flask(__name__)

# Configure session to use filesystem (each user gets a unique session)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

# Load configuration
working_dir = os.path.dirname(os.path.abspath(__file__))
config_data = json.load(open(f"{working_dir}/config.json"))
GROQ_API_KEY = config_data["GROQ_API_KEY"]
os.environ["GROQ_API_KEY"] = GROQ_API_KEY

client = Groq()

# Default settings
settings = {
    "behavior": "Casual",
    "expertise": "General Knowledge",
    "interests": ["AI", "Space"],
    "temperature": 0.7,
    "max_tokens": 500,
    "voice_enabled": True,
    "language_code": "en"
}

# Text-to-speech function
def text_to_speech(text, lang="en"):
    tts = gTTS(text=text, lang=lang, slow=False)
    audio_bytes = BytesIO()
    tts.write_to_fp(audio_bytes)
    audio_bytes.seek(0)
    return base64.b64encode(audio_bytes.read()).decode("utf-8")

# Home route
@app.route("/")
def index():
    session.clear()  # Clears session on refresh
    return render_template("index.html")

# Chat endpoint
@app.route("/chat", methods=["POST"])
def chat():
    if "chat_history" not in session:
        session["chat_history"] = []  # Create unique chat history for user

    data = request.get_json()
    prompt = data.get("prompt")

    # Add user message to history
    session["chat_history"].append({"role": "user", "content": prompt, "audio": None})

    # Create system message for structured output
    system_message = f"""
    You are a {settings['behavior'].lower()} assistant specialized in {settings['expertise']}.
    Your interests include {', '.join(settings['interests']) if settings['interests'] else 'various topics'}.
    Respond in a {settings['behavior'].lower()} manner. Provide clear, concise answers in a structured bullet-point format.
    """

    # Prepare messages for API
    messages = [
        {"role": "system", "content": system_message},
        *[{"role": msg["role"], "content": msg["content"]} for msg in session["chat_history"]]
    ]

    try:
        # Call Groq API
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            temperature=settings["temperature"],
            max_tokens=settings["max_tokens"]
        )
        assistant_response = response.choices[0].message.content

        # Generate audio if enabled
        audio_base64 = None
        if settings["voice_enabled"]:
            audio_base64 = text_to_speech(assistant_response, lang=settings["language_code"])

        # Add assistant response to history
        session["chat_history"].append({"role": "assistant", "content": assistant_response, "audio": audio_base64})

        return jsonify({
            "response": assistant_response,
            "audio": audio_base64 if audio_base64 else None
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Settings endpoint
@app.route("/settings", methods=["POST"])
def update_settings():
    data = request.get_json()
    settings.update(data)
    return jsonify({"status": "Settings updated"})

# Get chat history (for the specific user)
@app.route("/history", methods=["GET"])
def get_history():
    return jsonify(session.get("chat_history", []))

if __name__ == "__main__":
    app.run(debug=True, port=5000)
