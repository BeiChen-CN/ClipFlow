use crate::error::ClipflowError;

#[cfg(target_os = "windows")]
pub fn send_ctrl_v() -> Result<(), ClipflowError> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{SendInput, INPUT, VK_CONTROL, VK_V};

    let inputs = [
        key_down(VK_CONTROL),
        key_down(VK_V),
        key_up(VK_V),
        key_up(VK_CONTROL),
    ];
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };

    if sent == inputs.len() as u32 {
        Ok(())
    } else {
        Err(ClipflowError::PasteAutomationFailed)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn send_ctrl_v() -> Result<(), ClipflowError> {
    Err(ClipflowError::PasteAutomationFailed)
}

#[cfg(target_os = "windows")]
fn key_down(
    key: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY,
) -> windows::Win32::UI::Input::KeyboardAndMouse::INPUT {
    use windows::Win32::UI::Input::KeyboardAndMouse::{INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT};

    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: Default::default(),
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(target_os = "windows")]
fn key_up(
    key: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY,
) -> windows::Win32::UI::Input::KeyboardAndMouse::INPUT {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    };

    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}
