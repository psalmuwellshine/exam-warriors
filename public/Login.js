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