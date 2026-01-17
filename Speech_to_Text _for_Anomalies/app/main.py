from fastapi import FastAPI, UploadFile, File
import whisper
import tempfile
import os
import imageio_ffmpeg
from app.distress import is_unsafe

ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
os.environ["PATH"] = os.path.dirname(ffmpeg_path) + os.pathsep + os.environ.get("PATH", "")

app = FastAPI()

model = None

def get_model():
    global model
    if model is None:
        model = whisper.load_model("small")
    return model

@app.post("/analyze-voice")
async def analyze_voice(file: UploadFile = File(...)):
    audio_bytes = await file.read()

    temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        temp.write(audio_bytes)
        temp.close()

        result = get_model().transcribe(
            temp.name,
            task="translate",
            fp16=False
        )

        english_text = result["text"].strip()
        unsafe = is_unsafe(english_text)

        return {
            "unsafe": unsafe,
            "english_text": english_text,
            "trigger": "VOICE_HELP" if unsafe else "NONE"
        }

    finally:
        if os.path.exists(temp.name):
            os.unlink(temp.name)