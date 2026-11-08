import requests
import sys

if len(sys.argv) > 1:
        argument_1 = sys.argv[1]
else:
        print("Нет никнейма")

def main(name):
    url = f"https://ddnet.org/players/?json2={name}"
    respons = requests.get(url)
    if respons.status_code == 200:
        JSdata = respons.json()
        xyun9 = JSdata.get("points", {}).get("points", None)
    return xyun9
print(main(argument_1))

