import os, json
import xml.etree.ElementTree as ET

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
]

for lang in ["en", "ja", "jbo"]:
    root = ET.parse(f"jbovlaste-{lang}.xml").getroot()
    data = []
    for valsi in root.iter("valsi"):
        word = valsi.get("word")
        if valsi.get("type") == "nalvla": continue
        type_index = types.index(valsi.get("type"))
        selmaho = valsi.findtext("selmaho") or ""
        score = int(valsi.findtext("score") or "0")
        definition = valsi.findtext("definition") or ""
        data.append([word, type_index, selmaho, score, definition])
    js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    with open(f"jvs-{lang}.json", "w") as f:
        f.write(js)
