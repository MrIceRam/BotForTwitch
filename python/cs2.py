"""Действия в CS2 за награды: сообщение в общий чат и нажатие клавиши.

Бот вызывает:
    python cs2.py chat "текст"   — написать в общий чат игры
    python cs2.py key g          — нажать клавишу (g — выкинуть оружие, 3 — нож, f — осмотр)
Отвечает одной строкой: "OK ..." — получилось, "ERR причина" — нет (бот напишет причину зрителю и вернёт баллы).
Клавиши нажимаются, только если CS2 сейчас на экране, — в другие окна ничего не печатается.
"""
import ctypes
import sys
import time
from ctypes import wintypes
from pathlib import Path

import keyboard

CS2_PROCESS = "cs2.exe"
CHAT_KEY = "y"                     # общий чат (u — командный). Поменяйте, если у вас другой бинд
ALLOWED_KEYS = {"g", "3", "f"}     # какие клавиши бот может нажимать (выкинуть, нож, осмотр)
MAX_CHAT_LENGTH = 120


def active_process() -> str:
    """Имя программы активного окна, например "cs2.exe"."""
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


def press(key: str) -> None:
    # короткое удержание: мгновенное нажатие-отпускание игра иногда не замечает
    keyboard.press(key)
    time.sleep(0.05)
    keyboard.release(key)


def send_chat(text: str) -> None:
    press(CHAT_KEY)
    time.sleep(0.2)                # ждём, пока откроется строка чата
    keyboard.write(text, delay=0.02)
    time.sleep(0.05)
    press("enter")


def main(action: str, arg: str) -> str:
    if action == "chat":
        message = clean_chat_text(arg)
        if not message:
            return "ERR пустое сообщение"
        if active_process() != CS2_PROCESS:
            return "ERR CS2 сейчас не на экране"
        send_chat(message)
        return f"OK chat: {message}"

    if action == "key":
        key = arg.strip().lower()
        if key not in ALLOWED_KEYS:
            return f"ERR клавиша {key} не разрешена"
        if active_process() != CS2_PROCESS:
            return "ERR CS2 сейчас не на экране"
        press(key)
        return f"OK key: {key}"

    return f"ERR неизвестное действие {action}"


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(main(sys.argv[1] if len(sys.argv) > 1 else "", sys.argv[2] if len(sys.argv) > 2 else ""))
