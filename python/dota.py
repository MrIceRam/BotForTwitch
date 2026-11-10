import ctypes
import sys
import time
from ctypes import wintypes
from pathlib import Path

import keyboard

DOTA_PROCESS = "dota2.exe"
SKILLS = {"q", "w", "e", "r", "d", "f"}
RUSSIAN_LAYOUT = {"й": "q", "ц": "w", "у": "e", "к": "r", "в": "d", "а": "f"}  # если зритель забыл раскладку
MAX_CHAT_LENGTH = 120


def active_process() -> str:
    """Имя программы активного окна, например "dota2.exe"."""
    user32 = ctypes.WinDLL("user32")
    kernel32 = ctypes.WinDLL("kernel32")
    kernel32.OpenProcess.restype = wintypes.HANDLE

    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), ctypes.byref(pid))
    handle = kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        return ""
    try:
        path = ctypes.create_unicode_buffer(1024)
        size = wintypes.DWORD(len(path))
        kernel32.QueryFullProcessImageNameW(wintypes.HANDLE(handle), 0, path, ctypes.byref(size))
        return Path(path.value).name.lower()
    finally:
        kernel32.CloseHandle(wintypes.HANDLE(handle))


def clean_chat_text(text: str) -> str:
    """Одна строка без переносов (Enter отправил бы сообщение раньше времени) и не длиннее лимита."""
    return " ".join(text.split())[:MAX_CHAT_LENGTH]


def parse_skill(text: str) -> str | None:
    key = text.strip().lower()[:1]
    key = RUSSIAN_LAYOUT.get(key, key)
    return key if key in SKILLS else None


def send_chat(text: str) -> None:
    keyboard.press_and_release("shift+enter")  # общий чат
    time.sleep(0.15)
    keyboard.write(text, delay=0.02)
    time.sleep(0.05)
    keyboard.press_and_release("enter")


def main(action: str, text: str) -> str:
    if action == "chat":
        message = clean_chat_text(text)
        if not message:
            return "ERR пустое сообщение"
        if active_process() != DOTA_PROCESS:
            return "ERR Дота сейчас не на экране"
        send_chat(message)
        return f"OK chat: {message}"

    if action == "skill":
        key = parse_skill(text)
        if key is None:
            return "ERR напиши одну букву способности: q w e r d f"
        if active_process() != DOTA_PROCESS:
            return "ERR Дота сейчас не на экране"
        keyboard.press_and_release(key)
        return f"OK skill: {key}"

    return f"ERR неизвестное действие {action}"


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(main(sys.argv[1] if len(sys.argv) > 1 else "", sys.argv[2] if len(sys.argv) > 2 else ""))
