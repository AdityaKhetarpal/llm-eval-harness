# A stand-in for your LLM app. Replace this with a call to your real app.
ANSWERS = {
    "india": "The capital of India is New Delhi.",
    "japan": "Tokyo is the capital of Japan.",
    "australia": "Sydney is the capital of Australia.",   # wrong on purpose: watch the check catch it
    "refuse": "Sorry, I can't help with that.",
}


def answer(question, case):
    return ANSWERS[case.id]
