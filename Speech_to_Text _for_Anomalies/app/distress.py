def is_unsafe(text: str) -> bool:
    text = text.lower()

    distress_phrases = [
        "help",
        "save me",
        "i need help",
        "please help",
        "i am in danger",
        "someone is attacking me",
        "someone is following me",
        "i am scared",
        "call the police",
        "emergency",
        "Save",
        "Someone is chasing me"
    ]

    return any(phrase in text for phrase in distress_phrases)
