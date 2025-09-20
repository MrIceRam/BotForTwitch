import os
import keyboard
import json
import time
import threading
import ctypes
import sys

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False

try:
    with open('blocking.json', 'r') as file:
        data = json.load(file)
    string = f"{data['reverse']}".lower()
    print(string)
    block_status = f"{data['block']}".lower()
    print(block_status)
except Exception as e:
    print(f"Error reading configuration files: {e}")
    sys.exit(1)


def check_unblock():
    try:
        with open('blocking.json', 'r') as file:
            data = json.load(file)
            return data['unblock'] == 'True'
    except FileNotFoundError:
        return False

def timer():
    if block_status == 'true':
        try:
            # Update reversetimer in blocking.json
            with open('blocking.json', 'r') as file:
                data = json.load(file)
            data['reversetimer'] = 'True'
            with open('blocking.json', 'w') as file:
                json.dump(data, file, indent=4)
            
            # Wait for either timeout or unblock event
            start_time = time.time()
            timeout = 60  # Timeout in seconds
            
            while time.time() - start_time < timeout:
                if check_unblock():
                    break
                time.sleep(1)
            with open('blocking.json', 'r') as file:
                data = json.load(file)
            
            # Reset reversetimer
            data['reversetimer'] = 'False'
            with open('blocking.json', 'w') as file:
                json.dump(data, file, indent=4)
        except Exception as e:
            print(f"Error in timer: {e}")

def block():
    if (string == 'reverse') and (block_status == 'true'):
        print('reverse')
        key_swap = {
            'a': 'd', 'A': 'D',
            'd': 'a', 'D': 'A',
            'w': 's', 'W': 'S',
            's': 'w', 'S': 'W',
            'ф': 'в', 'Ф': 'В',
            'в': 'ф', 'В': 'Ф',
            'ц': 'ы', 'Ц': 'Ы',
            'ы': 'ц', 'Ы': 'Ц',
        }
        
        def remap_keys(event):
            try:
                if event.event_type == 'down' and event.name in key_swap:
                    swapped_key = key_swap[event.name]
                    keyboard.press(swapped_key)
                    return False
                if event.event_type == 'up' and event.name in key_swap:
                    swapped_key = key_swap[event.name]
                    keyboard.release(swapped_key)
                    return False
                return True
            except Exception as e:
                print(f"Error in remap_keys: {str(e)}")
                return True

        try:
            # Initialize keyboard hook with retry mechanism
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    keyboard.hook(remap_keys, suppress=True)
                    print("Keyboard hook successfully installed")
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    print(f"Attempt {attempt + 1} failed, retrying...")
                    time.sleep(1)

            user32 = ctypes.windll.user32
            user32.SwapMouseButton(0x00000001)

            # Wait for either timeout or unblock event
            start_time = time.time()
            timeout = 60
            
            while time.time() - start_time < timeout:
                if check_unblock():
                    break
                print(f"LEFT {int(timeout - (time.time() - start_time))} SECONDS")
                time.sleep(1)

            user32.SwapMouseButton(0x00000000)
            keyboard.unhook_all()

        except Exception as e:
            print(f"Error in block function: {e}")
            # Cleanup in case of error
            try:
                user32.SwapMouseButton(0x00000000)
                keyboard.unhook_all()
            except:
                pass

if __name__ == "__main__":
    thread_1 = threading.Thread(target=timer)
    thread_2 = threading.Thread(target=block)

    thread_1.start()
    thread_2.start()

    thread_1.join()
    thread_2.join()