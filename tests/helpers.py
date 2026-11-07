def shout_check(answer, case, params):
    return (answer.isupper(), "shouting" if answer.isupper() else "not shouting")


def length_score(answer, case, params):
    return len(answer) / 10


def echo(question, case):
    return f"You asked: {question}"


def broken(question, case):
    raise RuntimeError("model is down")
