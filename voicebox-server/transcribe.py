import sys
import whisper
import json
from textblob import TextBlob

# Ensure an audio file path is provided
if len(sys.argv) < 2:
    print(json.dumps({"error": "No audio file provided"}))
    sys.exit(1)

audio_path = sys.argv[1]

try:
    # Load Whisper model
    model = whisper.load_model("small")

    # Transcribe audio
    result = model.transcribe(audio_path)
    transcription = result["text"].strip()

    if not transcription:
        print(json.dumps({"error": "Empty transcription"}))
        sys.exit(1)

    # Analyze text with TextBlob
    blob = TextBlob(transcription)
    score = round(blob.sentiment.polarity * 10, 2)  # Convert polarity to 0-10 range

    # Ensure valid score range
    if score < 0:
        score = 0
    elif score > 10:
        score = 10

    # Output JSON response
    print(json.dumps({"text": transcription, "score": score}))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
