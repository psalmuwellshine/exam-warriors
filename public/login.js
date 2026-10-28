  const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const errorBox = document.getElementById('error-box');
    const successBox = document.getElementById('success-box');

    // Switch to Register mode
    document.getElementById('show-register').addEventListener('click', (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      successBox.style.display = 'none';
      loginSection.style.display = 'none';      // Hides login
      registerSection.style.display = 'block';  // Shows register
    });

    // Switch to Login mode
    document.getElementById('show-login').addEventListener('click', (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      successBox.style.display = 'none';
      registerSection.style.display = 'none';   // Hides register
      loginSection.style.display = 'block';     // Shows login
    });

    // Handle Login Submission
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-user').value;
      const password = document.getElementById('login-pass').value;
      await submitAuth('/api/login', username, password);
    });

    // Handle Register Submission
    document.getElementById('form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-user').value;
      const password = document.getElementById('reg-pass').value;
      await submitAuth('/api/register', username, password);
    });

    // The actual connection to the backend
    async function submitAuth(endpoint, username, password) {
      errorBox.style.display = 'none';
      successBox.style.display = 'none';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Something went wrong');

        successBox.textContent = data.message;
        successBox.style.display = 'block';
        
        if (endpoint === '/api/login') {
          localStorage.setItem('examWarriorUser', JSON.stringify(data.user));
          setTimeout(() => { window.location.href = '/'; }, 1500); 
        } else {
          // If registered successfully, switch to login tab
          setTimeout(() => { document.getElementById('show-login').click(); }, 1500);
        }

      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      }
    }

// --- NEW: Forgot Password Logic ---
document.addEventListener('DOMContentLoaded', () => {
  // Grab ALL elements here so they exist when the page loads
  const loginSection = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');
  const forgotSection = document.getElementById('forgot-section');
  const forgotMsg = document.getElementById('forgot-msg');
  
  const showForgotBtn = document.getElementById('show-forgot');
  const showLoginFromForgotBtn = document.getElementById('show-login-from-forgot');
  const formForgot = document.getElementById('form-forgot');

  if (showForgotBtn) {
    showForgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Hide only the login and register forms
      if (loginSection) loginSection.style.display = 'none';
      if (registerSection) registerSection.style.display = 'none';
      
      // Show the forgot form
      if (forgotSection) forgotSection.style.display = 'block';
      if (forgotMsg) forgotMsg.style.display = 'none';
    });
  }

  if (showLoginFromForgotBtn) {
    showLoginFromForgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Hide the forgot form
      if (forgotSection) forgotSection.style.display = 'none';
      
      // Show the login form again
      if (loginSection) loginSection.style.display = 'block';
    });
  }

  if (formForgot) {
    formForgot.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('forgot-user').value;
      const recoveryPhrase = document.getElementById('forgot-phrase').value;
      const newPassword = document.getElementById('forgot-new-pass').value;
      const btn = document.getElementById('forgot-btn');

      btn.textContent = 'Resetting...';
      btn.disabled = true;
      if (forgotMsg) forgotMsg.style.display = 'none';

      try {
        const response = await fetch('/api/user/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, recoveryPhrase, newPassword })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Failed to reset password');

        // Success!
        forgotMsg.textContent = data.message;
        forgotMsg.style.color = '#4dff4d';
        forgotMsg.style.background = 'rgba(77, 255, 77, 0.1)';
        forgotMsg.style.display = 'block';
        
        formForgot.reset();

        setTimeout(() => {
          if (showLoginFromForgotBtn) showLoginFromForgotBtn.click();
        }, 2000);

      } catch (err) {
        forgotMsg.textContent = err.message;
        forgotMsg.style.color = '#ff4d4d';
        forgotMsg.style.background = 'rgba(255, 77, 77, 0.1)';
        forgotMsg.style.display = 'block';
      } finally {
        btn.textContent = 'Reset Password';
        btn.disabled = false;
      }
    });
  }
});
