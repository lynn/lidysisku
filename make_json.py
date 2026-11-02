import json, time, urllib.error, urllib.parse, urllib.request

API = "https://lensisku.lojban.org/api/jbovlaste/definitions/list"
LANGIDS = {"en": 2, "ja": 10, "jbo": 1}
SOURCE_LANGID = 1  # jbo
PER_PAGE = 100  # the most the API allows
RETRIES = 5

types = [
    "bu-letteral",
    "cmavo",
    "cmavo-compound",
    "cmevla",
    "experimental cmavo",
    "experimental gismu",
    "fu'ivla",
    "gismu",
    "lujvo",
    "obsolete cmavo",
    "obsolete cmevla",
    "obsolete fu'ivla",
    "obsolete zei-lujvo",
    "zei-lujvo",
    "phrase",
    "non-canonical lujvo",
]


def get_page(langid, page):
    query = urllib.parse.urlencode({
        "languages": langid,
        "source_langid": SOURCE_LANGID,
        "sort_by": "created_at",
        "sort_order": "asc",
        "page": page,
        "per_page": PER_PAGE,
    })
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": "lidysisku"})
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt == RETRIES - 1: raise
            time.sleep(2 ** attempt * 5)

def get_definitions(langid):
    definitions = {}
    page = 1
    while True:
        response = get_page(langid, page)
        if not response["definitions"]: break
        for definition in response["definitions"]:
            definitions[definition["definitionid"]] = definition
        page += 1
    if len(definitions) < response["total"]:
        raise Exception(f"got {len(definitions)} of {response['total']} definitions")
    return definitions.values()

# Same selection as lensisku's dictionary export:
# for each word, the highest-scored definition with a positive score, oldest first.
def make_data(definitions):
    best = {}
    for d in sorted(definitions, key=lambda d: (-d["score"], d["definitionid"])):
        if d["score"] > 0 and d["type_name"] != "nalvla":
            best.setdefault(d["valsiword"], d)
    data = [
        [
            word,
            types.index(d["type_name"]),
            d["selmaho"] or "",
            int(d["score"]),
            d["definition"] or "",
        ]
        for word, d in sorted(best.items(), key=lambda item: item[0].lower())
    ]
    if not data: raise Exception("no data found")
    return data

# Fetch everything before writing anything, so a failure can't leave partial output.
dictionaries = {lang: make_data(get_definitions(langid)) for lang, langid in LANGIDS.items()}
for lang, data in dictionaries.items():
    js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    with open(f"jvs-{lang}.json", "w", encoding="utf-8") as f:
        f.write(js)
