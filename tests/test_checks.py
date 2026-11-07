import sqlite3

import pytest

from evalgate.checks import Context, extract_sql, numbers_in, run_check, same_result, token_f1
from evalgate.suite import Case, SuiteError


def check(kind, answer, expected=None, **params):
    return run_check(answer, Case(id="c1", input="q", expected=expected), {"type": kind, **params}, Context())


def test_exact_ignores_case_and_spaces():
    assert check("exact", "  New   Delhi ", "new delhi").passed
    assert not check("exact", "Delhi", "New Delhi").passed


def test_exact_accepts_any_of_several():
    assert check("exact", "Bombay", ["Mumbai", "Bombay"]).passed


def test_contains_all_and_any():
    assert check("contains", "Revenue was ₹5 lakh in Mumbai", value=["revenue", "mumbai"]).passed
    r = check("contains", "Revenue was high", value=["revenue", "mumbai"])
    assert not r.passed and r.score == 0.5 and "mumbai" in r.detail
    assert check("contains", "Revenue was high", value=["revenue", "mumbai"], mode="any").passed


def test_not_contains():
    assert check("not_contains", "Here is the answer", value=["As an AI"]).passed
    assert not check("not_contains", "As an AI model I cannot", value=["as an ai"]).passed


def test_regex():
    assert check("regex", "Order #12345 confirmed", pattern=r"#\d{5}").passed
    assert check("regex", "no secrets here", pattern=r"sk-[A-Za-z0-9]{20}", must_not_match=True).passed


def test_json_valid_keys_and_values():
    assert check("json", '```json\n{"name": "Asha", "age": 31}\n```', required_keys=["name"]).passed
    assert not check("json", "{not json}").passed
    r = check("json", '{"name": "Asha"}', required_keys=["name", "age"])
    assert not r.passed and "age" in r.detail
    assert check("json", '{"a": 1, "b": {"c": 2.0}, "extra": true}', {"a": 1, "b": {"c": 2}}, match_expected=True).passed
    assert not check("json", '{"a": 2}', {"a": 1}, match_expected=True).passed


def test_numbers_in_handles_indian_grouping():
    assert numbers_in("Revenue was ₹1,23,45,678.50 and 12.5% growth") == [12345678.5, 12.5]


def test_number_tolerance():
    assert check("number", "Total revenue: ₹1,23,456", 123000, rel_tol=0.01).passed
    assert not check("number", "Total revenue: ₹1,23,456", 100000, rel_tol=0.01).passed
    assert not check("number", "No idea", 5).passed


def test_f1():
    assert token_f1("the capital is New Delhi", "New Delhi") == pytest.approx(0.667, abs=0.01)
    assert check("f1", "New Delhi is the capital", "New Delhi", threshold=0.5).passed
    assert not check("f1", "Mumbai", "New Delhi").passed


def test_max_length():
    assert check("max_length", "short", chars=10).passed
    assert not check("max_length", "one two three", words=2).passed


def test_is_question():
    assert check("is_question", "Do you mean revenue or orders?").passed
    assert not check("is_question", "SELECT city FROM customers -- which city?").passed
    assert not check("is_question", "Revenue is up.").passed


def test_unknown_check_type():
    with pytest.raises(SuiteError):
        check("nope", "x")


def test_extract_sql():
    assert extract_sql("Here:\n```sql\nSELECT 1;\n```") == "SELECT 1"
    assert extract_sql("SELECT 2;") == "SELECT 2"


@pytest.fixture
def shop(tmp_path):
    path = tmp_path / "shop.db"
    con = sqlite3.connect(path)
    con.executescript("""
        CREATE TABLE orders (id INTEGER, city TEXT, amount REAL, status TEXT);
        INSERT INTO orders VALUES (1, 'Delhi', 100, 'delivered'), (2, 'Delhi', 50, 'cancelled'),
                                  (3, 'Pune', 70, 'delivered'), (4, 'Pune', 30.004, 'delivered');
    """)
    con.commit()
    con.close()
    return path


def sql_check(shop, answer, expected):
    case = Case(id="s", input="q", expected=expected)
    return run_check(answer, case, {"type": "sql_result", "database": str(shop)}, Context())


def test_sql_result_compares_results_not_text(shop):
    expected = "SELECT city, SUM(amount) FROM orders WHERE status='delivered' GROUP BY city"
    # different SQL text, different column names, different row order, extra column: still correct
    answer = ("SELECT SUM(amount) AS revenue, city AS c, COUNT(*) AS n FROM orders "
              "WHERE status IN ('delivered') GROUP BY city ORDER BY city DESC")
    assert sql_check(shop, answer, expected).passed
    # forgot the status filter: wrong numbers
    wrong = sql_check(shop, "SELECT city, SUM(amount) FROM orders GROUP BY city", expected)
    assert not wrong.passed and wrong.detail == "different values"


def test_sql_result_rounding_and_row_count(shop):
    assert sql_check(shop, "SELECT ROUND(SUM(amount), 2) FROM orders WHERE city='Pune'",
                     "SELECT SUM(amount) FROM orders WHERE city='Pune'").passed
    r = sql_check(shop, "SELECT * FROM orders", "SELECT * FROM orders LIMIT 1")
    assert not r.passed and "rows" in r.detail


def test_sql_result_is_read_only(shop):
    r = sql_check(shop, "DELETE FROM orders", "SELECT 1")
    assert not r.passed and "not a SQL query" in r.detail
    r = sql_check(shop, "WITH x AS (SELECT 1) DELETE FROM orders", "SELECT 1")
    assert not r.passed
    con = sqlite3.connect(shop)
    assert con.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 4


def test_sql_result_reports_errors(shop):
    r = sql_check(shop, "SELECT nope FROM orders", "SELECT 1")
    assert not r.passed and "query failed" in r.detail
    r = sql_check(shop, "Sorry, I couldn't do it", "SELECT 1")
    assert not r.passed and "not a SQL query" in r.detail


def test_same_result_needs_every_expected_column():
    assert same_result([(1, "a")], [("a", 1, 9)], 2, 3)
    assert not same_result([(1, "a")], [("a", 2)], 2, 2)
    assert not same_result([(1,)], [(1,), (1,)], 1, 1)


def test_python_check():
    r = check("python", "hello", function="tests.helpers:shout_check")
    assert not r.passed and r.detail == "not shouting"
    assert check("python", "HELLO", function="tests.helpers:shout_check").passed
    assert check("python", "abc", function="tests.helpers:length_score", threshold=0.2).score == pytest.approx(0.3)
