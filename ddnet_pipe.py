#!/usr/bin/env python3
import os
import sys
import time
import argparse
from pathlib import Path

def send_command(pipe_name, command):
    """Send a command to DDNet client through a named pipe."""
    try:
        # On Windows, use named pipes
        if os.name == 'nt':
            try:
                import win32pipe
                import win32file
                import pywintypes
                
                pipe_path = f"\\\\.\\pipe\\{pipe_name}"
                print(f"Attempting to connect to pipe: {pipe_path}")
                
                # Open the pipe with proper Windows pipe access
                try:
                    handle = win32file.CreateFile(
                        pipe_path,
                        win32file.GENERIC_WRITE,
                        0,  # No sharing
                        None,  # No security attributes
                        win32file.OPEN_EXISTING,
                        win32file.FILE_FLAG_OVERLAPPED,
                        None
                    )
                    print("Successfully opened pipe")
                except pywintypes.error as e:
                    print(f"Failed to open pipe: {e}")
                    return False
                
                # Write the command
                try:
                    command_bytes = (command + '\n').encode('utf-8')
                    print(f"Sending command bytes: {command_bytes}")
                    win32file.WriteFile(handle, command_bytes)
                    print("Successfully wrote to pipe")
                    # Add a small delay to ensure the command is processed
                    time.sleep(0.1)
                except pywintypes.error as e:
                    print(f"Failed to write to pipe: {e}")
                    return False
                finally:
                    try:
                        win32file.CloseHandle(handle)
                        print("Successfully closed pipe handle")
                    except pywintypes.error as e:
                        print(f"Failed to close pipe handle: {e}")
                return True
                
            except ImportError:
                print("Error: pywin32 package is required for Windows. Install it with: pip install pywin32")
                return False
            except pywintypes.error as e:
                print(f"Error connecting to pipe: {e}")
                return False
        else:
            # On Unix-like systems, use FIFO files
            pipe_path = str(Path.home() / f".ddnet/{pipe_name}")
            
            # Ensure the pipe exists
            if not os.path.exists(pipe_path):
                print(f"Error: Pipe '{pipe_path}' does not exist. Make sure DDNet is running with cl_input_fifo enabled.")
                return False
                
            # Open the pipe and send the command
            with open(pipe_path, 'w') as pipe:
                pipe.write(command + '\n')
                pipe.flush()
            return True
    except Exception as e:
        print(f"Error sending command: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Send commands to DDNet client through a named pipe')
    parser.add_argument('command', nargs='+', help='The command to send to DDNet')
    parser.add_argument('--pipe', default='ddnet_client', help='Name of the pipe (default: ddnet_client)')
    parser.add_argument('--delay', type=float, default=0.1, help='Delay between commands in seconds (default: 0.1)')
    
    args = parser.parse_args()
    
    # Join command arguments with spaces
    command = ' '.join(args.command)
    
    print(f"Operating system: {os.name}")
    print(f"Command to send: {command}")
    print(f"Pipe name: {args.pipe}")
    
   
    if send_command(args.pipe, command):
        print(f"Command sent successfully: {command}")
    else:
        print("Failed to send command")
        sys.exit(1)

if __name__ == '__main__':
    main() 