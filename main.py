import threading
import time
import sys
import os

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def animate_big_text():
    # Большой текст "MrIceRam" в ASCII art (4 строки)
    big_text = [
        "███╗   ███╗██████╗     ██╗ ██████╗███████╗    ██████╗  █████╗ ███╗   ███╗",
        "████╗ ████║██╔══██╗    ██║██╔════╝██╔════╝    ██╔══██╗██╔══██╗████╗ ████║",
        "██╔████╔██║██████╔╝    ██║██║     █████╗      ██████╔╝███████║██╔████╔██║",
        "██║╚██╔╝██║██╔══██╗    ██║██║     ██╔══╝      ██╔══██╗██╔══██║██║╚██╔╝██║",
        "██║ ╚═╝ ██║██║  ██║    ██║╚██████╗███████╗    ██║  ██║██║  ██║██║ ╚═╝ ██║",
        "╚═╝     ╚═╝╚═╝  ╚═╝    ╚═╝ ╚═════╝╚══════╝    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝"
    ]
    
    # Анимационные эффекты
    effects = [
        # Эффект 1: Появление слева направо
        lambda frame: [line[:frame] + " " * (len(line) - frame) for line in big_text],
        
        # Эффект 2: Мигание
        lambda frame: big_text if frame % 2 == 0 else [" " * len(line) for line in big_text],
        
        # Эффект 3: Волна сверху вниз
        lambda frame: [
            line if (i + frame) % 4 == 0 else " " * len(line) 
            for i, line in enumerate(big_text)
        ],
        
        # Эффект 4: Случайные символы
        lambda frame: [
            ''.join(chr(33 + (ord(c) + frame + i + j) % 94) if c != ' ' else ' ' 
                   for j, c in enumerate(line))
            for i, line in enumerate(big_text)
        ],
        
        # Эффект 5: Цветной эффект (симуляция)
        lambda frame: [
            ''.join(['█' if (i + j + frame) % 3 == 0 else c for j, c in enumerate(line)])
            for i, line in enumerate(big_text)
        ]
    ]
    
    frame_count = 0
    while not stop_animation.is_set():
        clear_screen()
        
        # Выбираем эффект на основе номера кадра
        effect_index = (frame_count // 10) % len(effects)
        current_frame = frame_count % 50
        
        # Получаем кадр анимации
        animated_text = effects[effect_index](current_frame)
        
        # Выводим анимацию
        print("\n" * 2)  # Отступ сверху
        for line in animated_text:
            print(" " * 5 + line)
        print("\n" * 2)  # Отступ снизу
        print("Нажмите Enter")
        
        frame_count += 1
        time.sleep(0.1)

def wait_for_input():
    input()  # Ждем ввод пользователя
    stop_animation.set()  # Останавливаем анимацию
    os.system("node .\index.js")
    
    

# Создаем флаг для остановки анимации
stop_animation = threading.Event()

# Запускаем анимацию в отдельном потоке
animation_thread = threading.Thread(target=animate_big_text)
animation_thread.start()

# Ждем ввод в основном потоке
wait_for_input()

# Ждем завершения потока с анимацией
animation_thread.join()

clear_screen()
print("Анимация остановлена! Спасибо за просмотр!")