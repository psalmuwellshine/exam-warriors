(function () {
  'use strict';

  // The three screens. Each one is a separate block on the page, switched with the `hidden` attribute.
  var sections = {
    login: document.getElementById('login-section'),
    register: document.getElementById('register-section'),
    forgot: document.getElementById('forgot-section')
  };
  var firstField = { login: 'login-user', register: 'reg-user', forgot: 'forgot-user' };
  var errorBox = document.getElementById('error-box');
  var successBox = document.getElementById('success-box');

  function $(id) { return document.getElementById(id); }

  /* ---------- messages ---------- */
  function clearMessages() {
    errorBox.hidden = true; errorBox.textContent = '';
    successBox.hidden = true; successBox.textContent = '';
  }
  function showError(text) {
    successBox.hidden = true;
    errorBox.textContent = text; errorBox.hidden = false;
  }
  function showSuccess(text) {
    errorBox.hidden = true;
    successBox.textContent = text; successBox.hidden = false;
  }

  /* ---------- switching screens ---------- */
  function show(name, opts) {
    opts = opts || {};
    if (!sections[name]) name = 'login';
    Object.keys(sections).forEach(function (k) { sections[k].hidden = k !== name; });
    if (!opts.keepMessages) clearMessages();
    try {
      var hash = name === 'login' ? '' : '#' + name;
      if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
    } catch (e) { /* ignore */ }
    if (opts.focus) { var f = $(firstField[name]); if (f) f.focus(); }
  }

  $('show-register').addEventListener('click', function () { show('register', { focus: true }); });
  $('show-login').addEventListener('click', function () { show('login', { focus: true }); });
  $('show-forgot').addEventListener('click', function () {
    // Carry over a username they already typed.
    var typed = $('login-user').value.trim();
    if (typed) $('forgot-user').value = typed;
    show('forgot', { focus: true });
  });
  $('show-login-from-forgot').addEventListener('click', function () { show('login', { focus: true }); });

  // Direct links such as /login.html#register and /login.html#forgot, and the back button.
  function fromHash() { show(location.hash.replace('#', '') || 'login'); }
  window.addEventListener('hashchange', fromHash);
  fromHash();

  /* ---------- show / hide password ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('input[data-show]'), function (box) {
    box.addEventListener('change', function () {
      $(box.getAttribute('data-show')).type = box.checked ? 'text' : 'password';
    });
  });

  /* ---------- talking to the server ---------- */
  async function post(url, body) {
    var response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    var data = {};
    try { data = await response.json(); } catch (e) { /* not JSON */ }
    if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  // Runs a form submission with the button disabled so it cannot be sent twice.
  async function submit(form, work) {
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Please wait...';
    clearMessages();
    try { await work(); }
    catch (err) { showError(err.message); }
    finally { btn.disabled = false; btn.textContent = label; }
  }

  function need(ok, message) { if (!ok) throw new Error(message); }

  /* ---------- log in ---------- */
  $('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    submit(e.target, async function () {
      var username = $('login-user').value.trim();
      var password = $('login-pass').value;
      need(username && password, 'Enter your username and password.');
      var data = await post('/api/login', { username: username, password: password });
      try { localStorage.setItem('examWarriorUser', JSON.stringify(data.user)); } catch (e2) { /* private mode */ }
      showSuccess(data.message || 'Login successful!');
      setTimeout(function () { window.location.href = '/'; }, 1200);
    });
  });

  /* ---------- register ---------- */
  $('form-register').addEventListener('submit', function (e) {
    e.preventDefault();
    submit(e.target, async function () {
      var username = $('reg-user').value.trim();
      var password = $('reg-pass').value;
      var phrase = $('reg-phrase').value.trim();
      need(username && password && phrase, 'Fill in every field.');
      need(password.length >= 6, 'Password must be at least 6 characters.');
      need(phrase.length >= 4, 'Recovery phrase must be at least 4 characters.');
      var data = await post('/api/register', { username: username, password: password, recoveryPhrase: phrase });
      $('form-register').reset();
      $('login-user').value = data.username || username;
      $('login-pass').value = '';
      show('login', { focus: false });
      $('login-pass').focus();
      showSuccess('Account created. Log in to continue.');
    });
  });

  /* ---------- forgot password ---------- */
  $('form-forgot').addEventListener('submit', function (e) {
    e.preventDefault();
    submit(e.target, async function () {
      var username = $('forgot-user').value.trim();
      var phrase = $('forgot-phrase').value.trim();
      var newPassword = $('forgot-new-pass').value;
      need(username && phrase && newPassword, 'Please fill in all fields.');
      need(newPassword.length >= 6, 'New password must be at least 6 characters.');
      var data = await post('/api/user/reset-password', { username: username, recoveryPhrase: phrase, newPassword: newPassword });
      $('form-forgot').reset();
      $('login-user').value = data.username || username;
      $('login-pass').value = '';
      show('login', { focus: false });
      $('login-pass').focus();
      showSuccess(data.message || 'Password reset. You can now log in.');
    });
  });
})();
